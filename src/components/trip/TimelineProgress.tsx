"use client";

// 타임라인 스크롤 진행 표시(11/23): 세로 연결선 위를 작은 원이 출발 깃발부터 아래로 따라 내려가고, 지나온 선은 파랑으로 채운다.
// 기준점은 화면 높이의 45% — 그 높이를 지난 만큼이 '지금 보고 있는 곳'이다. 스크롤 위치만 읽어 그리므로(시간 애니메이션 아님)
// 동작 줄이기 설정이어도 사용자가 움직인 만큼만 움직인다. 장식이라 화면 읽기 프로그램은 건너뛰고, 인쇄에는 나오지 않는다.
// 깃발·번호 동그라미(z-10) 뒤로 지나가도록 원은 그보다 아래 층에 둔다.
import { useEffect, useRef } from "react";

const ANCHOR = 0.45;

export function TimelineProgress() {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      if (r.height === 0) return; // 숨은 날짜 탭
      const p = Math.min(1, Math.max(0, (window.innerHeight * ANCHOR - r.top) / r.height));
      el.style.setProperty("--progress", String(p));
      el.dataset.state = p <= 0 ? "start" : p >= 1 ? "end" : "moving";
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    const ro = new ResizeObserver(schedule);
    ro.observe(el);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <span ref={ref} data-timeline-progress aria-hidden="true" className="pointer-events-none absolute top-4 bottom-4 left-[0.9375rem] z-[1] w-0.5 print:hidden" style={{ "--progress": 0 } as React.CSSProperties}>
      <span className="absolute inset-x-0 top-0 rounded-full bg-primary" style={{ height: "calc(var(--progress) * 100%)" }} />
      <span
        className="absolute left-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary ring-4 ring-primary-soft"
        style={{ top: "calc(var(--progress) * 100%)" }}
      />
    </span>
  );
}
