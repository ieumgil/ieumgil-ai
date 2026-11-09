// 날짜 계산. 시간대 문제를 피하려고 yyyy-mm-dd 문자열과 UTC 자정 기준 Date만 쓴다.

export const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;
/** 최대 2박 3일 */
export const MAX_NIGHTS = 2;

const pad = (n: number) => String(n).padStart(2, "0");

export function toISO(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function parse(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** 로컬(사용자 기기) 기준 오늘 */
export function todayISO(now = new Date()): string {
  return toISO(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function nightsBetween(start: string, end: string): number {
  return Math.round((parse(end).getTime() - parse(start).getTime()) / 86_400_000);
}

export function weekdayOf(iso: string): (typeof WEEKDAYS)[number] {
  return WEEKDAYS[parse(iso).getUTCDay()];
}

/** "11월 21일(토)" */
export function formatDay(iso: string): string {
  const d = parse(iso);
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일(${weekdayOf(iso)})`;
}

/** "11월 21일(토) ~ 22일(일)", 달이 바뀌면 "11월 30일(월) ~ 12월 1일(화)" */
export function formatRange(start: string, end: string): string {
  if (start === end) return formatDay(start);
  const s = parse(start);
  const e = parse(end);
  const tail =
    s.getUTCMonth() === e.getUTCMonth() ? `${e.getUTCDate()}일(${weekdayOf(end)})` : formatDay(end);
  return `${formatDay(start)} ~ ${tail}`;
}

export function tripLabel(nights: number): string {
  return nights === 0 ? "당일" : `${nights}박 ${nights + 1}일`;
}

/**
 * 달력 칸 만들기(일요일 시작). 빈 칸은 null.
 * month는 1~12.
 */
export function monthCells(year: number, month: number): (string | null)[] {
  const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: (string | null)[] = Array(first).fill(null);
  for (let d = 1; d <= days; d++) cells.push(toISO(year, month, d));
  while (cells.length % 7) cells.push(null);
  return cells;
}

export type RangePick =
  | { start: string; end: string; warning?: undefined }
  | { start: string | null; end: string | null; warning: "too-long" };

/**
 * 날짜를 눌렀을 때 새 범위.
 * - 범위가 없거나 이미 끝이 정해져 있으면: 누른 날이 새 시작(끝 = 같은 날, 당일)
 * - 시작만 있고 누른 날이 시작보다 뒤면: 끝으로 정함(최대 2박)
 * - 시작보다 앞이면: 새 시작
 */
export function pickDate(cur: { start: string | null; end: string | null }, day: string): RangePick {
  const { start, end } = cur;
  const choosingEnd = start !== null && end === start;
  if (!choosingEnd || day < start) return { start: day, end: day };
  if (day === start) return { start: day, end: day };
  if (nightsBetween(start, day) > MAX_NIGHTS) return { start, end, warning: "too-long" };
  return { start, end: day };
}
