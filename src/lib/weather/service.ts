// 날씨 묶음 만들기(서버 전용). 3개 시의 단기예보 + 중기예보(육상·기온)를 불러 날짜별 하루 값 표로 정리한다.
// D-04: 저장하지 않는다. 서버에서만 짧게 캐시한다('use cache' + cacheLife: 15분 뒤 다시 확인, 30분 뒤 만료 — CDN 15분+5분과 합쳐도 1시간 안쪽).
//   캐시 키 = 함수 인자(격자·지역코드 + 발표 시각)라서 새 발표가 나오면 키가 바뀌어 따로 지울 필요가 없다.
//   실패는 throw 그대로 둔다(null을 돌려주면 실패가 캐시에 굳는다). 데이터 없음(03)만 예외 — 아래 주석.
// 'use cache' 안에서는 요청 정보(cookies·headers 등)를 읽지 않는다 — 시각은 라우트가 구해 인자로 내려 준다.
// 발표 직후 자료가 아직 없으면(결과 코드 03) 시마다·구역마다 직전 발표로 딱 한 번만 다시 부른다(T-02-10·T-02-13: 호출을 늘리지 않는다).
//
// D-15: 단기·중기·시별 호출은 한 번의 Promise.allSettled로 따로 실패한다. 한쪽이 실패하면 그 범위(가까운 날 또는 4~10일 앞)만 '예보 없음'이고
//   다른 쪽 날짜는 그대로 나온다. 중기 육상은 세 시가 같은 구역(강원영동)을 쓰므로 요청당 1번만 부른다.
// 디지털 중기예보 개편 위험(연구 Pitfall 12): 기상청이 중기예보를 격자형으로 개편 중이라 getMidLandFcst·getMidTa의 유지 여부·필드가 바뀔 수 있다.
//   그래서 중기 실패·필드 변화는 단기 날짜를 막지 않는다(mid.ts는 필드가 실제로 있을 때만 날짜를 만든다). 첫 실호출 결과로 픽스처를 확인한다(02-06).

import { cacheLife } from "next/cache";
import { REGIONS, type Region } from "../types";
import { fetchMidLand, fetchMidTa, fetchShort, KmaError } from "./kma";
import { kstDate, kstHour, pickMidTmFc, pickShortBase, prevMidTmFc, prevShortBase } from "./kst";
import { mergeDays, summarizeMid, type MidInput } from "./mid";
import { MID_LAND_REG_ID, WEATHER_REGIONS } from "./regions";
import { summarizeShort } from "./summary";
import type { DayForecast, ShortBase, ShortItem, WeatherResponse } from "./types";

type MidItem = Record<string, unknown>;

