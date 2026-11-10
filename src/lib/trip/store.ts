"use client";

// 만든 일정 보관(이 탭에서만, sessionStorage). 서버에는 저장하지 않는다. 공유 링크는 나중에.
import { useSyncExternalStore } from "react";
import { TRIP_VIEW_VERSION, type TripView } from "./view";

const KEY = "ieumgil-trip";
let cache: { raw: string | null; trip: TripView | null } = { raw: null, trip: null };

export function saveTrip(trip: TripView) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(trip));
  } catch {
    // 저장이 막혀도 바로 다음 화면에서는 cache로 보여준다
  }
  cache = { raw: JSON.stringify(trip), trip };
}

function read(): TripView | null {
  let raw: string | null = cache.raw;
  try {
    raw = sessionStorage.getItem(KEY) ?? cache.raw;
  } catch {
    // 그대로
  }
  if (raw === cache.raw && cache.trip) return cache.trip;
  try {
    const trip = raw ? (JSON.parse(raw) as TripView) : null;
    cache = { raw, trip: trip?.version === TRIP_VIEW_VERSION ? trip : null };
  } catch {
    cache = { raw, trip: null };
  }
  return cache.trip;
}

// 확정한 안(이 탭에서만). 값: "만든 시각|안 id" — 새 일정을 만들면 자동으로 풀린다.
const CONFIRM_KEY = "ieumgil-trip-confirmed";
const listeners = new Set<() => void>();
let confirmed: string | null | undefined;

export function confirmOption(trip: TripView, optionId: string | null) {
  confirmed = optionId ? `${trip.createdAt}|${optionId}` : null;
  try {
    if (confirmed) sessionStorage.setItem(CONFIRM_KEY, confirmed);
    else sessionStorage.removeItem(CONFIRM_KEY);
  } catch {
    // 저장이 막혀도 이번 화면에서는 동작
  }
  listeners.forEach((l) => l());
}

function readConfirmed(): string | null {
  if (confirmed === undefined) {
    try {
      confirmed = sessionStorage.getItem(CONFIRM_KEY);
    } catch {
      confirmed = null;
    }
  }
  return confirmed;
}

/** 확정한 안 id(이 일정의 것일 때만) */
export function useConfirmedOption(trip: TripView): string | null {
  const raw = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    readConfirmed,
    () => null,
  );
  if (!raw) return null;
  const [createdAt, id] = raw.split("|");
  return createdAt === trip.createdAt ? id : null;
}

/** undefined = 아직 브라우저에서 읽기 전(서버 렌더링), null = 없음 */
export function useSavedTrip(): TripView | null | undefined {
  return useSyncExternalStore(
    () => () => {},
    read,
    () => undefined,
  );
}
