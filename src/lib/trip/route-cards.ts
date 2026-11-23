// 시작 화면 루트 카드(11/23, 함께 가는 사람 × 도시): 미리 만든 실제 AI 결과(scripts/ai/make-example.ts)에서 안 하나만 골라 연다.
// /trip/route-<id>는 안 비교 없이 그 안 하나만 보여 준다. 만든 시각 자리가 카드마다 달라 확정·바꾼 장소 기록도 따로 남는다(store.ts).
// 서버(시작 화면)와 브라우저(결과 화면)가 함께 쓰므로 "use client"를 붙이지 않는다.
import data from "./example-trip.json";
import elder from "./examples/elder.json";
import stroller from "./examples/stroller.json";
import type { TripView } from "./view";

export const EXAMPLE_TRIP = data as unknown as TripView;

/** 미리 만든 결과에서 안 하나만 남긴 일정 */
function single(trip: TripView, optionId: string, createdAt: string): TripView {
  const option = trip.options.find((o) => o.id === optionId) ?? trip.options[0];
  return { ...trip, createdAt, notes: [], options: [option] };
}

export type RouteCardId = "wheelchair" | "elder" | "stroller";

export interface RouteCard {
  id: RouteCardId;
  who: string;
  where: string;
  /** 카드 제목: 사실만(시설이 있다고 단정하지 않는다) */
  line: string;
  /** 대표 사진 장소(public/photos/<id>.webp, 한국관광공사 공공누리 1유형) */
  photoPlace: string;
  trip: TripView;
}

export const ROUTE_CARDS: RouteCard[] = [
  { id: "wheelchair", who: "휠체어", where: "강릉 · 1박 2일", line: "오죽헌과 경포 바다를 휠체어로", photoPlace: "GN33", trip: single(EXAMPLE_TRIP, "B", "example-route-wheelchair") },
  { id: "elder", who: "어르신", where: "속초 · 당일", line: "속초 바다와 청초호를 천천히", photoPlace: "SC27", trip: single(elder as unknown as TripView, "A", "example-route-elder") },
  { id: "stroller", who: "유모차", where: "동해 · 당일", line: "추암 촛대바위에서 도째비골까지", photoPlace: "DH20", trip: single(stroller as unknown as TripView, "B", "example-route-stroller") },
];

export const ROUTE_PREFIX = "route-";
export const ROUTE_CREATED_PREFIX = "example-route-";
