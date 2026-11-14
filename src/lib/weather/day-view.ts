// 날짜 하나의 날씨 화면 값(순수 함수, React·next 없음). 확정 화면과 공유 화면이 같은 FinalOption을 쓰므로 둘 다 이 값으로 그린다.
// 날짜 비교 기준은 서버가 본 한국 오늘(payload.today)이다 — 기기 날짜가 아니다(해외·시간대 차이로 하루 어긋나지 않게).
// 저장하지 않는다: 화면 메모리에서만 만든다(D-04, 원칙 3).

import type { Category, Region } from "../types";
import type { DayView } from "../trip/view";
import { daysBetweenISO } from "./kst";
import { isOutdoorPlace, rainCaution } from "./caution";
import { MISSING_TEXT, OUT_OF_RANGE_TEXT, PAST_TEXT, weatherIcon, weatherLine, type WeatherIconName } from "./labels";
import type { WeatherPayload } from "./types";

/** 예보가 나오는 가장 먼 날(오늘 + 10일). 중기예보가 D+10까지라서, '약 10일 전부터'로 안내한다 */
export const FORECAST_MAX_DAYS = 10;

type PlaceLite = { region: Region; category: Category };
type DayLite = Pick<DayView, "date" | "items">;

export type DayState = "past" | "near" | "far";

export function classifyDay(date: string, today: string): DayState {
  const diff = daysBetweenISO(today, date);
  if (diff < 0) return "past";
  return diff > FORECAST_MAX_DAYS ? "far" : "near";
}

/** 그날 방문 장소의 시를 첫 방문 순서로, 중복 없이 */
export function dayRegions(d: DayLite, places: Record<string, PlaceLite>): Region[] {
  const out: Region[] = [];
  for (const it of d.items) {
    if (it.kind !== "visit") continue;
    const region = places[it.placeId]?.region;
    if (region && !out.includes(region)) out.push(region);
  }
  return out;
}

export interface DayWeatherLine {
  region: Region;
  text: string;
  icon: WeatherIconName | null;
  hasForecast: boolean;
}

export type DayWeatherView = { kind: "note"; text: string } | { kind: "lines"; lines: DayWeatherLine[] };

/** 날씨를 못 받았거나(null) 그날 가는 곳이 없으면 null(아무것도 그리지 않는다) */
export function dayWeatherView(d: DayLite, places: Record<string, PlaceLite>, payload: WeatherPayload | null): DayWeatherView | null {
  if (!payload) return null;
  const regions = dayRegions(d, places);
  if (regions.length === 0) return null;
  const state = classifyDay(d.date, payload.today);
  if (state === "past") return { kind: "note", text: PAST_TEXT };
  if (state === "far") return { kind: "note", text: OUT_OF_RANGE_TEXT };
  return {
    kind: "lines",
    lines: regions.map((region) => {
      const f = payload.regions[region]?.[d.date];
      return f ? { region, text: weatherLine(region, f), icon: weatherIcon(f), hasForecast: true } : { region, text: `${region} · ${MISSING_TEXT}`, icon: null, hasForecast: false };
    }),
  };
}

/** 장소 id → 비·눈 주의 문구. 예보가 있는 날(near)에, 바깥 장소이고 그 장소 시의 그날 값이 기준 이상일 때만 */
export function dayCautions(d: DayLite, places: Record<string, PlaceLite>, payload: WeatherPayload | null): Map<string, string> {
  const out = new Map<string, string>();
  if (!payload || classifyDay(d.date, payload.today) !== "near") return out;
  for (const it of d.items) {
    if (it.kind !== "visit") continue;
    const p = places[it.placeId];
    if (!p || !isOutdoorPlace(p)) continue;
    const text = rainCaution(payload.regions[p.region]?.[d.date]);
    if (text) out.set(it.placeId, text);
  }
  return out;
}

/** 예보가 있는 줄이 하나라도 화면에 보이면 true → 출처 줄을 붙인다(D-11) */
export function hasShownWeather(views: (DayWeatherView | null)[]): boolean {
  return views.some((v) => v?.kind === "lines" && v.lines.some((l) => l.hasForecast));
}
