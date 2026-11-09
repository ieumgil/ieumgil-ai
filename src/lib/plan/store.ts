"use client";

// 입력 4단계 값 보관소. 탭이 열려 있는 동안만 sessionStorage에 둔다(서버로 보내지 않음, 개인정보 없음).
import { useSyncExternalStore } from "react";
import { EMPTY_PLAN, type PlanInput } from "./types";

const KEY = "ieumgil-plan";
let state: PlanInput | null = null;
const listeners = new Set<() => void>();

function load(): PlanInput {
  if (state) return state;
  try {
    const raw = sessionStorage.getItem(KEY);
    state = raw ? { ...EMPTY_PLAN, ...(JSON.parse(raw) as Partial<PlanInput>) } : EMPTY_PLAN;
  } catch {
    state = EMPTY_PLAN;
  }
  return state;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function updatePlan(patch: Partial<PlanInput> | ((cur: PlanInput) => Partial<PlanInput>)) {
  const cur = load();
  state = { ...cur, ...(typeof patch === "function" ? patch(cur) : patch) };
  try {
    sessionStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // 저장이 막혀도 이번 화면에서는 동작
  }
  listeners.forEach((l) => l());
}

/** 서버 렌더링과 첫 hydration에서는 빈 입력, 그 뒤 저장된 값으로 바뀐다. */
export function usePlan(): PlanInput {
  return useSyncExternalStore(subscribe, load, () => EMPTY_PLAN);
}
