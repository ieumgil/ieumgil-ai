// 하루 일정 → 지도에 찍을 점(출발 · 장소 번호 · 도착)과 화면 읽기용 설명.
// 안 비교 화면과 확정 화면이 같이 쓴다. 번호는 타임라인의 장소 번호와 같다.
import type { Verdict } from "../ai/guards";
import { toHHMM } from "../engine/types";
import { shortName, verdictText } from "./labels";
import { callPlaces } from "./questions";
import type { DayView, ItemView, OptionView, TripView } from "./view";

export interface MapPoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  /** 장소면 번호, 출발·도착이면 "출발"/"도착" */
  label: string;
  kind: "stop" | "start" | "end";
}

type Visit = Extract<ItemView, { kind: "visit" }>;
export const visitsOf = (d: DayView) => d.items.filter((x): x is Visit => x.kind === "visit");

export function dayMapPoints(trip: TripView, o: OptionView, dayIndex: number): MapPoint[] {
  const day = o.days[dayIndex] ?? o.days[0];
  const frame = trip.frames[dayIndex] ?? trip.frames[0];
  return [
    { id: "start", name: day.startName, lat: frame.start.lat, lng: frame.start.lng, label: "출발", kind: "start" },
    ...visitsOf(day).map((v, i) => {
      const p = trip.placeData[v.placeId];
      return { id: v.placeId, name: trip.places[v.placeId].name, lat: p.lat, lng: p.lng, label: String(i + 1), kind: "stop" as const };
    }),
    { id: "end", name: day.endName, lat: frame.end.lat, lng: frame.end.lng, label: "도착", kind: "end" },
  ];
}

export function dayMapLabel(trip: TripView, o: OptionView, dayIndex: number): string {
  const day = o.days[dayIndex] ?? o.days[0];
  const stops = visitsOf(day).map((v, i) => `${i + 1} ${trip.places[v.placeId].name}`);
  return `${dayIndex + 1}일째 지도: ${[day.startName, ...stops, day.endName].join(" → ")}`;
}

/** 지도 번호를 눌렀을 때 뜨는 작은 카드의 내용(시각은 화면에 보이는 값: 실제 이동시간이면 그 기준) */
export interface StopDetail {
  no: number;
  name: string;
  short: string;
  time: string;
  verdict: Verdict;
  verdictLabel: string;
}

export function dayStopDetails(trip: TripView, o: OptionView, dayIndex: number): Record<string, StopDetail> {
  const day = o.days[dayIndex] ?? o.days[0];
  const calls = new Set(callPlaces(o));
  return Object.fromEntries(
    visitsOf(day).map((v, i) => {
      const name = trip.places[v.placeId].name;
      const verdict = trip.judgments[v.placeId].verdict;
      return [v.placeId, { no: i + 1, name, short: shortName(name), time: `약 ${toHHMM(v.arriveMin)}~${toHHMM(v.departMin)}`, verdict, verdictLabel: verdictText(verdict, calls.has(v.placeId)) }];
    }),
  );
}

/** 일정 목록의 장소 칸 id(지도 카드의 '일정에서 보기'가 찾아간다) */
export const stopAnchor = (placeId: string) => `stop-${placeId}`;

/** 일정 목록의 그 장소로 내려가 잠깐 파랗게 표시(globals.css [data-flash]) */
export function showStopInList(placeId: string) {
  const el = document.getElementById(stopAnchor(placeId));
  if (!el) return;
  const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "center" });
  el.removeAttribute("data-flash");
  void el.offsetWidth;
  el.setAttribute("data-flash", "");
  el.addEventListener("animationend", () => el.removeAttribute("data-flash"), { once: true });
}
