// 날씨 묶음 만들기(서버 전용). 3개 시의 단기예보를 불러 날짜별 하루 값 표로 정리한다.
// D-04: 저장하지 않는다. 서버에서만 짧게 캐시한다('use cache' + cacheLife, 1시간 안쪽).
//   캐시 키 = 함수 인자(격자 + 발표 시각)라서 새 발표가 나오면 키가 바뀌어 따로 지울 필요가 없다.
//   실패는 throw 그대로 둔다(null을 돌려주면 실패가 캐시에 굳는다).
// 'use cache' 안에서는 요청 정보(cookies·headers 등)를 읽지 않는다 — 시각은 라우트가 구해 인자로 내려 준다.
// 발표 직후 자료가 아직 없으면(결과 코드 03) 시마다 직전 발표로 딱 한 번만 다시 부른다(T-02-10: 호출을 늘리지 않는다).

import { cacheLife } from "next/cache";
import { REGIONS, type Region } from "../types";
import { fetchShort, KmaError } from "./kma";
import { kstDate, pickShortBase, prevShortBase } from "./kst";
import { WEATHER_REGIONS } from "./regions";
import { summarizeShort } from "./summary";
import type { DayForecast, ShortBase, ShortItem, WeatherResponse } from "./types";

export interface WeatherDeps {
  short(nx: number, ny: number, baseDate: string, baseTime: string): Promise<ShortItem[]>;
}

/** 로그·판정에 쓸 오류 코드: 'use cache'를 지나면 Error 클래스와 code 필드가 사라지므로 고정 문장에서도 꺼낸다 */
function errorCode(reason: unknown): string {
  if (reason instanceof KmaError) return reason.code;
  const msg = reason instanceof Error ? reason.message : "";
  return /^기상청 응답 오류\(([A-Za-z0-9_]{1,12})\)$/.exec(msg)?.[1] ?? "ERROR";
}

const NO_DATA = "03";

async function shortCached(nx: number, ny: number, baseDate: string, baseTime: string): Promise<ShortItem[]> {
  "use cache";
  try {
    const items = await fetchShort(nx, ny, { baseDate, baseTime });
    cacheLife({ stale: 300, revalidate: 1800, expire: 3600 });
    return items;
  } catch (e) {
    // 운영 서버에서는 'use cache' 밖으로 나온 오류가 한 번 감싸여 코드를 읽을 수 없다 → '데이터 없음'만은 값(빈 배열)으로 내보낸다.
    // 곧 자료가 올라올 수 있으니 짧게만 캐시한다. 그 밖의 실패(키 오류·한도·네트워크)는 throw 그대로라 캐시에 굳지 않는다.
    if (errorCode(e) === NO_DATA) {
      cacheLife({ stale: 30, revalidate: 60, expire: 120 });
      return [];
    }
    throw e;
  }
}

export const cachedDeps: WeatherDeps = { short: shortCached };

/** 한 시의 예보를 부른다. 데이터 없음(03)이면 직전 발표로 한 번만 다시 부르고, 실제로 쓴 발표를 함께 돌려준다 */
async function loadShort(deps: WeatherDeps, nx: number, ny: number, base: ShortBase): Promise<{ items: ShortItem[]; used: ShortBase }> {
  let first: ShortItem[] | null = null;
  try {
    first = await deps.short(nx, ny, base.baseDate, base.baseTime);
  } catch (e) {
    if (errorCode(e) !== NO_DATA) throw e; // 키 오류·호출 한도·네트워크 오류는 재시도하지 않는다
  }
  if (first && first.length > 0) return { items: first, used: base };
  const prev = prevShortBase(base);
  const items = await deps.short(nx, ny, prev.baseDate, prev.baseTime);
  if (items.length === 0) throw new KmaError(NO_DATA);
  return { items, used: prev };
}

const baseKey = (b: ShortBase) => b.baseDate + b.baseTime;

/** 시마다 따로 불러, 실패한 시는 빼고 돌려준다. 하나도 못 받으면 { available: false } */
export async function buildWeatherPayload(now: Date, deps: WeatherDeps): Promise<WeatherResponse> {
  const base = pickShortBase(now);
  const today = kstDate(now);
  const results = await Promise.allSettled(REGIONS.map((r) => loadShort(deps, WEATHER_REGIONS[r].nx, WEATHER_REGIONS[r].ny, base)));
  const regions: Partial<Record<Region, Record<string, DayForecast>>> = {};
  let latest: ShortBase | null = null;
  results.forEach((res, i) => {
    if (res.status === "fulfilled") {
      regions[REGIONS[i]] = summarizeShort(res.value.items);
      if (!latest || baseKey(res.value.used) > baseKey(latest)) latest = res.value.used;
    } else {
      // 실패는 코드만 남긴다(요청 URL·키·Error 객체는 찍지 않는다 — 원칙 4)
      console.warn("[weather] 기상청 호출 실패", REGIONS[i], errorCode(res.reason));
    }
  });
  if (Object.keys(regions).length === 0 || !latest) return { available: false };
  return { available: true, today, asOf: { short: latest }, regions };
}
