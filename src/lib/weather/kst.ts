// 한국 시간(KST, UTC+9) 날짜·시각 계산. 모두 now를 인자로 받는 순수 함수다.
// 기기·서버의 시간대(toLocaleString)에 기대지 않는다: now의 epoch에 9시간을 더한 뒤 getUTC*로 읽는다(서버는 UTC, 사용자는 해외일 수 있다).
// 날짜 문자열 계산은 src/lib/plan/dates.ts와 같이 yyyy-mm-dd + UTC 자정 방식이다.

import { SHORT_BASE_TIMES, type ShortBase } from "./types";

export { SHORT_BASE_TIMES };

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 86_400_000;

const pad = (n: number) => String(n).padStart(2, "0");
const kstParts = (now: Date) => new Date(now.getTime() + KST_OFFSET_MS);

function parseISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toISO(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** 한국 날짜 YYYY-MM-DD */
export function kstDate(now: Date): string {
  return toISO(kstParts(now));
}

/** 한국 시각의 시(0~23) */
export function kstHour(now: Date): number {
  return kstParts(now).getUTCHours();
}

export function addDaysISO(iso: string, n: number): string {
  return toISO(new Date(parseISO(iso).getTime() + n * DAY_MS));
}

/** to - from (일) */
export function daysBetweenISO(from: string, to: string): number {
  return Math.round((parseISO(to).getTime() - parseISO(from).getTime()) / DAY_MS);
}

/**
 * 지금 부를 수 있는 가장 늦은 단기예보 발표(02·05·08·11·14·17·20·23시).
 * 가이드: 발표 +10분부터 제공 → 여유(marginMin, 기본 15분)를 두고 고른다. 02:15 전이면 전날 2300.
 */
export function pickShortBase(now: Date, marginMin = 15): ShortBase {
  const k = kstParts(now);
  const minutes = k.getUTCHours() * 60 + k.getUTCMinutes();
  const today = toISO(k);
  for (let i = SHORT_BASE_TIMES.length - 1; i >= 0; i--) {
    const slot = SHORT_BASE_TIMES[i];
    if (minutes >= Number(slot.slice(0, 2)) * 60 + marginMin) return { baseDate: today.replace(/-/g, ""), baseTime: slot };
  }
  return { baseDate: addDaysISO(today, -1).replace(/-/g, ""), baseTime: "2300" };
}
