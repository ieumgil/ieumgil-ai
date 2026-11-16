"use client";

// 입력 단계의 선택 버튼들(시안 When·Who·Conditions·Taste).
import type { ReactNode } from "react";
import { CheckIcon } from "@/components/icons";

const focus = "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary";

/**
 * 고르면 나타나는 ✓ 기호. 색만으로 구분하지 않으려고 쓴다(D-05).
 * 글자 폭만큼만 차지하는 알약 칩 전용: 버튼 왼쪽 안쪽 여백에 띄워(absolute) 두어, 안 고른 상태에서도 글자가 가운데에 오고
 * 고를 때 폭·글자 자리가 흔들리지 않는다. 알약은 좌우 같은 여백(px-6)이라 ✓와 글자가 겹치지 않는다.
 * 칸 폭이 정해진 분할·타일 버튼은 InlineLabel(✓를 글자 바로 앞에)을 쓴다.
 */
function Mark({ on }: { on: boolean }) {
  return (
    <span aria-hidden="true" className={`pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-sm leading-none font-bold ${on ? "" : "invisible"}`}>
      ✓
    </span>
  );
}

/**
 * 칸 폭이 정해진 넓은 버튼(분할·타일)의 글자 묶음: 고르면 ✓를 글자 바로 앞에 붙여 '✓ 속초 30곳'을 한 묶음으로 가운데에 둔다.
 * 안 고르면 ✓ 자리를 비우지 않고 글자만 가운데에 온다(칸 폭은 격자가 정해서 흔들리지 않는다). ✓는 장식이라 접근 이름은 그대로.
 * 두 줄 글자(밀도 '보통 / 하루 3~4곳')는 baseline 정렬로 ✓가 첫 줄에 붙는다.
 */
function InlineLabel({ on, className, children }: { on: boolean; className: string; children: ReactNode }) {
  return (
    <span className="flex min-w-0 items-baseline justify-center gap-1">
      {on && (
        <span aria-hidden="true" className="shrink-0 text-sm leading-none font-bold">
          ✓
        </span>
      )}
      <span className={className}>{children}</span>
    </span>
  );
}

/** 하나 또는 여러 개 고르는 알약/네모 버튼(S1). 안 고르면 흰 바탕 + 회색 윤곽, 고르면 2px 파란 테두리 + 연한 파랑 + ✓. */
export function ChoiceButton({
  selected,
  onClick,
  children,
  shape = "pill",
  role,
  className = "",
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  shape?: "pill" | "tile";
  /** 한 개만 고르는 묶음 안이면 "radio" */
  role?: "radio";
  className?: string;
}) {
  const a11y = role === "radio" ? { role, "aria-checked": selected } : { "aria-pressed": selected };
  return (
    <button
      type="button"
      onClick={onClick}
      {...a11y}
      className={`relative inline-flex min-h-touch items-center justify-center px-6 text-base font-bold transition-[color,background-color,border-color] duration-150 ${focus} ${
        shape === "pill" ? "rounded-full" : "min-h-12 rounded-xl"
      } ${selected ? "border-2 border-primary bg-primary-soft text-primary-ink" : "border-[1.5px] border-line-control bg-white text-ink hover:border-primary"} ${className}`}
    >
      {shape === "tile" ? (
        // 타일은 격자 칸(폭 고정)이라 ✓를 글자 앞에 붙인다. 알약은 글자 폭만큼이라 왼쪽 여백에 띄운다.
        <InlineLabel on={selected} className="min-w-0 [overflow-wrap:anywhere]">
          {children}
        </InlineLabel>
      ) : (
        <>
          <Mark on={selected} />
          <span className="min-w-0 [overflow-wrap:anywhere]">{children}</span>
        </>
      )}
    </button>
  );
}

/** 한 개 선택(걷는 거리, 일정 밀도, 지역). ChoiceButton과 같은 S1 상태이고 줄바꿈을 허용한다. */
export function SegmentButton({
  selected,
  onClick,
  children,
  className = "",
  fluid = false,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
  /** 줄바꿈 묶음(flex-wrap) 안에서 쓴다: 글자가 커져 낱말이 안 들어가면 버튼이 아래 줄로 내려간다(칸을 줄이지 않음) */
  fluid?: boolean;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={`relative flex min-h-12 items-center justify-center rounded-xl px-2 text-base font-bold text-balance transition-[color,background-color,border-color] duration-150 ${focus} ${
        selected ? "border-2 border-primary bg-primary-soft text-primary-ink" : "border-[1.5px] border-line-control bg-white text-ink hover:border-primary"
      } ${className}`}
    >
      <InlineLabel on={selected} className={`flex flex-col items-center gap-0.5 ${fluid ? "[overflow-wrap:break-word]" : "min-w-0 [overflow-wrap:anywhere]"}`}>
        {children}
      </InlineLabel>
    </button>
  );
}

/** 둥근 체크 표시(큰 카드 오른쪽) */
export function CheckDot({ on, size = "md" }: { on: boolean; size?: "md" | "sm" }) {
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full border-2 ${
        size === "md" ? "size-7" : "size-6"
      } ${on ? "animate-pop border-primary bg-primary text-white" : "border-line-control bg-white text-transparent group-hover:border-primary"}`}
    >
      <CheckIcon size={size === "md" ? 16 : 14} strokeWidth={2.6} />
    </span>
  );
}

/** 체크박스 줄(조건 목록, 장애인 표지). S1 행: 흰 바탕 + 회색 윤곽, 체크하면 파란 테두리. 태그는 상자 없이 글자만. */
export function CheckRow({
  checked,
  onChange,
  children,
  tag,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  children: ReactNode;
  tag?: string;
}) {
  return (
    <label
      className={`flex min-h-13 cursor-pointer items-center gap-3 rounded-xl border-[1.5px] bg-white px-4 py-3 transition-[border-color] duration-150 has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary ${
        checked ? "border-primary" : "border-line-control hover:border-primary"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-5.5 shrink-0 accent-primary"
      />
      <span className="flex-1 text-base">{children}</span>
      {tag && <span className="shrink-0 text-sm text-ink-sub">{tag}</span>}
    </label>
  );
}
