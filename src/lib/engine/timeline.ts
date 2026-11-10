// 시각 계산(코드). LLM은 시각을 쓰지 않는다 — 화면의 "10:30 도착"은 전부 여기서 나온다.
// 한 곳의 시간 = 체류(장소 범위 안으로 맞춤) + 유형별 여유(휠체어·어르신 25%) + 휠체어 승하차 여유.
// 일정이 12~14시에 걸리면 처음 비는 때에 점심·휴식 60분을 넣는다. 문을 열기 전에 도착하면 기다린다.

import type { PlanInput } from "../plan/types";
import type { Place } from "../types";
import { seasonOf } from "./closed";
import { toMin, type DayFrame, type Leg, type PlanDayDraft, type Point, type TravelFn } from "./types";

export interface TimelineOptions {
  /** 체류에 더하는 여유 비율 */
  bufferRatio: number;
  /** 장소마다 승하차 여유(분) */
  boardingMin: number;
  /** restAfter일 때 쉬는 시간(분) */
  restMin: number;
  lunchMin: number;
}

/** 기획: 휠체어·고령자는 체류 20~30% 여유(초기값 25%), 휠체어 승하차 여유는 조사·테스트로 정함(초기값 10분) */
export function timelineOptions(input: Pick<PlanInput, "travelers">): TimelineOptions {
  const slow = input.travelers.includes("wheelchair") || input.travelers.includes("elder");
  return { bufferRatio: slow ? 0.25 : 0, boardingMin: input.travelers.includes("wheelchair") ? 10 : 0, restMin: 20, lunchMin: 60 };
}

export type TimelineItem =
  | { kind: "travel"; from: Point; to: Point; leg: Leg; startMin: number; endMin: number }
  | { kind: "wait"; placeId: string; startMin: number; endMin: number }
  | { kind: "visit"; placeId: string; arriveMin: number; departMin: number; stayMin: number; extraMin: number }
  | { kind: "lunch"; startMin: number; endMin: number }
  | { kind: "rest"; startMin: number; endMin: number };

export interface DayTimeline {
  date: string;
  items: TimelineItem[];
  /** 끝 지점에 도착하는 시각 */
  endMin: number;
  travelMin: number;
  estimatedTravel: boolean;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function opening(place: Place, date: string) {
  const h = place.hours;
  if (h.always_open) return { open: 0, close: 24 * 60, lastEntry: 24 * 60, known: true };
  const s = h[seasonOf(date)] ?? h.summer ?? h.winter;
  if (!s) return { open: 0, close: 24 * 60, lastEntry: 24 * 60, known: false };
  return { open: toMin(s.open), close: toMin(s.close), lastEntry: toMin(s.last_entry ?? s.close), known: true };
}

export function computeDay(
  frame: DayFrame,
  day: PlanDayDraft,
  placesById: Map<string, Place>,
  travel: TravelFn,
  opts: TimelineOptions,
): DayTimeline {
  const items: TimelineItem[] = [];
  let t = frame.startMin;
  let here: Point = frame.start;
  let travelMin = 0;
  let estimatedTravel = false;
  let lunched = false;
  const coversLunch = frame.startMin < 14 * 60 && frame.endMin > 12 * 60;
  const maybeLunch = () => {
    if (!lunched && coversLunch && t >= 12 * 60 && t < 15 * 60) {
      items.push({ kind: "lunch", startMin: t, endMin: t + opts.lunchMin });
      t += opts.lunchMin;
      lunched = true;
    }
  };
  const go = (to: Point) => {
    const leg = travel(here, to);
    items.push({ kind: "travel", from: here, to, leg, startMin: t, endMin: t + leg.minutes });
    t += leg.minutes;
    travelMin += leg.minutes;
    estimatedTravel ||= leg.estimated;
    here = to;
  };

  for (const stop of day.stops) {
    const place = placesById.get(stop.placeId);
    if (!place) continue;
    maybeLunch();
    go({ id: place.id, name: place.name_ko, lat: place.lat, lng: place.lng });
    const o = opening(place, frame.date);
    if (t < o.open) {
      items.push({ kind: "wait", placeId: place.id, startMin: t, endMin: o.open });
      t = o.open;
    }
    const stay = clamp(stop.stayMin, place.stay_min, place.stay_max);
    const extra = Math.round(stay * opts.bufferRatio) + opts.boardingMin;
    items.push({ kind: "visit", placeId: place.id, arriveMin: t, departMin: t + stay + extra, stayMin: stay, extraMin: extra });
    t += stay + extra;
    if (stop.restAfter) {
      items.push({ kind: "rest", startMin: t, endMin: t + opts.restMin });
      t += opts.restMin;
    }
  }
  maybeLunch();
  go(frame.end);
  return { date: frame.date, items, endMin: t, travelMin, estimatedTravel };
}
