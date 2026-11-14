// 날씨 값의 모양과 클라이언트용 응답 검사. 기상청 원본이 아니라 서버가 정리한 "시 · 날짜별 하루 값"만 다룬다.
// 저장하지 않는다: 화면 메모리에서만 쓰고 sessionStorage·공유 문서·Supabase에는 넣지 않는다(D-04, 원칙 3).
// next/*·서버 모듈을 import하지 않는다(브라우저에서도 쓰인다).

import { REGIONS, type Region } from "../types";

export const SHORT_BASE_TIMES = ["0200", "0500", "0800", "1100", "1400", "1700", "2000", "2300"] as const;
export type ShortBaseTime = (typeof SHORT_BASE_TIMES)[number];

/** 단기예보 발표 시각(기상청 base_date·base_time, 한국 시간) */
export interface ShortBase {
  baseDate: string; // YYYYMMDD
  baseTime: ShortBaseTime;
}

/** 단기예보 응답 한 항목 중 쓰는 네 필드 */
export interface ShortItem {
  category: string;
  fcstDate: string; // YYYYMMDD
  fcstTime: string; // HHMM
  fcstValue: string;
}

/** 시 하나의 하루 값 */
export interface DayForecast {
  sky: 1 | 3 | 4 | null; // 맑음·구름많음·흐림
  precip: "비" | "눈" | "비/눈" | null;
  pop: number | null; // 강수확률 %
  tmin: number | null;
  tmax: number | null;
  source: "short" | "mid";
  approxTemp?: true;
}

export interface WeatherPayload {
  available: true;
  today: string; // 서버가 본 한국 날짜 YYYY-MM-DD
  asOf: { short?: ShortBase; mid?: string /* YYYYMMDDHHMM */ };
  regions: Partial<Record<Region, Record<string, DayForecast>>>;
}

export type WeatherResponse = WeatherPayload | { available: false };

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const temp = (v: unknown): number | null | undefined => {
  if (v === null) return null;
  return typeof v === "number" && Number.isFinite(v) && Math.abs(v) < 900 ? v : undefined;
};

function readDay(v: unknown): DayForecast | null {
  if (!isRecord(v)) return null;
  const { sky, precip, pop, tmin, tmax, source } = v;
  if (sky !== null && sky !== 1 && sky !== 3 && sky !== 4) return null;
  if (precip !== null && precip !== "비" && precip !== "눈" && precip !== "비/눈") return null;
  if (pop !== null && !(typeof pop === "number" && Number.isInteger(pop) && pop >= 0 && pop <= 100)) return null;
  const lo = temp(tmin);
  const hi = temp(tmax);
  if (lo === undefined || hi === undefined) return null;
  if (source !== "short" && source !== "mid") return null;
  return { sky, precip, pop, tmin: lo, tmax: hi, source, ...(v.approxTemp === true ? { approxTemp: true as const } : {}) };
}

function readShortBase(v: unknown): ShortBase | undefined {
  if (!isRecord(v) || typeof v.baseDate !== "string" || !/^\d{8}$/.test(v.baseDate)) return undefined;
  const time = SHORT_BASE_TIMES.find((t) => t === v.baseTime);
  return time ? { baseDate: v.baseDate, baseTime: time } : undefined;
}

/** /api/weather 응답을 다시 검사한다. 쓸 수 없는 응답은 null, 틀린 날 항목은 그 항목만 버린다 */
export function readPayload(json: unknown): WeatherPayload | null {
  if (!isRecord(json) || json.available !== true) return null;
  if (typeof json.today !== "string" || !DATE_KEY.test(json.today)) return null;
  if (!isRecord(json.regions)) return null;
  const asOfRaw = isRecord(json.asOf) ? json.asOf : {};
  const short = readShortBase(asOfRaw.short);
  const mid = typeof asOfRaw.mid === "string" && /^\d{12}$/.test(asOfRaw.mid) ? asOfRaw.mid : undefined;

  const regions: WeatherPayload["regions"] = {};
  for (const region of REGIONS) {
    const days = json.regions[region];
    if (!isRecord(days)) continue;
    const table: Record<string, DayForecast> = {};
    for (const [date, raw] of Object.entries(days)) {
      if (!DATE_KEY.test(date)) continue;
      const day = readDay(raw);
      if (day) table[date] = day;
    }
    regions[region] = table;
  }
  return { available: true, today: json.today, asOf: { ...(short ? { short } : {}), ...(mid ? { mid } : {}) }, regions };
}
