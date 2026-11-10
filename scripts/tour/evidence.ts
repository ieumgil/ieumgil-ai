// 관광공사 원본 한 곳 → 근거 문단 목록. 문단 id는 places.schema.json의 evidence 형식(route-1, info-화장실-1)을 따른다.
// build-places.ts(근거 문서 생성)와 read-places.ts(① 읽기 입력)가 같은 함수를 써서 id가 어긋나지 않게 한다.

import { readFileSync } from "node:fs";

export type TourItem = Record<string, string | number>;

// 관광공사 분류체계 이름(lclsSystmCode2로 받아 둔 표)
let classNames: Record<string, string> | undefined;
function className(code: string): string {
  classNames ??= JSON.parse(readFileSync("data/tour-classes.json", "utf8")) as Record<string, string>;
  return classNames[code] ?? code;
}

/** 층이 없는 야외 시설로 보는 분류: 자연관광(NA) 전체, 도시공원(VE03) */
export const isOutdoorClass = (code: string) => /^NA|^VE03/.test(code);

export interface RawPlace {
  fetchedAt: string;
  city: string;
  list: TourItem;
  common: TourItem | null;
  intro: TourItem | null;
  info: TourItem[];
  images: TourItem[];
  withTour: TourItem | null;
}

export interface EvidenceItem {
  id: string;
  label: string;
  text: string;
}

export const cleanText = (v: unknown) =>
  String(v ?? "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

// 무장애 상세: 우리 판단에 쓰는 필드(시각·청각 전용 필드는 근거로 쓰지 않음)
const WITH_TOUR: [string, string][] = [
  ["parking", "주차"],
  ["route", "접근로"],
  ["exit", "출입통로"],
  ["elevator", "엘리베이터"],
  ["restroom", "화장실"],
  ["wheelchair", "휠체어"],
  ["handicapetc", "지체장애 기타"],
  ["auditorium", "관람석"],
  ["publictransport", "대중교통"],
  ["stroller", "유모차"],
  ["lactationroom", "수유실"],
  ["babysparechair", "유아용 보조의자"],
  ["infantsfamilyetc", "영유아가족 기타"],
];

// 소개정보: 관광지(12)와 문화시설(14)은 필드 이름이 다르다(usetime / usetimeculture)
const INTRO: [string, string, string][] = [
  ["usetime", "usetimeculture", "이용시간"],
  ["restdate", "restdateculture", "쉬는 날"],
  ["useseason", "", "이용 시기"],
  ["spendtime", "", "관람 소요시간"],
  ["parking", "parkingculture", "주차(소개)"],
  ["chkbabycarriage", "chkbabycarriageculture", "유모차 대여(소개)"],
  ["usefee", "", "이용 요금"],
];

/** 문장이 너무 길면 나눈다(개요). 한 문단 300자 안팎 */
function splitSentences(text: string, max = 300): string[] {
  const parts = text.split(/(?<=[.!?。])\s+/);
  const out: string[] = [];
  let cur = "";
  for (const s of parts) {
    if ((cur + " " + s).trim().length > max && cur) {
      out.push(cur.trim());
      cur = s;
    } else cur = `${cur} ${s}`;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

export function buildEvidence(p: RawPlace): EvidenceItem[] {
  const out: EvidenceItem[] = [];
  const cls = String(p.common?.lclsSystm3 ?? p.list.lclsSystm3 ?? "");
  if (cls) out.push({ id: "class-1", label: "관광공사 분류", text: `${className(cls)} (${cls})${isOutdoorClass(cls) ? " · 야외 시설" : ""}` });
  const w = p.withTour ?? {};
  for (const [key, label] of WITH_TOUR) {
    const t = cleanText(w[key]);
    if (t) out.push({ id: `${key}-1`, label: `무장애·${label}`, text: t });
  }
  const intro = p.intro ?? {};
  for (const [a, b, label] of INTRO) {
    const t = cleanText(intro[a] ?? (b ? intro[b] : ""));
    if (t) out.push({ id: `intro-${a}-1`, label, text: t });
  }
  const infoCount: Record<string, number> = {};
  for (const i of p.info) {
    const name = cleanText(i.infoname).replace(/\s/g, "");
    const t = cleanText(i.infotext);
    if (!name || !t) continue;
    infoCount[name] = (infoCount[name] ?? 0) + 1;
    out.push({ id: `info-${name}-${infoCount[name]}`, label: `안내·${name}`, text: t });
  }
  splitSentences(cleanText(p.common?.overview))
    .slice(0, 6)
    .forEach((t, n) => out.push({ id: `overview-${n + 1}`, label: "개요", text: t }));
  return out;
}
