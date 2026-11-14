// 전국공중화장실표준데이터(CSV) → 관광지별 화장실 요약 → 접근성 값 합치기.
// 순수 함수만 둔다(fs 없음). 파일 읽기·쓰기는 scripts/ 쪽에서 한다.
// LLM은 쓰지 않는다: CSV 값을 정해진 틀로 옮길 뿐이다(docs/ai-plan.md, CLAUDE.md 원칙 1).
//
// 규칙 요약(.planning/phases/01-public-restrooms/01-CONTEXT.md):
// - 짝짓기(D-02): 화장실명에 관광지 이름(괄호 부분 제외, 공백·괄호·'·' 제거, 3글자 이상)이 들어가고 같은 시일 때만. 주소로는 짝짓지 않는다.
// - 합치기(D-03·D-04·D-05): 공공데이터는 '가능'으로만 올린다. 없다·0칸이어도 AI 값을 바꾸지 않는다. 사람 값(human)은 못 바꾼다.

import type { EvidenceItem } from "../ai/judge";
import type { AccessItem, AccessKey, Place, Region } from "../types";
import { PUBLIC_EVIDENCE_LABEL, PUBLIC_EVIDENCE_PREFIX, PUBLIC_RESTROOM_SOURCE } from "./source";

/** 원본에서 읽는 열. 전화번호·관리기관명 열은 읽지 않는다(필요한 칸만) */
export const REQUIRED_COLUMNS = [
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

export const CITY_OF: Record<string, Region> = { 강릉시: "강릉", 속초시: "속초", 동해시: "동해" };

/** 명백한 오탐: 화장실명에 '주유소'가 든 곳은 관광지 화장실이 아니다 */
export const EXCLUDE_RESTROOM_NAME = /주유소/;

/** 관광지 이름 짝짓기에 필요한 최소 글자 수 */
export const MIN_KEY_LENGTH = 3;

/** 개방시간 값 중 '있음'으로 세지 않는 것(불규칙은 센다) */
const CLOSED = "미개방";

/** 칸 하나의 최대 글자 수 */
const MAX_CELL = 60;

/** 기저귀 교환대 위치 → 화면 문구 */
export const DIAPER_PLACE_TEXT: Record<string, string> = {
  "남자화장실+여자화장실": "남녀 화장실 모두",
  남자화장실: "남자화장실에만",
  여자화장실: "여자화장실에만",
  "": "위치 정보 없음",
};

/** 기저귀 대표를 고를 때 위치 순위(작을수록 먼저: 아빠 혼자 아이와 다닐 수 있는 곳) */
export const DIAPER_PLACE_RANK: Record<string, number> = {
  "남자화장실+여자화장실": 0,
  남자화장실: 1,
  여자화장실: 2,
  "": 3,
};

export interface Restroom {
  no: string;
  name: string;
  kind: string;
  disabled_m: number;
  disabled_f: number;
  diaper: boolean;
  diaper_place: string;
  open: string;
  date: string;
  /** 있음(개방 + 장애인 칸 또는 기저귀 교환대)인 화장실에만 붙는 근거 문단 id */
  evidence_id?: string;
}

export interface PlaceRestrooms {
  name_ko: string;
  restrooms: Restroom[];
}

export interface RestroomsSource {
  dataset: string;
  provider: string;
  url: string;
  license: string;
  /** 파일의 전체 행 */
  rows: number;
  /** 소재지가 강릉시·속초시·동해시인 행(날짜가 틀려 버린 행 포함) */
  rows_3_cities: number;
  by_city: Record<Region, number>;
  /** 날짜가 맞는 3개 시 행에서 중복(같은 화장실명·도로명·지번)을 합친 뒤의 수 */
  unique_3_cities: number;
  /** 아래 세 수는 날짜가 맞는 3개 시 행(중복 합치기 전) 기준 */
  disabled_rows: number;
  diaper_rows: number;
  closed_rows: number;
  /** 데이터기준일자가 yyyy-mm-dd가 아니어서 버린 3개 시 행 */
  skipped_rows: number;
  dates: string[];
  matched_places: number;
  places_with_values: number;
}

export interface RestroomsFile {
  source: RestroomsSource;
  places: Record<string, PlaceRestrooms>;
}

export interface ExcludedMatch {
  placeId: string;
  restroom: string;
  reason: "주유소" | "다른 시";
}

// ───────────────────────── CSV 읽기 ─────────────────────────

export interface ParsedRestroomCsv {
  records: Record<string, string>[];
  /** 열 개수가 헤더와 달라 버린 행 수 */
  badRows: number;
  /** 버린 첫 행의 번호(헤더 줄이 1, 따옴표 칸 안 줄바꿈은 한 행으로 센다) */
  firstBadRow?: number;
}

/** 열 개수가 헤더와 다른 행을 버리고, 버린 수를 함께 돌려주는 CSV 읽기 */
export function parseRestroomCsvDetailed(text: string): ParsedRestroomCsv {
  const src = text.replace(/^﻿/, "");
  const table: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true; // 따옴표는 칸이 시작될 때만 연다(5" 배관 같은 칸 가운데 따옴표는 글자)
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      table.push(row);
      row = [];
    } else cell += ch;
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    table.push(row);
  }

  const lines = table.filter((r) => !(r.length === 1 && r[0].trim() === ""));
  if (lines.length === 0) throw new Error("CSV가 비어 있어요.");
  const header = lines[0].map((h) => h.trim());
  const missing = REQUIRED_COLUMNS.filter((c) => !header.includes(c));
  if (missing.length > 0) throw new Error(`CSV에 필요한 열이 없어요: ${missing.join(", ")}`);
  // 열 개수가 헤더와 다른 행은 칸이 밀렸을 수 있어 버린다(엉뚱한 열을 읽는 것보다 낫다). 버린 수는 호출한 쪽이 알린다.
  const body = lines.slice(1);
  const good = body.filter((r) => r.length === header.length);
  const firstBad = body.findIndex((r) => r.length !== header.length);
  return {
    records: good.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]]))),
    badRows: body.length - good.length,
    ...(firstBad >= 0 ? { firstBadRow: firstBad + 2 } : {}),
  };
}

