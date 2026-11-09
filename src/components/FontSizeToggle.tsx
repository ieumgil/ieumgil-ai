"use client";

// "가 글씨 크게" 버튼. <html data-font-size="large">를 켜고 끈다.
// 첫 화면 깜빡임을 막으려고 저장값은 layout.tsx의 인라인 스크립트가 먼저 적용한다.
import { useSyncExternalStore } from "react";
import { FONT_SIZE_KEY } from "@/lib/font-size";

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-font-size"] });
  return () => observer.disconnect();
}

const isLarge = () => document.documentElement.dataset.fontSize === "large";

export function FontSizeToggle() {
  const large = useSyncExternalStore(subscribe, isLarge, () => false);

  function toggle() {
    const next = !large;
    if (next) document.documentElement.dataset.fontSize = "large";
    else delete document.documentElement.dataset.fontSize;
    try {
      localStorage.setItem(FONT_SIZE_KEY, next ? "large" : "normal");
    } catch {
      // 저장이 막힌 브라우저에서는 이번 방문에만 적용
    }
  }

  return (
    <button
      type="button"
      aria-pressed={large}
      onClick={toggle}
      className={`min-h-touch shrink-0 rounded-full border px-3.5 text-base transition-colors ${
        large ? "border-primary bg-primary-soft font-bold text-primary-ink" : "border-surface bg-surface text-ink"
      }`}
    >
      가 글씨 {large ? "작게" : "크게"}
    </button>
  );
}
