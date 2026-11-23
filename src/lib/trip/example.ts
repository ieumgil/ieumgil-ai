"use client";

// 예시 루트(/trip/example): 실제 Gemini로 미리 만들어 둔 결과(example-trip.json, scripts/ai/make-example.ts)를 그대로 연다.
// AI를 부르지 않아서 심사·시연 때 바로 열리고, 장소 바꾸기·확정·지도·전화 확인까지 그대로 해 볼 수 있다.
// 확정·바꾼 장소 기록은 예시 칸에 따로 보관한다(store.ts) → 사용자가 만든 일정과 섞이지 않는다.
//
// 시작 화면 루트 카드(11/23, 함께 가는 사람 × 도시): /trip/route-<사람>은 미리 만든 결과에서 안 하나만 골라 연다(안 비교 없음).
import { EXAMPLE_TRIP, ROUTE_CARDS, ROUTE_CREATED_PREFIX, ROUTE_PREFIX } from "./route-cards";
import { isExampleTrip, useSavedTrip } from "./store";
import type { TripView } from "./view";

export { EXAMPLE_TRIP };

/** 주소의 id에 맞는 일정: "new" = 이 탭에서 만든 일정, "example" = 예시, "route-…" = 시작 화면 루트 카드. 그 밖은 null(없는 주소) */
export function useTripFor(id: string): TripView | null | undefined {
  const saved = useSavedTrip();
  if (id === "example") return EXAMPLE_TRIP;
  if (id === "new") return saved;
  if (id.startsWith(ROUTE_PREFIX)) return ROUTE_CARDS.find((c) => `${ROUTE_PREFIX}${c.id}` === id)?.trip ?? null;
  return null;
}

/** 이 일정의 결과 화면 주소 */
export const tripHref = (trip: Pick<TripView, "createdAt">) => {
  if (trip.createdAt.startsWith(ROUTE_CREATED_PREFIX)) return `/trip/${ROUTE_PREFIX}${trip.createdAt.slice(ROUTE_CREATED_PREFIX.length)}`;
  return isExampleTrip(trip) ? "/trip/example" : "/trip/new";
};