export interface WeatherDeps {
  short(nx: number, ny: number, baseDate: string, baseTime: string): Promise<ShortItem[]>;
  /** 데이터 없음(03)이면 null — 서비스가 직전 발표로 한 번 다시 부른다 */
  midLand(regId: string, tmFc: string): Promise<MidItem | null>;
  midTa(regId: string, tmFc: string): Promise<MidItem | null>;
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
    cacheLife({ stale: 300, revalidate: 900, expire: 1800 });
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

// 중기도 같은 모양: 03만 값(null)으로 내보내 짧게 캐시하고, 나머지 실패는 throw라 캐시에 굳지 않는다.
async function midLandCached(regId: string, tmFc: string): Promise<MidItem | null> {
  "use cache";
  try {
    const item = await fetchMidLand(regId, tmFc);
    cacheLife({ stale: 300, revalidate: 900, expire: 1800 });
    return item;
  } catch (e) {
    if (errorCode(e) === NO_DATA) {
      cacheLife({ stale: 30, revalidate: 60, expire: 120 });
      return null;
    }
    throw e;
  }
}

async function midTaCached(regId: string, tmFc: string): Promise<MidItem | null> {
  "use cache";
  try {
    const item = await fetchMidTa(regId, tmFc);
    cacheLife({ stale: 300, revalidate: 900, expire: 1800 });
    return item;
  } catch (e) {
    if (errorCode(e) === NO_DATA) {
      cacheLife({ stale: 30, revalidate: 60, expire: 120 });
      return null;
    }
    throw e;
  }
}

export const cachedDeps: WeatherDeps = { short: shortCached, midLand: midLandCached, midTa: midTaCached };

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

/** 중기 한 구역을 부른다. 03이면 직전 발표(tmFc)로 한 번만 다시 부르고, 실제로 쓴 tmFc를 응답과 함께 돌려준다(필드의 N일이 tmFc 날짜 기준이라서) */
async function loadMid(fetcher: (regId: string, tmFc: string) => Promise<MidItem | null>, regId: string, tmFc: string): Promise<MidInput> {
  let first: MidItem | null = null;
  try {
    first = await fetcher(regId, tmFc);
  } catch (e) {
    if (errorCode(e) !== NO_DATA) throw e;
  }
  if (first) return { item: first, tmFc };
  const prev = prevMidTmFc(tmFc);
  const item = await fetcher(regId, prev);
  if (!item) throw new KmaError(NO_DATA);
  return { item, tmFc: prev };
}

const baseKey = (b: ShortBase) => b.baseDate + b.baseTime;

/** 단기·중기·시별 호출을 따로 실패하게 부르고, 받은 만큼만 합쳐 돌려준다. 날짜가 하나도 없으면 { available: false } */
export async function buildWeatherPayload(now: Date, deps: WeatherDeps): Promise<WeatherResponse> {
  const base = pickShortBase(now);
  const tmFc = pickMidTmFc(now);
  const today = kstDate(now);
  const nowHour = kstHour(now);

  // 한 번의 allSettled: 단기 3개(시마다) + 육상 1개(세 시가 함께 씀) + 기온 3개(시마다). 순서는 아래에서 그대로 읽는다.
  const settled = await Promise.allSettled([
    ...REGIONS.map((r) => loadShort(deps, WEATHER_REGIONS[r].nx, WEATHER_REGIONS[r].ny, base)),
    loadMid(deps.midLand, MID_LAND_REG_ID, tmFc),
    ...REGIONS.map((r) => loadMid(deps.midTa, WEATHER_REGIONS[r].midTaRegId, tmFc)),
  ]);
  const n = REGIONS.length;
  const shortResults = settled.slice(0, n) as PromiseSettledResult<{ items: ShortItem[]; used: ShortBase }>[];
  const landResult = settled[n] as PromiseSettledResult<MidInput>;
  const taResults = settled.slice(n + 1) as PromiseSettledResult<MidInput>[];

  // 실패는 코드만 남긴다(요청 URL·키·Error 객체는 찍지 않는다 — 원칙 4)
  const warn = (label: string, res: PromiseSettledResult<unknown>) => {
    if (res.status === "rejected") console.warn("[weather] 기상청 호출 실패", label, errorCode(res.reason));
  };
  shortResults.forEach((res, i) => warn(REGIONS[i], res));
  warn("중기 육상", landResult);
  taResults.forEach((res, i) => warn(`중기 기온 ${REGIONS[i]}`, res));

  const land = landResult.status === "fulfilled" ? landResult.value : null;
  const regions: Partial<Record<Region, Record<string, DayForecast>>> = {};
  let latest: ShortBase | null = null;
  REGIONS.forEach((region, i) => {
    const sr = shortResults[i];
    const tr = taResults[i];
    let shortDays: Record<string, DayForecast> = {};
    if (sr.status === "fulfilled") {
      shortDays = summarizeShort(sr.value.items, today, nowHour);
      if (!latest || baseKey(sr.value.used) > baseKey(latest)) latest = sr.value.used;
    }
    const midDays = summarizeMid(land, tr.status === "fulfilled" ? tr.value : null);
    const days = mergeDays(shortDays, midDays);
    if (Object.keys(days).length > 0) regions[region] = days;
  });
  if (Object.keys(regions).length === 0) return { available: false };

  const asOf: { short?: ShortBase; mid?: string } = {};
  if (latest) asOf.short = latest;
  if (land) asOf.mid = land.tmFc;
  // complete: 세 시의 단기와 중기(육상·기온) 호출이 모두 성공했거나 '데이터 없음(03)'이 확정된 경우뿐이다.
  // 그 밖의 실패(시간 초과·한도·키 오류)가 하나라도 있으면 false → 라우트가 CDN에 짧게만 맡겨, 일시 오류로 빠진 구간이 오래 굳지 않게 한다(WR-02).
  const settledOk = (res: PromiseSettledResult<unknown>) => res.status === "fulfilled" || errorCode(res.reason) === NO_DATA;
  const complete = shortResults.every(settledOk) && settledOk(landResult) && taResults.every(settledOk);
  return { available: true, today, asOf, regions, complete };
}
