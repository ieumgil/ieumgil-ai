"use client";
// 소개 글 PC 화면(1024px 이상)의 왼쪽 차례: 구역으로 바로 가고, 지금 읽는 구역을 굵게 + 왼쪽 파란 선으로 표시한다.
// 휴대폰·태블릿에서는 숨긴다(한 칸으로 위에서 아래로 읽는다). 지금 위치는 aria-current로도 알린다.
import { useEffect, useState } from "react";

export type TocItem = { id: string; title: string };

export function Toc({ items }: { items: TocItem[] }) {
  const [active, setActive] = useState(items[0]?.id ?? "");

  useEffect(() => {
    // 화면 위에서 30% 선을 이미 지난 구역 가운데 마지막 것. 첫 구역 전(머리 부분)이면 첫 구역
    let raf = 0;
    const update = () => {
      raf = 0;
      const line = window.innerHeight * 0.3;
      let current = items[0]?.id ?? "";
      for (const it of items) {
        const el = document.getElementById(it.id);
        if (el && el.getBoundingClientRect().top <= line) current = it.id;
      }
      // 끝까지 내렸으면 마지막 구역(짧은 마지막 구역은 30% 선까지 못 올라온다)
      const end = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      const last = items[items.length - 1];
      if (end && last && document.getElementById(last.id)!.getBoundingClientRect().top < window.innerHeight) current = last.id;
      setActive(current);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [items]);

  const index = Math.max(0, items.findIndex((it) => it.id === active));

  return (
    <nav aria-label="이 글의 차례" className="hidden lg:block">
      <div className="sticky top-8 flex flex-col gap-3">
        <p className="text-sm text-ink-sub">
          차례 · <span className="tabular-nums">{index + 1}</span> / {items.length}
        </p>
        <ol className="flex flex-col border-l-2 border-line">
          {items.map((it) => {
            const on = it.id === active;
            return (
              <li key={it.id}>
                <a
                  href={`#${it.id}`}
                  aria-current={on ? "true" : undefined}
                  className={`-ml-0.5 flex min-h-touch items-center border-l-2 py-2 pl-4 text-base text-pretty transition-colors ${
                    on ? "border-primary font-medium text-primary-ink" : "border-transparent text-ink-sub hover:text-ink"
                  }`}
                >
                  {it.title}
                </a>
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}
