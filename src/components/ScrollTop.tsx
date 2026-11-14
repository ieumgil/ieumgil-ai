"use client";

// 맨 위로 버튼: 화면을 꽤 내려왔을 때만 오른쪽 아래에 뜬다(아래 고정 막대가 있으면 그 위로). 움직임 줄이기 설정이면 바로 올라간다.
import { ArrowUp } from "lucide-react";
import { useEffect, useState } from "react";

export function ScrollTop({ bottom = "1.25rem", after = 600 }: { bottom?: string; after?: number }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > after);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [after]);
  if (!show) return null;
  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" })}
      aria-label="맨 위로"
      title="맨 위로"
      style={{ bottom }}
      className="fixed right-4 z-30 flex size-12 animate-pop items-center justify-center rounded-full bg-white text-primary shadow-[0_4px_16px_rgb(25_31_40/0.18)] ring-1 ring-line transition-colors hover:bg-primary-soft focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary md:right-6"
    >
      <ArrowUp size={22} aria-hidden="true" />
    </button>
  );
}
