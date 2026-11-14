// 공중화장실 공공데이터(행정안전부 전국공중화장실표준데이터) 짝짓기·합치기 규칙.
// 가짜 CSV·가짜 장소만 쓴다(실제 원본 파일은 읽지 않는다).
import { describe, expect, it } from "vitest";
import { buildRestroomsFile, mergePublic, publicParagraphs } from "@/lib/public/restrooms";
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
