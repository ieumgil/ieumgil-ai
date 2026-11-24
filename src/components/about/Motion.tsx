"use client";
// 소개 글의 스크롤 등장 효과(사용자 요청 11/24 — 고칠 목록 9번 '스크롤하면 나오는 애니메이션').
// - RevealOnScroll: main 안의 [data-reveal] 요소 가운데 아직 화면 아래에 있는 것만 숨겼다가(wait) 화면에 들어오면 보여 준다(in).
//   처음부터 보이는 것은 건드리지 않아 첫 화면이 깜빡이지 않고, 자바스크립트가 없거나 '동작 줄이기'면 그냥 다 보인다.
//   막대(.reveal-bar)는 부모가 들어올 때 왼쪽부터 차오른다(globals.css '소개 글 등장').
// - CountUp: 숫자가 화면에 들어오면 0부터 올라간다. 화면 읽기 프로그램은 처음부터 최종 값만 읽는다(움직이는 글자는 aria-hidden).
import { useEffect, useRef } from "react";

const REDUCE = "(prefers-reduced-motion: reduce)";

export function RevealOnScroll() {
  useEffect(() => {
    if (window.matchMedia(REDUCE).matches) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.setAttribute("data-reveal", "in");
          io.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    for (const el of document.querySelectorAll<HTMLElement>("main [data-reveal]")) {
      if (el.getBoundingClientRect().top < window.innerHeight * 0.92) continue; // 이미 보이는 곳은 그대로
      el.setAttribute("data-reveal", "wait");
      io.observe(el);
    }
    return () => io.disconnect();
  }, []);
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
