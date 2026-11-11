"use client";

// 만든 일정 보관(이 탭에서만, sessionStorage). 서버에는 저장하지 않는다. 공유 링크는 나중에.
// 확정한 안·바꾼 장소·전화 결과는 일정마다 칸을 나눈다: 사용자가 만든 일정은 기본 칸, 예시 루트(/trip/example)는 ":example" 칸.
// 그래서 예시를 둘러보며 장소를 바꾸거나 확정해도 사용자가 만든 일정 기록은 그대로다.
import { useSyncExternalStore } from "react";
import { TRIP_VIEW_VERSION, type OptionView, type TripView } from "./view";

const KEY = "ieumgil-trip";
let cache: { raw: string | null; trip: TripView | null } = { raw: null, trip: null };

/** 예시 루트인가(만든 시각 자리에 "example…"이 들어 있다) */
export const isExampleTrip = (trip: Pick<TripView, "createdAt">) => trip.createdAt.startsWith("example");

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

/* ── 일정별 칸: 키마다 값(raw 문자열)을 캐시하고 바뀌면 구독자에게 알린다 ── */

const slots = new Map<string, { raw: string | null }>();
const slotListeners = new Map<string, Set<() => void>>();
const keyFor = (base: string, trip: Pick<TripView, "createdAt">) => (isExampleTrip(trip) ? `${base}:example` : base);

function readRaw(key: string): string | null {
  let s = slots.get(key);
  if (!s) {
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem(key);
    } catch {
      // 그대로
    }
    s = { raw };
    slots.set(key, s);
  }
  return s.raw;
}

function writeRaw(key: string, raw: string | null) {
  slots.set(key, { raw });
  try {
    if (raw === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, raw);
  } catch {
    // 저장이 막혀도 이번 화면에서는 동작
  }
  slotListeners.get(key)?.forEach((l) => l());
}

function useRaw(key: string): string | null {
  return useSyncExternalStore(
    (l) => {
      if (!slotListeners.has(key)) slotListeners.set(key, new Set());
      slotListeners.get(key)!.add(l);
      return () => slotListeners.get(key)!.delete(l);
    },
    () => readRaw(key),
    () => null,
  );
}

const parse = <T,>(raw: string | null): T | null => {
  try {
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

// 확정한 안. 값: "만든 시각|안 id" — 새 일정을 만들면 자동으로 풀린다.
const CONFIRM_KEY = "ieumgil-trip-confirmed";

export function confirmOption(trip: TripView, optionId: string | null) {
  writeRaw(keyFor(CONFIRM_KEY, trip), optionId ? `${trip.createdAt}|${optionId}` : null);
}

/** 확정한 안 id(이 일정의 것일 때만) */
export function useConfirmedOption(trip: TripView): string | null {
  const raw = useRaw(keyFor(CONFIRM_KEY, trip));
  if (!raw) return null;
  const [createdAt, id] = raw.split("|");
  return createdAt === trip.createdAt ? id : null;
}

// 장소를 바꾼 안. 값: { createdAt, options: { 안 id: 바꾼 안 } } — 새 일정을 만들면 자동으로 풀린다.
const EDIT_KEY = "ieumgil-trip-edits";
type Edits = { createdAt: string; options: Record<string, OptionView> };
const NO_EDITS: Record<string, OptionView> = {};
const editsCache = new Map<string, { raw: string | null; value: Edits | null }>();

function editsOf(raw: string | null): Edits | null {
  const hit = editsCache.get(raw ?? "");
  if (hit && hit.raw === raw) return hit.value;
  const value = parse<Edits>(raw);
  editsCache.set(raw ?? "", { raw, value });
  return value;
}

/** 바꾼 안을 저장한다. 바꾼 곳이 하나도 없으면(모두 되돌림) 지운다 */
export function saveEditedOption(trip: TripView, option: OptionView) {
  const key = keyFor(EDIT_KEY, trip);
  const cur = editsOf(readRaw(key));
  const options = { ...(cur?.createdAt === trip.createdAt ? cur.options : {}) };
  if (option.swapped && Object.keys(option.swapped).length > 0) options[option.id] = option;
  else delete options[option.id];
  writeRaw(key, JSON.stringify({ createdAt: trip.createdAt, options } satisfies Edits));
}

/** 이 일정에서 장소를 바꾼 안들(안 id → 바꾼 안) */
export function useEditedOptions(trip: TripView): Record<string, OptionView> {
  const value = editsOf(useRaw(keyFor(EDIT_KEY, trip)));
  return value?.createdAt === trip.createdAt ? value.options : NO_EDITS;
}

// 출발 전 전화로 확인한 결과. 값: { createdAt, results: { 장소 id: "ok" | "hard" } } — 새 일정을 만들면 자동으로 풀린다.
export type CallResult = "ok" | "hard";
type Checks = { createdAt: string; results: Record<string, CallResult> };
const CHECK_KEY = "ieumgil-trip-checked";
const NO_RESULTS: Record<string, CallResult> = {};
const checksCache = new Map<string, { raw: string | null; value: Checks | null }>();

function checksOf(raw: string | null): Checks | null {
  const hit = checksCache.get(raw ?? "");
  if (hit && hit.raw === raw) return hit.value;
  const v = parse<Partial<Checks> & { ids?: string[] }>(raw);
  // 예전 형식(ids = 확인한 곳)은 '괜찮음'으로 읽는다
  const value = v?.createdAt ? { createdAt: v.createdAt, results: v.results ?? Object.fromEntries((v.ids ?? []).map((id) => [id, "ok" as const])) } : null;
  checksCache.set(raw ?? "", { raw, value });
  return value;
}

/** 전화 결과 저장. null이면 지운다 */
export function setCallResult(trip: TripView, placeId: string, result: CallResult | null) {
  const key = keyFor(CHECK_KEY, trip);
  const cur = checksOf(readRaw(key));
  const results = { ...(cur?.createdAt === trip.createdAt ? cur.results : {}) };
  if (result) results[placeId] = result;
  else delete results[placeId];
  writeRaw(key, JSON.stringify({ createdAt: trip.createdAt, results } satisfies Checks));
}

/** 이 일정의 장소별 전화 결과 */
export function useCallResults(trip: TripView): Record<string, CallResult> {
  const value = checksOf(useRaw(keyFor(CHECK_KEY, trip)));
  return value?.createdAt === trip.createdAt ? value.results : NO_RESULTS;
}

/** undefined = 아직 브라우저에서 읽기 전(서버 렌더링), null = 없음 */
export function useSavedTrip(): TripView | null | undefined {
  return useSyncExternalStore(
    () => () => {},
    read,
    () => undefined,
  );
}
