"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { TopBar } from "@/components/TopBar";
import { PlanSummary } from "./PlanSummary";
import { buttonClass } from "@/components/ui/button";
import { STEPS } from "@/lib/plan/progress";

/**
 * 입력 단계 공통 틀: 상단 바, 진행 막대, 제목, 본문, 아래 고정 버튼.
 * 휴대폰은 한 칸, 태블릿은 넓은 한 칸, PC(1024px~)는 가운데 질문 + 오른쪽 '고른 조건' 요약(스크롤해도 고정).
 */
export function StepShell({
  step,
  title,
  description,
  backHref,
  children,
  footer,
}: {
  step: 1 | 2 | 3 | 4;
  title: string;
  description?: ReactNode;
  backHref: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <main className="mx-auto flex w-full max-w-[30rem] flex-1 flex-col md:max-w-[40rem] lg:max-w-[64rem]">
      <div className="px-5 pt-4 pb-2">
        <TopBar backHref={backHref} backLabel={step === 1 ? "처음 화면으로" : "이전 단계로"} />
      </div>
      <div className="flex flex-1 flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_21rem] lg:gap-8 lg:pr-5">
        <div className="flex flex-1 flex-col">
          <div className="px-5 pt-2">
            <div className="flex justify-between text-sm text-ink-sub">
              <span>
                {step} / 4 단계
              </span>
              <span>{STEPS[step - 1].name}</span>
            </div>
            <div
              className="mt-2 h-1 rounded-full bg-line"
              role="progressbar"
              aria-label="입력 진행"
              aria-valuemin={1}
              aria-valuemax={4}
              aria-valuenow={step}
            >
              <div
                className="h-1 animate-fill rounded-full bg-primary"
                style={{ width: `${step * 25}%`, "--from": `${(step - 1) * 25}%` } as CSSProperties}
              />
            </div>
          </div>
          <div className="animate-rise px-5 pt-6 pb-1">
            <h1 className="text-title font-bold">{title}</h1>
            {description && <p className="mt-2 text-base leading-relaxed text-ink-sub">{description}</p>}
          </div>
          <div className="flex flex-1 animate-rise flex-col pb-6 [animation-delay:60ms]">{children}</div>
          <div className="sticky bottom-0 border-t border-surface bg-white px-5 pt-4 pb-[calc(1.75rem+env(safe-area-inset-bottom))]">
            {footer}
          </div>
        </div>
        <aside className="sticky top-4 mt-2 hidden self-start lg:block" aria-label="지금까지 고른 조건">
          <PlanSummary current={step} />
        </aside>
      </div>
    </main>
  );
}

/**
 * 아직 안 고른 칸으로 스크롤하고 옅은 빨간색으로 잠깐 표시한다(globals.css [data-attention]).
 * 키보드·화면 읽기 사용자를 위해 그 칸의 첫 버튼으로 포커스도 옮긴다.
 */
export function pointTo(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "center" });
  el.removeAttribute("data-attention");
  void el.offsetWidth; // 연달아 눌러도 다시 깜빡이게
  el.setAttribute("data-attention", "");
  el.addEventListener("animationend", () => el.removeAttribute("data-attention"), { once: true });
  el.querySelector<HTMLElement>("button, input, select, a")?.focus({ preventScroll: true });
}

/** 아래 고정 버튼 줄. 다음으로 갈 수 없으면 이유를 버튼 글자로 보여주고, 누르면 빠진 칸을 짚어 준다. */
export function StepFooter({
  prevHref,
  nextHref,
  nextLabel,
  blockedLabel,
  blockedTarget,
}: {
  prevHref?: string;
  nextHref: string;
  nextLabel: string;
  /** 값이 있으면 다음으로 가지 않고 이 문구를 보여준다 */
  blockedLabel?: string | null;
  /** 막혔을 때 누르면 짚어 줄 칸의 id */
  blockedTarget?: string | null;
}) {
  const next = blockedLabel ? (
    <button
      type="button"
      aria-disabled="true"
      onClick={() => blockedTarget && pointTo(blockedTarget)}
      className={buttonClass("disabled", "flex-[2] aria-disabled:pointer-events-auto")}
    >
      {blockedLabel}
    </button>
  ) : (
    <Link href={nextHref} className={buttonClass("primary", "flex-[2] text-lead")}>
      {nextLabel}
    </Link>
  );
  return (
    <div className="flex gap-2.5">
      {prevHref && (
        <Link href={prevHref} className={buttonClass("secondary", "flex-1")}>
          이전
        </Link>
      )}
      {next}
    </div>
  );
}

export function Section({ id, title, hint, children }: { id?: string; title: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="flex flex-col gap-2.5 px-5 pt-6 pb-1">
      <h2 className="text-lg font-bold">{title}</h2>
      {hint && <p className="text-sm leading-normal text-ink-sub">{hint}</p>}
      {children}
    </section>
  );
}