/** 큰따옴표 칸·"" 이스케이프·칸 안 쉼표·CRLF를 처리하는 작은 CSV 파서. 첫 줄은 열 이름. 열 개수가 다른 행은 버린다. */
export function parseRestroomCsv(text: string): Record<string, string>[] {
  return parseRestroomCsvDetailed(text).records;
}

// ───────────────────────── 칸 정리 (믿지 않는 입력) ─────────────────────────

/** 제어문자·꺾쇠·백틱·세로줄 제거, 연속 공백 하나로, 앞뒤 공백 제거, 60자에서 자름 */
export function cleanCell(s: string): string {
  return s
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/[<>`|]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_CELL);
}

/** 숫자가 아니거나 음수면 0 */
function toCount(s: string): number {
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

/** yyyy-mm-dd이고 실제 있는 날짜 */
function isValidDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

// ───────────────────────── 이름 짝짓기 ─────────────────────────

/** 공백·괄호·'·' 제거 */
export function normalizeName(s: string): string {
  return s.replace(/[\s()（）·]/g, "");
}

/** 관광지 이름의 짝짓기 열쇠: 괄호 부분을 뺀 뒤 normalizeName */
export function placeKey(nameKo: string): string {
  return normalizeName(nameKo.replace(/[(（][^)）]*[)）]/g, ""));
}

function cityOf(record: Record<string, string>): Region | undefined {
  const addr = `${record["소재지도로명주소"]} ${record["소재지지번주소"]}`;
  for (const [city, region] of Object.entries(CITY_OF)) if (addr.includes(city)) return region;
  return undefined;
}

interface Row {
  city: Region;
  road: string;
  jibun: string;
  restroom: Restroom;
}

/** 저장 칸 화이트리스트만 옮긴다(전화번호·관리기관명·주소는 읽지 않음) */
function toRestroomRow(record: Record<string, string>): Row | undefined {
  const city = cityOf(record);
  if (!city) return undefined;
  return {
    city,
    road: cleanCell(record["소재지도로명주소"]),
    jibun: cleanCell(record["소재지지번주소"]),
    restroom: {
      no: cleanCell(record["관리번호"]),
      name: cleanCell(record["화장실명"]),
      kind: cleanCell(record["구분명"]),
      disabled_m: toCount(record["남성용-장애인용대변기수"]),
      disabled_f: toCount(record["여성용-장애인용대변기수"]),
      diaper: record["기저귀교환대유무"].trim() === "Y",
      diaper_place: cleanCell(record["기저귀교환대장소"]),
      open: cleanCell(record["개방시간"]),
      date: record["데이터기준일자"].trim(),
    },
  };
}

// 문자 코드 순서 비교(한글 음절은 가나다순). 실행 환경의 로케일에 따라 달라지지 않는다.
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const cmpNo = (a: string, b: string) => {
  const na = Number(a);
  const nb = Number(b);
  return Number.isFinite(na) && Number.isFinite(nb) && na !== nb ? na - nb : cmp(a, b);
};

const toiletCount = (r: Restroom) => r.disabled_m + r.disabled_f;
const hasToilet = (r: Restroom) => toiletCount(r) >= 1;
/** 개방시간이 미개방이 아님(불규칙은 센다) */
const isCounted = (r: Restroom) => r.open !== CLOSED;
/** 있음: 개방 + (장애인 칸 또는 기저귀 교환대) */
const isPresent = (r: Restroom) => isCounted(r) && (hasToilet(r) || r.diaper);

/** 같은 화장실명·도로명·지번이면 기준일이 늦은 행(같으면 관리번호가 큰 행)만 남긴다 */
function dedupeRows(rows: Row[]): Row[] {
  const kept = new Map<string, Row>();
  for (const row of rows) {
    const key = `${row.restroom.name}\u0000${row.road}\u0000${row.jibun}`;
    const old = kept.get(key);
    if (!old) {
      kept.set(key, row);
      continue;
    }
    const newer = cmp(row.restroom.date, old.restroom.date) || cmpNo(row.restroom.no, old.restroom.no);
    if (newer > 0) kept.set(key, row);
  }
  return [...kept.values()];
}

/** 목록 순서: 칸 합 많은 순 → 기저귀 Y 먼저 → 이름순 → 관리번호순 */
function sortRestrooms(list: Restroom[]): Restroom[] {
  return [...list].sort(
    (a, b) =>
      toiletCount(b) - toiletCount(a) ||
      Number(b.diaper) - Number(a.diaper) ||
      cmp(a.name, b.name) ||
      cmpNo(a.no, b.no),
  );
}

/** 있음 화장실에만 public-화장실-N을 순서대로 붙인다 */
function assignEvidenceIds(list: Restroom[]): Restroom[] {
  let n = 0;
  return list.map((r) => (isPresent(r) ? { ...r, evidence_id: `${PUBLIC_EVIDENCE_PREFIX}화장실-${++n}` } : { ...r }));
}

export function buildRestroomsFile(
  csvText: string,
  places: Pick<Place, "id" | "name_ko" | "region">[],
): { file: RestroomsFile; excluded: ExcludedMatch[]; badColumnRows: number; firstBadColumnRow?: number } {
  const { records, badRows: badColumnRows, firstBadRow: firstBadColumnRow } = parseRestroomCsvDetailed(csvText);
  const rows3 = records.map(toRestroomRow).filter((x): x is Row => x !== undefined);
  const valid = rows3.filter((x) => isValidDate(x.restroom.date));
  const unique = dedupeRows(valid);

  const byCity: Record<Region, number> = { 강릉: 0, 속초: 0, 동해: 0 };
  for (const x of rows3) byCity[x.city]++;

  const out: Record<string, PlaceRestrooms> = {};
  const excluded: ExcludedMatch[] = [];
  for (const place of [...places].sort((a, b) => cmp(a.id, b.id))) {
    const key = placeKey(place.name_ko);
    if (key.length < MIN_KEY_LENGTH) continue;
    const matched: Restroom[] = [];
    for (const row of unique) {
      if (!normalizeName(row.restroom.name).includes(key)) continue;
      if (EXCLUDE_RESTROOM_NAME.test(row.restroom.name)) {
        excluded.push({ placeId: place.id, restroom: row.restroom.name, reason: "주유소" });
      } else if (row.city !== place.region) {
        excluded.push({ placeId: place.id, restroom: row.restroom.name, reason: "다른 시" });
      } else matched.push(row.restroom);
    }
    if (matched.length === 0) continue;
    out[place.id] = { name_ko: place.name_ko, restrooms: assignEvidenceIds(sortRestrooms(matched)) };
  }

  const file: RestroomsFile = {
    source: {
      ...PUBLIC_RESTROOM_SOURCE,
      rows: records.length,
      rows_3_cities: rows3.length,
      by_city: byCity,
      unique_3_cities: unique.length,
      disabled_rows: valid.filter((x) => hasToilet(x.restroom)).length,
      diaper_rows: valid.filter((x) => x.restroom.diaper).length,
      closed_rows: valid.filter((x) => x.restroom.open === CLOSED).length,
      skipped_rows: rows3.length - valid.length,
      dates: [...new Set(valid.map((x) => x.restroom.date))].sort(),
      matched_places: Object.keys(out).length,
      places_with_values: Object.values(out).filter((p) => p.restrooms.some((r) => r.evidence_id)).length,
    },
    places: out,
  };
  return { file, excluded, badColumnRows, ...(firstBadColumnRow !== undefined ? { firstBadColumnRow } : {}) };
}

// ───────────────────────── 합치기 ─────────────────────────

/** '여자화장실+남자화장실' 같은 순서·공백 차이를 원본 표기로 맞춘다. 모르는 값은 빈칸으로 본다 */
function canonicalPlace(text: string): string {
  const t = text.replace(/\s/g, "");
  const male = t.includes("남자");
  const female = t.includes("여자");
  if (male && female) return "남자화장실+여자화장실";
  if (male) return "남자화장실";
  if (female) return "여자화장실";
  return "";
}

/** 값 하나에 공공데이터를 합친 새 항목. 키 순서: value, note, evidence, grade, method, verified_at, source_url */
function publicItem(ai: AccessItem, note: string, rep: Restroom): AccessItem {
  const keepAi = ai.value === "가능";
  const evidence = [...(keepAi ? (ai.evidence ?? []) : []), rep.evidence_id as string];
  return {
    value: "가능",
    note,
    evidence: [...new Set(evidence)],
    grade: "public",
    method: "공공데이터",
    verified_at: rep.date,
    source_url: PUBLIC_RESTROOM_SOURCE.url,
  };
}

/** AI 값이 이미 가능이었으면 관광공사 메모를 뒤에 남긴다 */
const legacyNote = (ai: AccessItem) => (ai.value === "가능" && ai.note?.trim() ? ` / 관광공사: ${ai.note.trim()}` : "");
const moreNote = (count: number) => (count > 1 ? ` · 외 ${count - 1}곳` : "");

/**
 * 공공데이터를 AI 값에 합친다(OR). 입력을 바꾸지 않는다.
 * 합칠 것이 있으면 새 객체, 없으면 입력 객체를 그대로(같은 참조) 돌려준다.
 * 사람이 확인한 값(human)은 바꾸지 않는다(D-04).
 */
export function mergePublic(item: AccessItem, key: AccessKey, entry: PlaceRestrooms | undefined): AccessItem {
  if (!entry || item.grade === "human") return item;

  if (key === "accessible_toilet") {
    const found = entry.restrooms.filter((r) => r.evidence_id && hasToilet(r));
    if (found.length === 0) return item;
    const rep = [...found].sort((a, b) => toiletCount(b) - toiletCount(a) || cmp(a.name, b.name) || cmpNo(a.no, b.no))[0];
    const note = `공중화장실 '${rep.name}' · 장애인 칸 ${toiletCount(rep)}${moreNote(found.length)}${legacyNote(item)}`;
    return publicItem(item, note, rep);
  }

  if (key === "diaper_nursing") {
    const found = entry.restrooms.filter((r) => r.evidence_id && r.diaper);
    if (found.length === 0) return item;
    const rank = (r: Restroom) => DIAPER_PLACE_RANK[canonicalPlace(r.diaper_place)];
    const rep = [...found].sort(
      (a, b) => rank(a) - rank(b) || toiletCount(b) - toiletCount(a) || cmp(a.name, b.name) || cmpNo(a.no, b.no),
    )[0];
    const where = DIAPER_PLACE_TEXT[canonicalPlace(rep.diaper_place)];
    // 공공데이터에는 수유실이 없다: 있다고 지어내지 않고, 관광공사가 말한 수유실도 지우지 않는다
    const tail = item.value === "가능" ? legacyNote(item) : " · 수유실 정보 없음";
    const note = `기저귀 교환대 · 공중화장실 '${rep.name}' ${where}${moreNote(found.length)}${tail}`;
    return publicItem(item, note, rep);
  }

  return item;
}

// ───────────────────────── 근거 문단 ─────────────────────────

/** 문단 글: CSV 값을 정해진 틀로 옮긴다(LLM이 쓰지 않음) */
function paragraphText(r: Restroom): string {
  return (
    `화장실 '${r.name}'${r.kind ? ` (${r.kind})` : ""} · 장애인용 대변기 남 ${r.disabled_m} · 여 ${r.disabled_f}` +
    ` · 기저귀 교환대 ${r.diaper ? `있음(${r.diaper_place || "위치 정보 없음"})` : "없음"}` +
    ` · 개방 ${r.open || "정보 없음"} · 데이터 기준일 ${r.date}`
  );
}

export function publicParagraphs(entry: PlaceRestrooms | undefined): EvidenceItem[] {
  if (!entry) return [];
  return entry.restrooms
    .filter((r) => r.evidence_id)
    .map((r) => ({ id: r.evidence_id as string, label: PUBLIC_EVIDENCE_LABEL, text: paragraphText(r) }));
}

/** data/docs/places/{id}.md에 덧붙일 줄. 있음 화장실이 없으면 빈 배열 */
export function publicDocLines(
  entry: PlaceRestrooms | undefined,
  source: Pick<typeof PUBLIC_RESTROOM_SOURCE, "provider" | "dataset" | "url" | "license"> = PUBLIC_RESTROOM_SOURCE,
): string[] {
  const paragraphs = publicParagraphs(entry);
  if (!entry || paragraphs.length === 0) return [];
  const dates = [...new Set(entry.restrooms.filter((r) => r.evidence_id).map((r) => r.date))].sort();
  return [
    "## 공공데이터 · 공중화장실",
    `출처: ${source.provider} 「${source.dataset}」 · ${source.url} · ${source.license} · 데이터 기준일 ${dates.join(", ")}`,
    "아래 문단은 위 공공데이터 값을 코드가 그대로 옮긴 것이다(AI가 쓰지 않음). 이 목록에 없다고 관광지에 화장실이 없다는 뜻은 아니다.",
    ...paragraphs.map((p) => `- \`${p.id}\` (${p.label}) ${p.text}`),
  ];
}
