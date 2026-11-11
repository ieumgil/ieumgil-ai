"use client";

// 예시 루트(/trip/example): 실제 Gemini로 미리 만들어 둔 결과(example-trip.json, scripts/ai/make-example.ts)를 그대로 연다.
// AI를 부르지 않아서 심사·시연 때 바로 열리고, 장소 바꾸기·확정·지도·전화 확인까지 그대로 해 볼 수 있다.
// 확정·바꾼 장소 기록은 예시 칸에 따로 보관한다(store.ts) → 사용자가 만든 일정과 섞이지 않는다.
import data from "./example-trip.json";
import { isExampleTrip, useSavedTrip } from "./store";
import type { TripView } from "./view";

export const EXAMPLE_TRIP = data as unknown as TripView;

/** 주소의 id에 맞는 일정: "new" = 이 탭에서 만든 일정, "example" = 예시. 그 밖은 null(없는 주소) */
export function useTripFor(id: string): TripView | null | undefined {
  const saved = useSavedTrip();
  if (id === "example") return EXAMPLE_TRIP;
  if (id === "new") return saved;
  return null;
}

/** 이 일정의 결과 화면 주소 */
export const tripHref = (trip: Pick<TripView, "createdAt">) => (isExampleTrip(trip) ? "/trip/example" : "/trip/new");
