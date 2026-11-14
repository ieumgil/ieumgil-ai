// 카카오 실제 이동시간 표(서버·화면 공용). 하루 지점 순서(출발 → 장소들 → 도착)로 받은 구간 값을 좌표 쌍으로 넣어 두고,
// 표에 있으면 그 값(추정 아님), 없으면 직선거리 추정(estimateLeg)으로 계산한다.
// 표는 요청·화면 메모리에서만 쓰고 저장하지 않는다(카카오 캐싱 금지, 원칙 3: 열 때마다 다시 계산).

import type { Place } from "../types";
import { estimateLeg } from "./travel";
import type { DayFrame, Leg, PlanDayDraft, Point, TravelFn } from "./types";

/** 구간 값(분은 카카오 소요 시간 + 주차·승하차 여유, km는 도로 거리) */
export interface RealLeg {
  minutes: number;
  km: number;
}

export type LegTable = Map<string, RealLeg>;

const at = (p: Point) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;
export const legKey = (a: Point, b: Point) => `${at(a)}>${at(b)}`;

/** 하루 지점: 출발 → (일정 순서대로) 장소들 → 도착. 시각 계산(computeDay)과 같은 순서 */
export function dayPoints(frame: DayFrame, day: PlanDayDraft, placesById: Map<string, Place>): Point[] {
  const stops = day.stops.flatMap((s) => {
    const p = placesById.get(s.placeId);
    return p ? [{ id: p.id, name: p.name_ko, lat: p.lat, lng: p.lng }] : [];
  });
  return [frame.start, ...stops, frame.end];
}

/** 지점 순서와 구간 값(지점 수 - 1개)을 표에 넣는다. 개수가 맞지 않으면 넣지 않는다 */
export function addLegs(table: LegTable, points: Point[], legs: RealLeg[]): void {
  if (legs.length !== points.length - 1) return;
  legs.forEach((leg, i) => table.set(legKey(points[i], points[i + 1]), leg));
}

/** 표에 있으면 실제 값, 없으면 추정 */
export function tableTravel(table: LegTable, fallback: TravelFn = estimateLeg): TravelFn {
  return (from: Point, to: Point): Leg => {
    const real = from.id === to.id ? undefined : table.get(legKey(from, to));
    return real ? { minutes: real.minutes, km: real.km, estimated: false } : fallback(from, to);
  };
}
