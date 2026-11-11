"use client";

// 첫 접속 인트로(약 1.2초): 탭에서 시작 화면(/)으로 처음 들어올 때 한 번만 로고를 보여주고 자동으로 사라진다.
// - 보여줄지는 layout의 인라인 스크립트가 첫 화면을 그리기 전에 정한다(html[data-intro="on"]) → 깜빡임 없음
// - 누르거나 아무 키나 누르면 바로 넘어간다. 움직임 줄이기 설정이면 보여주지 않는다(인라인 스크립트에서 거름)
// - 스크립트가 실패해도 CSS 애니메이션이 2.5초 뒤 스스로 감춘다(globals.css .intro)
// - 장식이라 화면 읽기 프로그램에는 숨긴다. 아래 시작 화면 내용은 그대로 있다(검색 노출 영향 없음)
import { useEffect, useRef } from "react";
import { INTRO_KEY } from "@/lib/intro";
import { LogoMark } from "./Logo";

const SHOW_MS = 800;
const FADE_MS = 400;

export function Intro() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const html = document.documentElement;
    if (html.dataset.intro !== "on") return;
    try {
      sessionStorage.setItem(INTRO_KEY, "1");
    } catch {
      // 저장이 막혀도 이번에는 한 번 보여주고 끝
    }
    let left = false;
    let hide: ReturnType<typeof setTimeout> | undefined;
    const leave = () => {
      if (left) return;
      left = true;
      ref.current?.setAttribute("data-leaving", "");
      hide = setTimeout(() => delete html.dataset.intro, FADE_MS);
    };
    const timer = setTimeout(leave, SHOW_MS);
    const el = ref.current;
    window.addEventListener("keydown", leave);
    el?.addEventListener("pointerdown", leave);
    return () => {
      clearTimeout(timer);
      if (hide) clearTimeout(hide);
      window.removeEventListener("keydown", leave);
      el?.removeEventListener("pointerdown", leave);
    };
  }, []);

  return (
    <div ref={ref} className="intro" aria-hidden="true">
      <div className="intro-mark">
        <LogoMark size={80} />
      </div>
      <p className="intro-name text-display font-bold text-primary">이음길</p>
      <p className="intro-line text-lead text-ink-sub">휠체어, 어르신, 유모차와 함께 가는 영동 여행</p>
    </div>
  );
}

