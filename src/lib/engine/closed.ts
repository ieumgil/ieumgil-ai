// 휴무 판정. 데이터의 휴무일은 관광공사 문장을 정리한 글자(예: "1월 1일", "설날", "추석 당일", "매주 월요일")라
// 날짜표로 해석한다. 해석하지 못한 글자는 '휴무일 확인 필요' 경고로 돌린다(빼지 않음).

import { weekdayOf } from "../plan/dates";
import type { PlaceHours } from "../types";

// 설·추석(음력) 날짜표. 연휴는 당일 앞뒤 하루.
const LUNAR: Record<"설" | "추석", string[]> = {
  설: ["2026-02-17", "2027-02-07"],
  추석: ["2026-09-25", "2027-09-15"],
};

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** 휴무일 글자 하나가 이 날짜에 해당하는지. null = 해석 못 함 */
export function matchesClosedText(text: string, date: string): boolean | null {
  const t = text.replace(/\s/g, "");
  const iso = t.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[0] === date;
  const md = t.match(/^(\d{1,2})월(\d{1,2})일/);
  if (md) return Number(md[1]) === Number(date.slice(5, 7)) && Number(md[2]) === Number(date.slice(8, 10));
  for (const name of ["설", "추석"] as const) {
    if (t.startsWith(name)) {
      const days = LUNAR[name];
      const holiday = t.includes("연휴") ? days.flatMap((d) => [addDays(d, -1), d, addDays(d, 1)]) : days;
      // "오죽헌만 개방, 실내 전시실 휴관"처럼 일부만 닫는 경우도 휴무로 본다(보수적)
      return holiday.includes(date);
    }
  }
  return null;
}

export interface ClosedResult {
  closed: boolean;
  reason?: string;
  /** 해석하지 못한 휴무일 글자(경고용) */
  unknown: string[];
}

export function closedOn(hours: PlaceHours, date: string): ClosedResult {
  const wd = weekdayOf(date);
  if (hours.closed_weekdays?.includes(wd)) return { closed: true, reason: `매주 ${wd}요일 휴무`, unknown: [] };
  const unknown: string[] = [];
  for (const text of hours.closed_dates ?? []) {
    const m = matchesClosedText(text, date);
    if (m) return { closed: true, reason: `휴무(${text})`, unknown: [] };
    if (m === null) unknown.push(text);
  }
  return { closed: false, unknown };
}

/** 하절기(3~10월) / 동절기(11~2월) */
export const seasonOf = (date: string): "summer" | "winter" => {
  const m = Number(date.slice(5, 7));
  return m >= 3 && m <= 10 ? "summer" : "winter";
};
