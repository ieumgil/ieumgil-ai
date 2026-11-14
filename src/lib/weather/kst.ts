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

const compactToISO = (c: string) => `${c.slice(0, 4)}-${c.slice(4, 6)}-${c.slice(6, 8)}`;

/**
 * 한 칸 앞 발표. 발표 직후 서버에 아직 자료가 없을 때(결과 코드 03) 직전 발표로 한 번 다시 부르는 데 쓴다.
 * 순서는 공식 활용가이드의 base_time 표(02·05·08·11·14·17·20·23시)를 따른다(외부 블로그 값 아님).
 * 0200의 앞은 전날 2300.
 */
export function prevShortBase(b: ShortBase): ShortBase {
  const i = SHORT_BASE_TIMES.indexOf(b.baseTime);
  if (i > 0) return { baseDate: b.baseDate, baseTime: SHORT_BASE_TIMES[i - 1] };
  return { baseDate: addDaysISO(compactToISO(b.baseDate), -1).replace(/-/g, ""), baseTime: "2300" };
}

/**
 * 지금 부를 수 있는 가장 늦은 중기예보 발표 tmFc(YYYYMMDDHHMM, 06·18시). 가이드에는 발표 뒤 제공 지연 시각이 없어
 * 보수적으로 30분(marginMin)을 둔다 — 연구 A5 [ASSUMED]. 너무 이르면 03(자료 없음)이 나오고 서비스가 prevMidTmFc로 한 번 흡수한다.
 * 06:30 전은 전날 1800, 06:30~18:29는 당일 0600, 18:30부터 당일 1800.
 */
export function pickMidTmFc(now: Date, marginMin = 30): string {
  const k = kstParts(now);
  const minutes = k.getUTCHours() * 60 + k.getUTCMinutes();
  const today = toISO(k);
  if (minutes >= 18 * 60 + marginMin) return `${today.replace(/-/g, "")}1800`;
  if (minutes >= 6 * 60 + marginMin) return `${today.replace(/-/g, "")}0600`;
  return `${addDaysISO(today, -1).replace(/-/g, "")}1800`;
}

/** 한 칸 앞 중기 발표(재시도용): 0600의 앞은 전날 1800, 1800의 앞은 같은 날 0600 */
export function prevMidTmFc(tmFc: string): string {
  const date = tmFc.slice(0, 8);
  if (tmFc.slice(8) === "1800") return `${date}0600`;
  return `${addDaysISO(compactToISO(date), -1).replace(/-/g, "")}1800`;
}
