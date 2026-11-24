"use client";
// 스크롤 등장 효과(11/24 — 소개 글 두 편 · 시작 화면 · 관광지 둘러보기).
// - RevealOnScroll: main 안의 [data-reveal] 요소 가운데 아직 화면 아래에 있는 것만 숨겼다가(wait) 화면에 들어오면 보여 준다(in).
//   watch 값이 바뀌면(예: 관광지 둘러보기의 지역·분야) 새로 그려진 요소만 다시 살핀다. 화면 고정 스크롤(시작 화면 단계 소개)에는 쓰지 않는다.
//   처음부터 보이는 것은 건드리지 않아 첫 화면이 깜빡이지 않고, 자바스크립트가 없거나 '동작 줄이기'면 그냥 다 보인다.
//   막대(.reveal-bar)는 부모가 들어올 때 왼쪽부터 차오른다(globals.css '소개 글 등장').
// - CountUp: 숫자가 화면에 들어오면 0부터 올라간다. 화면 읽기 프로그램은 처음부터 최종 값만 읽는다(움직이는 글자는 aria-hidden).
import { useEffect, useRef } from "react";

const REDUCE = "(prefers-reduced-motion: reduce)";

export function RevealOnScroll({ watch }: { watch?: string } = {}) {
  useEffect(() => {
    if (window.matchMedia(REDUCE).matches) return;
    const waiting = new Set<Element>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.setAttribute("data-reveal", "in");
          io.unobserve(e.target);
          waiting.delete(e.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    // 아직 한 번도 살피지 않은 것("")만. 이미 나타난 것(in)은 다시 숨기지 않는다
    for (const el of document.querySelectorAll<HTMLElement>('main [data-reveal=""]')) {
      if (el.getBoundingClientRect().top < window.innerHeight * 0.92) continue; // 이미 보이는 곳은 그대로
      el.setAttribute("data-reveal", "wait");
      waiting.add(el);
      io.observe(el);
    }
    return () => {
      io.disconnect();
      // 다시 살피기 전에 아직 숨어 있는 것을 처음 상태로 돌린다(그대로 두면 영영 안 보인다)
      for (const el of waiting) el.setAttribute("data-reveal", "");
    };
  }, [watch]);
  return null;
}

/** "152곳" · "96.4%" · "약 50원" · "1,520항목"처럼 숫자 하나가 든 값을 0부터 올려 보여 준다. 0이면 그대로 */
export function CountUp({ value, className }: { value: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    const m = value.match(/^(\D*)([\d,]+(?:\.\d+)?)(.*)$/);
    if (!el || !m || window.matchMedia(REDUCE).matches) return;
    const target = Number(m[2].replace(/,/g, ""));
    if (!target) return;
    const decimals = (m[2].split(".")[1] ?? "").length;
    const comma = m[2].includes(",");
    const text = (n: number) => `${m[1]}${comma ? Math.round(n).toLocaleString("ko-KR") : n.toFixed(decimals)}${m[3]}`;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.92) return; // 이미 보이는 숫자는 움직이지 않는다
    el.textContent = text(0);
    let raf = 0;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return;
        io.disconnect();
        const start = performance.now();
        const tick = (t: number) => {
          const p = Math.min(1, (t - start) / 1000);
          el.textContent = text(target * (1 - Math.pow(1 - p, 3)));
          if (p < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      el.textContent = value;
    };
  }, [value]);
  return (
    <span className={className}>
      <span ref={ref} aria-hidden="true" className="tabular-nums">
        {value}
      </span>
      <span className="sr-only">{value}</span>
    </span>
  );
}
