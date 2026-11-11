"use client";

// 화면 너비 조건(미디어 쿼리)을 React 값으로. 창 크기를 바꾸면 바로 다시 그린다.
// 서버 렌더링·첫 hydration에서는 false(휴대폰 배치)로 시작한다.
import { useSyncExternalStore } from "react";

/** globals.css·Tailwind 기본 구간과 같은 값 */
export const WIDE = "(min-width: 80rem)"; // 1280px: 안 비교 3칸
export const DESKTOP = "(min-width: 64rem)"; // 1024px: PC 2칸

export function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
