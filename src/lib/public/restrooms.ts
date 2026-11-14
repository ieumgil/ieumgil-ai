// 전국공중화장실표준데이터(CSV) → 관광지별 화장실 요약 → 접근성 값 합치기.
// 순수 함수만 둔다(fs 없음). 파일 읽기·쓰기는 scripts/ 쪽에서 한다.
// LLM은 쓰지 않는다: CSV 값을 정해진 틀로 옮길 뿐이다(docs/ai-plan.md, CLAUDE.md 원칙 1).

import type { EvidenceItem } from "../ai/judge";
import type { AccessItem, AccessKey, Place, Region } from "../types";
import { PUBLIC_EVIDENCE_LABEL, PUBLIC_RESTROOM_SOURCE } from "./source";

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

/** 관광지 이름 짝짓기에 필요한 최소 글자 수 */
export const MIN_KEY_LENGTH = 3;

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
  rows: number;
  rows_3_cities: number;
  by_city: Record<Region, number>;
  unique_3_cities: number;
  disabled_rows: number;
  diaper_rows: number;
  closed_rows: number;
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

/** 큰따옴표 칸·"" 이스케이프·칸 안 쉼표·CRLF를 처리하는 작은 CSV 파서. 첫 줄은 열 이름. */
export function parseRestroomCsv(text: string): Record<string, string>[] {
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
    } else if (ch === '"') quoted = true;
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
  return lines.slice(1).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
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

function toRestroom(record: Record<string, string>): Restroom {
  return {
    no: record["관리번호"].trim(),
    name: record["화장실명"].trim(),
    kind: record["구분명"].trim(),
    disabled_m: Number(record["남성용-장애인용대변기수"]) || 0,
    disabled_f: Number(record["여성용-장애인용대변기수"]) || 0,
    diaper: record["기저귀교환대유무"].trim() === "Y",
    diaper_place: record["기저귀교환대장소"].trim(),
    open: record["개방시간"].trim(),
    date: record["데이터기준일자"].trim(),
  };
}

const hasToilet = (r: Restroom) => r.disabled_m + r.disabled_f >= 1;
const isListed = (r: Restroom) => hasToilet(r) || r.diaper;

export function buildRestroomsFile(
  csvText: string,
  places: Pick<Place, "id" | "name_ko" | "region">[],
): { file: RestroomsFile; excluded: ExcludedMatch[] } {
  const records = parseRestroomCsv(csvText);
  const rows = records
    .map((rec) => ({ city: cityOf(rec), restroom: toRestroom(rec) }))
    .filter((x): x is { city: Region; restroom: Restroom } => x.city !== undefined);

  const out: Record<string, PlaceRestrooms> = {};
  for (const place of [...places].sort((a, b) => a.id.localeCompare(b.id))) {
    const key = placeKey(place.name_ko);
    if (key.length < MIN_KEY_LENGTH) continue;
    const matched = rows
      .filter((x) => x.city === place.region && normalizeName(x.restroom.name).includes(key))
      .map((x) => ({ ...x.restroom }));
    if (matched.length === 0) continue;
    let n = 0;
    for (const r of matched) if (isListed(r)) r.evidence_id = `public-화장실-${++n}`;
    out[place.id] = { name_ko: place.name_ko, restrooms: matched };
  }

  const dates = [...new Set(rows.map((x) => x.restroom.date))].sort();
  const byCity: Record<Region, number> = { 강릉: 0, 속초: 0, 동해: 0 };
  for (const x of rows) byCity[x.city]++;
  const file: RestroomsFile = {
    source: {
      ...PUBLIC_RESTROOM_SOURCE,
      rows: records.length,
      rows_3_cities: rows.length,
      by_city: byCity,
      unique_3_cities: rows.length,
      disabled_rows: rows.filter((x) => hasToilet(x.restroom)).length,
      diaper_rows: rows.filter((x) => x.restroom.diaper).length,
      closed_rows: rows.filter((x) => x.restroom.open === "미개방").length,
      skipped_rows: 0,
      dates,
      matched_places: Object.keys(out).length,
      places_with_values: Object.values(out).filter((p) => p.restrooms.some((r) => r.evidence_id)).length,
    },
    places: out,
  };
  return { file, excluded: [] };
}

// ───────────────────────── 합치기 ─────────────────────────

/**
 * 공공데이터를 AI 값에 합친다(OR). 입력을 바꾸지 않는다.
 * 합칠 것이 있으면 새 객체, 없으면 입력 객체를 그대로(같은 참조) 돌려준다.
 */
export function mergePublic(item: AccessItem, key: AccessKey, entry: PlaceRestrooms | undefined): AccessItem {
  if (!entry || key !== "accessible_toilet") return item;
  const best = entry.restrooms.find((r) => r.evidence_id && hasToilet(r));
  if (!best) return item;
  return {
    value: "가능",
    note: `공중화장실 '${best.name}' · 장애인 칸 ${best.disabled_m + best.disabled_f}`,
    evidence: [best.evidence_id as string],
    grade: "public",
    method: "공공데이터",
    verified_at: best.date,
    source_url: PUBLIC_RESTROOM_SOURCE.url,
  };
}

// ───────────────────────── 근거 문단 ─────────────────────────

export function publicParagraphs(entry: PlaceRestrooms | undefined): EvidenceItem[] {
  if (!entry) return [];
  return entry.restrooms
    .filter((r) => r.evidence_id)
    .map((r) => ({
      id: r.evidence_id as string,
      label: PUBLIC_EVIDENCE_LABEL,
      text:
        `화장실 '${r.name}'${r.kind ? ` (${r.kind})` : ""} · 장애인용 대변기 남 ${r.disabled_m} · 여 ${r.disabled_f}` +
        ` · 기저귀 교환대 ${r.diaper ? `있음(${r.diaper_place || "위치 정보 없음"})` : "없음"}` +
        ` · 개방 ${r.open || "정보 없음"} · 데이터 기준일 ${r.date}`,
    }));
}
