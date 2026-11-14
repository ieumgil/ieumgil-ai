// 공중화장실 공공데이터(행정안전부 전국공중화장실표준데이터) 짝짓기·합치기 규칙.
// 가짜 CSV·가짜 장소만 쓴다(실제 원본 파일은 읽지 않는다).
import { describe, expect, it } from "vitest";
import {
  buildRestroomsFile,
  mergePublic,
  normalizeName,
  parseRestroomCsv,
  parseRestroomCsvDetailed,
  placeKey,
  publicDocLines,
  publicParagraphs,
  type PlaceRestrooms,
} from "@/lib/public/restrooms";
import { PUBLIC_RESTROOM_SOURCE, publicSourceLabel } from "@/lib/public/source";
import { validatePlaces } from "@/lib/places/validate";
import type { AccessItem } from "@/lib/types";
import { loadSamplePlaces } from "../helpers";

const COLUMNS = [
  "관리번호",
  "구분명",
  "화장실명",
  "소재지도로명주소",
  "소재지지번주소",
  "남성용-장애인용대변기수",
  "여성용-장애인용대변기수",
  "개방시간",
  "기저귀교환대유무",
  "기저귀교환대장소",
  "데이터기준일자",
] as const;
type Column = (typeof COLUMNS)[number];

const DEFAULT_ROW: Record<Column, string> = {
  관리번호: "1",
  구분명: "",
  화장실명: "강문해변",
  소재지도로명주소: "강원특별자치도 강릉시 창해로 1",
  소재지지번주소: "",
  "남성용-장애인용대변기수": "1",
  "여성용-장애인용대변기수": "1",
  개방시간: "상시",
  기저귀교환대유무: "N",
  기저귀교환대장소: "",
  데이터기준일자: "2024-12-31",
};

