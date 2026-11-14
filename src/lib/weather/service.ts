// 날씨 묶음 만들기(서버 전용). 3개 시의 단기예보를 불러 날짜별 하루 값 표로 정리한다.
// D-04: 저장하지 않는다. 서버에서만 짧게 캐시한다('use cache' + cacheLife, 1시간 안쪽).
//   캐시 키 = 함수 인자(격자 + 발표 시각)라서 새 발표가 나오면 키가 바뀌어 따로 지울 필요가 없다.
//   실패는 throw 그대로 둔다(null을 돌려주면 실패가 캐시에 굳는다).
// 'use cache' 안에서는 요청 정보(cookies·headers 등)를 읽지 않는다 — 시각은 라우트가 구해 인자로 내려 준다.

import { cacheLife } from "next/cache";
import { REGIONS, type Region } from "../types";
import { fetchShort } from "./kma";
import { kstDate, pickShortBase } from "./kst";
import { WEATHER_REGIONS } from "./regions";
import { summarizeShort } from "./summary";
import type { DayForecast, ShortItem, WeatherResponse } from "./types";

export interface WeatherDeps {
  short(nx: number, ny: number, baseDate: string, baseTime: string): Promise<ShortItem[]>;
}

async function shortCached(nx: number, ny: number, baseDate: string, baseTime: string): Promise<ShortItem[]> {
  "use cache";
  cacheLife({ stale: 300, revalidate: 1800, expire: 3600 });
  return fetchShort(nx, ny, { baseDate, baseTime });
}

export const cachedDeps: WeatherDeps = { short: shortCached };

/**
 * 로그에 남길 오류 코드. 'use cache'를 지나면 Error 클래스와 code 필드가 사라지고 message만 남으므로,
 * KmaError의 고정 문장("기상청 응답 오류(코드)")에서 코드만 꺼낸다. 모르는 모양이면 "ERROR"(원문은 찍지 않는다).
 */
function errorCode(reason: unknown): string {
  const msg = reason instanceof Error ? reason.message : "";
  return /^기상청 응답 오류\(([A-Za-z0-9_]{1,12})\)$/.exec(msg)?.[1] ?? "ERROR";
}

/** 시마다 따로 불러, 실패한 시는 빼고 돌려준다. 하나도 못 받으면 { available: false } */
export async function buildWeatherPayload(now: Date, deps: WeatherDeps): Promise<WeatherResponse> {
  const base = pickShortBase(now);
  const results = await Promise.allSettled(
    REGIONS.map((r) => deps.short(WEATHER_REGIONS[r].nx, WEATHER_REGIONS[r].ny, base.baseDate, base.baseTime)),
  );
  const regions: Partial<Record<Region, Record<string, DayForecast>>> = {};
  results.forEach((res, i) => {
    if (res.status === "fulfilled") regions[REGIONS[i]] = summarizeShort(res.value);
    // 실패는 코드만 남긴다(요청 URL·키·Error 객체는 찍지 않는다 — 원칙 4)
    else console.warn("[weather] 기상청 호출 실패", REGIONS[i], errorCode(res.reason));
  });
  if (Object.keys(regions).length === 0) return { available: false };
  return { available: true, today: kstDate(now), asOf: { short: base }, regions };
}