const quote = (s: string) => (/[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

/** 열 이름 + 행 객체 → CSV 문자열(쉼표가 든 칸은 큰따옴표) */
function csv(rows: Partial<Record<Column, string>>[]): string {
  const lines = [COLUMNS.join(",")];
  for (const r of rows) lines.push(COLUMNS.map((c) => quote(r[c] ?? DEFAULT_ROW[c])).join(","));
  return lines.join("\n");
}

const GN27 = { id: "GN27", name_ko: "강문해변", region: "강릉" as const };

const aiUnknown = (): AccessItem => ({
  value: "모름",
  ask: "장애인 화장실이 있나요?",
  grade: "ai",
  method: "관광공사 API",
  verified_at: "2026-11-10",
});

describe("공중화장실 공공데이터 — 한 줄 끝까지", () => {
  it("강문해변 한 줄이 짝지어지고 근거 id public-화장실-1이 붙는다", () => {
    const { file } = buildRestroomsFile(csv([{}]), [GN27]);
    expect(file.places.GN27.restrooms).toHaveLength(1);
    expect(file.places.GN27.restrooms[0].evidence_id).toBe("public-화장실-1");
  });

  it("mergePublic: 모름 → 가능(grade public · 공공데이터), ask는 없어진다", () => {
    const { file } = buildRestroomsFile(csv([{}]), [GN27]);
    const merged = mergePublic(aiUnknown(), "accessible_toilet", file.places.GN27);
    expect(merged).toEqual({
      value: "가능",
      note: "공중화장실 '강문해변' · 장애인 칸 2",
      evidence: ["public-화장실-1"],
      grade: "public",
      method: "공공데이터",
      verified_at: "2024-12-31",
      source_url: PUBLIC_RESTROOM_SOURCE.url,
    });
    expect("ask" in merged).toBe(false);
  });

  it("합친 값은 장소 데이터 검사(validatePlaces)를 통과한다", () => {
    const { file } = buildRestroomsFile(csv([{}]), [GN27]);
    const places = loadSamplePlaces();
    places[0].access.accessible_toilet = mergePublic(aiUnknown(), "accessible_toilet", file.places.GN27);
    expect(validatePlaces(places)).toEqual({ ok: true, issues: [] });
  });

  it("출처 문구: public이면 '공공데이터(YYYY-MM 기준)', ai면 없음", () => {
    expect(publicSourceLabel({ grade: "public", verified_at: "2024-12-31" })).toBe("공공데이터(2024-12 기준)");
    expect(publicSourceLabel({ grade: "ai", verified_at: "2024-12-31" })).toBeUndefined();
  });

  it("근거 문단은 CSV 값을 정해진 틀로 옮기고, id는 스키마 근거 정규식에 맞는다", () => {
    const { file } = buildRestroomsFile(csv([{}]), [GN27]);
    const paras = publicParagraphs(file.places.GN27);
    expect(paras).toHaveLength(1);
    expect(paras[0]).toMatchObject({ id: "public-화장실-1", label: "공공데이터·공중화장실" });
    for (const piece of ["강문해변", "장애인용 대변기 남 1 · 여 1", "기저귀 교환대 없음", "데이터 기준일 2024-12-31"]) {
      expect(paras[0].text).toContain(piece);
    }
    expect(paras[0].id).toMatch(/^[a-z]+(-[a-z가-힣0-9]+)*-\d+$/);
  });
});

// ───────────────────────── Task 2: 규칙 전부 ─────────────────────────

type Rows = Partial<Record<Column, string>>[];
const SEOUL_ROAD = "서울특별시 종로구 세종대로 1";

/** 가짜 CSV로 강문해변 한 곳(GN27)의 화장실 요약을 만든다 */
function entryOf(rows: Rows): PlaceRestrooms {
  const { file } = buildRestroomsFile(csv(rows), [GN27]);
  return file.places.GN27;
}

const aiItem = (value: AccessItem["value"], patch: Partial<AccessItem> = {}): AccessItem => ({
  value,
  ...(value === "모름" ? { ask: "물어볼 질문" } : {}),
  ...(value === "부분가능" ? { note: "일부만" } : {}),
  grade: "ai",
  method: "관광공사 API",
  verified_at: "2026-11-10",
  ...patch,
});

describe("CSV 읽기", () => {
  it("BOM·CRLF·큰따옴표 칸(쉼표·\"\" 포함)·빈 줄을 처리한다", () => {
    const text = "﻿" + csv([{ 화장실명: '강문,"해변"' }, { 관리번호: "2" }]).replace(/\n/g, "\r\n") + "\r\n\r\n";
    const rows = parseRestroomCsv(text);
    expect(rows).toHaveLength(2);
    expect(rows[0]["화장실명"]).toBe('강문,"해변"');
    expect(rows[1]["관리번호"]).toBe("2");
  });

  it("필요한 열이 없으면 빠진 열 이름을 담은 오류를 낸다", () => {
    expect(() => parseRestroomCsv("관리번호,화장실명\n1,강문해변")).toThrow(/구분명/);
  });

  // WR-03: 따옴표 없는 칸 가운데의 큰따옴표는 글자일 뿐이다(여러 행이 한 칸으로 삼켜지면 안 된다)
  const rawRow = (patch: Partial<Record<Column, string>>) => COLUMNS.map((c) => patch[c] ?? DEFAULT_ROW[c]).join(",");

  it("따옴표 없는 칸 가운데의 큰따옴표는 따옴표 칸을 열지 않아 다음 행이 살아 있다", () => {
    const text = [COLUMNS.join(","), rawRow({ 관리번호: "1", 화장실명: '강문해변 5" 배관' }), rawRow({ 관리번호: "2" }), rawRow({ 관리번호: "3" })].join("\n");
    const rows = parseRestroomCsv(text);
    expect(rows.map((r) => r["관리번호"])).toEqual(["1", "2", "3"]);
    expect(rows[0]["화장실명"]).toBe('강문해변 5" 배관');
  });

  it("칸이 따옴표로 시작하면 그대로 따옴표 칸(줄바꿈·쉼표 포함)으로 읽는다", () => {
    const text = [COLUMNS.join(","), rawRow({ 관리번호: "1", 화장실명: '"강문해변\n동쪽, ""임시"""' }), rawRow({ 관리번호: "2" })].join("\n");
    const rows = parseRestroomCsv(text);
    expect(rows.map((r) => r["관리번호"])).toEqual(["1", "2"]);
    expect(rows[0]["화장실명"]).toBe('강문해변\n동쪽, "임시"');
  });

  it("열 개수가 헤더와 다른 행은 버리고 개수와 첫 행 번호(헤더가 1)를 알려 준다", () => {
    const tooMany = rawRow({ 관리번호: "2" }) + ",딸린칸";
    const tooFew = rawRow({ 관리번호: "3" }).split(",").slice(0, 5).join(",");
    const text = [COLUMNS.join(","), rawRow({ 관리번호: "1" }), tooMany, tooFew, rawRow({ 관리번호: "4" })].join("\n");
    const result = parseRestroomCsvDetailed(text);
    expect(result.records.map((r) => r["관리번호"])).toEqual(["1", "4"]);
    expect(result.badRows).toBe(2);
    expect(result.firstBadRow).toBe(3);
    expect(parseRestroomCsv(text)).toHaveLength(2);
    expect(parseRestroomCsvDetailed(csv([{}])).badRows).toBe(0);
  });

  it("buildRestroomsFile은 열 개수가 안 맞아 버린 행 수를 돌려주고, 파일 통계(source)에는 넣지 않는다", () => {
    const text = [COLUMNS.join(","), rawRow({ 관리번호: "1" }), rawRow({ 관리번호: "2" }) + ",딸린칸"].join("\n");
    const { file, badColumnRows, firstBadColumnRow } = buildRestroomsFile(text, [GN27]);
    expect(badColumnRows).toBe(1);
    expect(firstBadColumnRow).toBe(3);
    expect(file.places.GN27.restrooms.map((r) => r.no)).toEqual(["1"]);
    expect(file.source.rows).toBe(1);
    expect("bad_column_rows" in file.source).toBe(false);
  });
});

describe("짝짓기 규칙(D-02)", () => {
  it("이름 열쇠: 공백·'·'·괄호를 무시하고, 괄호 부분은 뺀다", () => {
    expect(normalizeName("허균·허난설헌 기념공원")).toBe("허균허난설헌기념공원");
    expect(placeKey("하평해변(강릉)")).toBe("하평해변");
  });

  it("'허균·허난설헌 기념공원' ↔ '허균허난설헌 기념공원 화장실'은 짝이다", () => {
    const place = { id: "GN50", name_ko: "허균·허난설헌 기념공원", region: "강릉" as const };
    const { file } = buildRestroomsFile(csv([{ 화장실명: "허균허난설헌 기념공원 화장실" }]), [place]);
    expect(file.places.GN50.restrooms).toHaveLength(1);
  });

  it("화장실명에 '주유소'가 들어 있으면 짝이 아니고 excluded에 남는다", () => {
    const place = { id: "GN10", name_ko: "소금강", region: "강릉" as const };
    const { file, excluded } = buildRestroomsFile(csv([{ 화장실명: "소금강주유소" }]), [place]);
    expect(file.places.GN10).toBeUndefined();
    expect(excluded).toEqual([{ placeId: "GN10", restroom: "소금강주유소", reason: "주유소" }]);
  });

  it("다른 시의 같은 이름 화장실은 짝이 아니고(다른 시), 같은 시의 것은 짝이다", () => {
    const place = { id: "GN30", name_ko: "하평해변(강릉)", region: "강릉" as const };
    const rows: Rows = [
      { 관리번호: "1", 화장실명: "하평해변", 소재지도로명주소: "강원특별자치도 동해시 해변로 1" },
      { 관리번호: "2", 화장실명: "하평해변", 소재지도로명주소: "강원특별자치도 강릉시 해변로 2" },
    ];
    const { file, excluded } = buildRestroomsFile(csv(rows), [place]);
    expect(file.places.GN30.restrooms.map((r) => r.no)).toEqual(["2"]);
    expect(excluded).toEqual([{ placeId: "GN30", restroom: "하평해변", reason: "다른 시" }]);
  });

  it("주소만 같고 이름에 관광지 이름이 없으면 짝이 아니다", () => {
    const rows: Rows = [{ 화장실명: "공영주차장 화장실", 소재지도로명주소: "강원특별자치도 강릉시 창해로 1", 소재지지번주소: "강릉시 강문동 1" }];
    const { file, excluded } = buildRestroomsFile(csv(rows), [GN27]);
    expect(file.places.GN27).toBeUndefined();
    expect(excluded).toEqual([]);
  });

  it("괄호를 뺀 이름이 3글자 미만이면 아무것도 짝짓지 않는다", () => {
    const place = { id: "GN40", name_ko: "솔숲(강릉)", region: "강릉" as const };
    const { file } = buildRestroomsFile(csv([{ 화장실명: "솔숲" }, { 관리번호: "2", 화장실명: "솔숲 쉼터 화장실" }]), [place]);
    expect(file.places.GN40).toBeUndefined();
  });

  it("같은 화장실명·도로명·지번 중복 2행은 기준일이 늦은 행만 남긴다(같으면 관리번호가 큰 행)", () => {
    const old = { 관리번호: "9", 데이터기준일자: "2024-06-01" };
    const recent = { 관리번호: "3", 데이터기준일자: "2024-12-31" };
    expect(entryOf([old, recent]).restrooms.map((r) => r.no)).toEqual(["3"]);
    const same1 = { 관리번호: "3", 데이터기준일자: "2024-12-31" };
    const same2 = { 관리번호: "10", 데이터기준일자: "2024-12-31" };
    expect(entryOf([same1, same2]).restrooms.map((r) => r.no)).toEqual(["10"]);
  });

  it("소재지 주소에 강릉시·속초시·동해시가 없는 행은 세지도 짝짓지도 않는다", () => {
    const rows: Rows = [{ 소재지도로명주소: SEOUL_ROAD, 소재지지번주소: "" }];
    const { file } = buildRestroomsFile(csv(rows), [GN27]);
    expect(file.places.GN27).toBeUndefined();
    expect(file.source).toMatchObject({ rows: 1, rows_3_cities: 0, unique_3_cities: 0 });
  });
});

describe("OR 합치기(D-03·D-04·D-05)", () => {
  it("0칸·기저귀 N뿐이면 AI 값을 그대로(같은 참조) 돌려준다. entry가 없어도 같다", () => {
    const entry = entryOf([{ "남성용-장애인용대변기수": "0", "여성용-장애인용대변기수": "0", 기저귀교환대유무: "N" }]);
    const unknown = aiItem("모름");
    expect(mergePublic(unknown, "accessible_toilet", entry)).toBe(unknown);
    expect(mergePublic(unknown, "diaper_nursing", entry)).toBe(unknown);
    expect(mergePublic(unknown, "accessible_toilet", undefined)).toBe(unknown);
  });

  it("미개방은 있음으로 세지 않고, 불규칙은 센다", () => {
    const item = aiItem("모름");
    const closed = entryOf([{ "남성용-장애인용대변기수": "2", "여성용-장애인용대변기수": "0", 개방시간: "미개방" }]);
    expect(mergePublic(item, "accessible_toilet", closed)).toBe(item);
    const irregular = entryOf([{ "남성용-장애인용대변기수": "2", "여성용-장애인용대변기수": "0", 개방시간: "불규칙" }]);
    expect(mergePublic(item, "accessible_toilet", irregular)).toMatchObject({ value: "가능", grade: "public" });
  });

  it("AI 값이 불가·부분가능이어도 공공데이터 있음이면 가능으로 올리고, 질문·옛 메모는 남기지 않는다", () => {
    const entry = entryOf([{}]);
    for (const ai of [aiItem("불가", { note: "설치 예정", evidence: ["restroom-1"] }), aiItem("부분가능", { evidence: ["restroom-1"] })]) {
      const merged = mergePublic(ai, "accessible_toilet", entry);
      expect(merged).toMatchObject({ value: "가능", note: "공중화장실 '강문해변' · 장애인 칸 2", grade: "public", method: "공공데이터" });
      expect("ask" in merged).toBe(false);
      expect(merged.evidence).toEqual(["public-화장실-1"]);
    }
  });

  it("사람이 확인한 값(human)은 공공데이터가 있어도 바뀌지 않는다", () => {
    const human = aiItem("불가", { grade: "human", method: "전화 확인", note: "전화로 확인: 없음" });
    expect(mergePublic(human, "accessible_toilet", entryOf([{}]))).toBe(human);
  });

  it("AI 값이 이미 가능이면 관광공사 메모를 ' / 관광공사: …'로 뒤에 남기고 근거를 합친다(중복 없음)", () => {
    const ai = aiItem("가능", { note: "주차장 입구", evidence: ["restroom-1", "public-화장실-1"] });
    const merged = mergePublic(ai, "accessible_toilet", entryOf([{}]));
    expect(merged.note).toBe("공중화장실 '강문해변' · 장애인 칸 2 / 관광공사: 주차장 입구");
    expect(merged.evidence).toEqual(["restroom-1", "public-화장실-1"]);
    const noDup = mergePublic(aiItem("가능", { note: "주차장 입구", evidence: ["restroom-1"] }), "accessible_toilet", entryOf([{}]));
    expect(noDup.evidence).toEqual(["restroom-1", "public-화장실-1"]);
  });

  it("accessible_toilet·diaper_nursing이 아닌 항목은 그대로 둔다", () => {
    const elevator = aiItem("모름");
    expect(mergePublic(elevator, "elevator", entryOf([{ 기저귀교환대유무: "Y" }]))).toBe(elevator);
  });

  it("장애인 칸 화장실이 여러 곳이면 칸이 가장 많은 곳(같으면 이름 가나다순)을 대표로 하고 '외 N곳'을 붙인다", () => {
    const rows: Rows = [
      { 관리번호: "1", 화장실명: "강문해변 서쪽", 소재지도로명주소: "강릉시 가" },
      { 관리번호: "2", 화장실명: "강문해변 동쪽", 소재지도로명주소: "강릉시 나" },
      { 관리번호: "3", 화장실명: "강문해변 남쪽", "여성용-장애인용대변기수": "0", 소재지도로명주소: "강릉시 다" },
    ];
    const merged = mergePublic(aiItem("모름"), "accessible_toilet", entryOf(rows));
    expect(merged.note).toBe("공중화장실 '강문해변 동쪽' · 장애인 칸 2 · 외 2곳");
  });

  it("기저귀 교환대 Y면 diaper_nursing 가능, 위치 문구와 '수유실 정보 없음'이 메모에 붙는다", () => {
    const texts: [string, string][] = [
      ["여자화장실", "여자화장실에만"],
      ["남자화장실", "남자화장실에만"],
      ["남자화장실+여자화장실", "남녀 화장실 모두"],
      ["", "위치 정보 없음"],
    ];
    for (const [place, phrase] of texts) {
      const entry = entryOf([{ 기저귀교환대유무: "Y", 기저귀교환대장소: place }]);
      const merged = mergePublic(aiItem("모름"), "diaper_nursing", entry);
      expect(merged).toMatchObject({ value: "가능", grade: "public", method: "공공데이터", verified_at: "2024-12-31" });
      expect(merged.note).toBe(`기저귀 교환대 · 공중화장실 '강문해변' ${phrase} · 수유실 정보 없음`);
      expect(merged.source_url).toBe(PUBLIC_RESTROOM_SOURCE.url);
      expect("ask" in merged).toBe(false);
    }
  });

  it("기저귀 대표는 남자화장실이 들어간 위치 우선(남녀 모두 > 남자만 > 여자만 > 빈칸), 외 N곳을 붙인다", () => {
    const rows: Rows = [
      { 관리번호: "1", 화장실명: "강문해변 가", "남성용-장애인용대변기수": "3", 기저귀교환대유무: "Y", 기저귀교환대장소: "여자화장실", 소재지도로명주소: "강릉시 가" },
      { 관리번호: "2", 화장실명: "강문해변 나", "남성용-장애인용대변기수": "0", "여성용-장애인용대변기수": "0", 기저귀교환대유무: "Y", 기저귀교환대장소: "남자화장실+여자화장실", 소재지도로명주소: "강릉시 나" },
    ];
    const entry = entryOf(rows);
    const merged = mergePublic(aiItem("모름"), "diaper_nursing", entry);
    expect(merged.note).toBe("기저귀 교환대 · 공중화장실 '강문해변 나' 남녀 화장실 모두 · 외 1곳 · 수유실 정보 없음");
    expect(merged.evidence).toEqual([entry.restrooms.find((r) => r.name === "강문해변 나")!.evidence_id]);
  });

  it("AI diaper 값이 가능이면 '수유실 정보 없음'을 붙이지 않고 관광공사 메모(수유실)를 남긴다", () => {
    const ai = aiItem("가능", { note: "수유실 있음", evidence: ["info-수유실-1"] });
    const merged = mergePublic(ai, "diaper_nursing", entryOf([{ 기저귀교환대유무: "Y", 기저귀교환대장소: "여자화장실" }]));
    expect(merged.note).toBe("기저귀 교환대 · 공중화장실 '강문해변' 여자화장실에만 / 관광공사: 수유실 있음");
    expect(merged.note).not.toContain("수유실 정보 없음");
    expect(merged.evidence).toEqual(["info-수유실-1", "public-화장실-1"]);
  });

  it("합친 diaper·화장실 값은 모두 장소 데이터 검사를 통과한다", () => {
    const entry = entryOf([{ 기저귀교환대유무: "Y", 기저귀교환대장소: "여자화장실" }]);
    const places = loadSamplePlaces();
    places[0].access.accessible_toilet = mergePublic(aiItem("모름"), "accessible_toilet", entry);
    places[0].access.diaper_nursing = mergePublic(aiItem("모름"), "diaper_nursing", entry);
    expect(validatePlaces(places)).toEqual({ ok: true, issues: [] });
  });
});

describe("근거 문단·칸 정리(D-07)", () => {
  it("근거 id는 있음 화장실에만, 목록 순서(칸 합 많은 순 → 기저귀 Y 먼저 → 이름순)대로 붙는다. 0칸·N은 목록에 남지만 id·문단이 없다", () => {
    const rows: Rows = [
      { 관리번호: "1", 화장실명: "강문해변 가", "남성용-장애인용대변기수": "0", "여성용-장애인용대변기수": "0", 소재지도로명주소: "강릉시 가" },
      { 관리번호: "2", 화장실명: "강문해변 나", "남성용-장애인용대변기수": "0", "여성용-장애인용대변기수": "0", 기저귀교환대유무: "Y", 소재지도로명주소: "강릉시 나" },
      { 관리번호: "3", 화장실명: "강문해변 다", "남성용-장애인용대변기수": "1", "여성용-장애인용대변기수": "0", 소재지도로명주소: "강릉시 다" },
      { 관리번호: "4", 화장실명: "강문해변 라", "남성용-장애인용대변기수": "2", "여성용-장애인용대변기수": "0", 개방시간: "미개방", 소재지도로명주소: "강릉시 라" },
    ];
    const entry = entryOf(rows);
    expect(entry.restrooms.map((r) => [r.name, r.evidence_id])).toEqual([
      ["강문해변 라", undefined],
      ["강문해변 다", "public-화장실-1"],
      ["강문해변 나", "public-화장실-2"],
      ["강문해변 가", undefined],
    ]);
    expect(publicParagraphs(entry).map((p) => p.id)).toEqual(["public-화장실-1", "public-화장실-2"]);
  });

  it("칸 정리: 제어문자·꺾쇠·백틱·세로줄 제거, 연속 공백 하나로, 앞뒤 공백 제거, 60자에서 자른다", () => {
    const dirty = "  강문해변\u0007 <b>`x`|  화장실  ";
    const entry = entryOf([{ 화장실명: dirty }]);
    const name = entry.restrooms[0].name;
    expect(name).toBe("강문해변 bx 화장실");
    expect(name).not.toMatch(/[<>`|\u0000-\u001f]/);
    const long = entryOf([{ 화장실명: "강문해변" + "가".repeat(80) }]);
    expect(long.restrooms[0].name).toHaveLength(60);
  });

  it("숫자 칸이 숫자가 아니면 0, 기저귀는 정확히 'Y'만 true", () => {
    const entry = entryOf([
      { 관리번호: "1", "남성용-장애인용대변기수": "많음", "여성용-장애인용대변기수": "NaN", 기저귀교환대유무: "y", 소재지도로명주소: "강릉시 가" },
      { 관리번호: "2", 기저귀교환대유무: "Y", 소재지도로명주소: "강릉시 나" },
    ]);
    const bad = entry.restrooms.find((r) => r.no === "1")!;
    expect([bad.disabled_m, bad.disabled_f, bad.diaper]).toEqual([0, 0, false]);
    expect(entry.restrooms.find((r) => r.no === "2")!.diaper).toBe(true);
  });

  it("데이터기준일자가 yyyy-mm-dd가 아닌 3개 시 행은 버리고 skipped_rows로 센다", () => {
    const rows: Rows = [{ 관리번호: "1", 데이터기준일자: "2024/12/31" }, { 관리번호: "2", 데이터기준일자: "2024-13-45" }, { 관리번호: "3" }];
    const { file } = buildRestroomsFile(csv(rows), [GN27]);
    expect(file.places.GN27.restrooms.map((r) => r.no)).toEqual(["3"]);
    expect(file.source.skipped_rows).toBe(2);
  });

  it("저장하는 칸은 정해진 것뿐이다(전화번호·관리기관명·주소 없음)", () => {
    const [r] = entryOf([{}]).restrooms;
    expect(Object.keys(r).sort()).toEqual(
      ["date", "diaper", "diaper_place", "disabled_f", "disabled_m", "evidence_id", "kind", "name", "no", "open"].sort(),
    );
    const [nolisted] = entryOf([{ "남성용-장애인용대변기수": "0", "여성용-장애인용대변기수": "0" }]).restrooms;
    expect("evidence_id" in nolisted).toBe(false);
  });

  it("source 통계가 맞고, 다시 돌려도(장소 순서가 달라도) 같은 파일이 나온다", () => {
    const rows: Rows = [
      { 관리번호: "1" },
      { 관리번호: "2", 데이터기준일자: "2024-06-01" },
      { 관리번호: "3", 화장실명: "속초해변 화장실", 소재지도로명주소: "강원특별자치도 속초시 해맞이로 1", "남성용-장애인용대변기수": "0", "여성용-장애인용대변기수": "0", 기저귀교환대유무: "Y", 기저귀교환대장소: "여자화장실", 데이터기준일자: "2025-06-25" },
      { 관리번호: "4", 화장실명: "추암 촛대바위 화장실", 소재지도로명주소: "강원특별자치도 동해시 추암길 1", "여성용-장애인용대변기수": "0", 개방시간: "미개방", 데이터기준일자: "2024-05-01" },
      { 관리번호: "5", 화장실명: "서울 화장실", 소재지도로명주소: SEOUL_ROAD },
      { 관리번호: "6", 데이터기준일자: "2024/12/31", 소재지도로명주소: "강릉시 다른길" },
    ];
    const places = [
      { id: "DH01", name_ko: "추암 촛대바위", region: "동해" as const },
      { id: "SC01", name_ko: "속초해변", region: "속초" as const },
      GN27,
    ];
    const first = buildRestroomsFile(csv(rows), places).file;
    const again = buildRestroomsFile(csv(rows), [...places].reverse()).file;
    expect(JSON.stringify(again)).toBe(JSON.stringify(first));
    expect(Object.keys(first.places)).toEqual(["DH01", "GN27", "SC01"]);
    expect(first.source).toMatchObject({
      dataset: "전국공중화장실표준데이터",
      rows: 6,
      rows_3_cities: 5,
      by_city: { 강릉: 3, 속초: 1, 동해: 1 },
      unique_3_cities: 3,
      disabled_rows: 3,
      diaper_rows: 1,
      closed_rows: 1,
      skipped_rows: 1,
      dates: ["2024-05-01", "2024-06-01", "2024-12-31", "2025-06-25"],
      matched_places: 3,
      places_with_values: 2,
    });
  });
});

describe("근거 문서 줄(publicDocLines)", () => {
  it("있음 화장실이 없으면 빈 배열", () => {
    const entry = entryOf([{ "남성용-장애인용대변기수": "0", "여성용-장애인용대변기수": "0" }]);
    expect(publicDocLines(entry)).toEqual([]);
    expect(publicDocLines(undefined)).toEqual([]);
  });

  it("머리·출처 줄·안내 줄·문단 줄을 정해진 틀로 만든다", () => {
    const entry = entryOf([{}]);
    const lines = publicDocLines(entry);
    const text = lines.join("\n");
    expect(lines[0]).toBe("## 공공데이터 · 공중화장실");
    expect(text).toContain("행정안전부 「전국공중화장실표준데이터」");
    expect(text).toContain(PUBLIC_RESTROOM_SOURCE.url);
    expect(text).toContain("이용허락범위 제한 없음");
    expect(text).toContain("데이터 기준일 2024-12-31");
    expect(text).toContain("AI가 쓰지 않음");
    expect(text).toContain("이 목록에 없다고 관광지에 화장실이 없다는 뜻은 아니다");
    expect(text).toContain("- `public-화장실-1` (공공데이터·공중화장실) 화장실 '강문해변'");
  });
});
