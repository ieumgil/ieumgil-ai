"use client";

// 입력 단계의 선택 버튼들(시안 When·Who·Conditions·Taste).
import type { ReactNode } from "react";
import { CheckIcon } from "@/components/icons";

const focus = "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary";

/**
 * 고르면 앞에 나타나는 ✓ 기호. 색만으로 구분하지 않으려고 쓰고(D-05),
 * 안 고른 상태에서도 같은 자리를 invisible로 차지해 고를 때 폭이 흔들리지 않는다.
 */
function Mark({ on }: { on: boolean }) {
  return (
    <span aria-hidden="true" className={`font-bold ${on ? "" : "invisible"}`}>
      ✓
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
      className={`inline-flex min-h-touch items-center justify-center gap-1 px-4 text-base font-bold transition-[color,background-color,border-color] duration-150 ${focus} ${
        shape === "pill" ? "rounded-full" : "min-h-12 rounded-xl"
      } ${selected ? "border-2 border-primary bg-primary-soft text-primary-ink" : "border-[1.5px] border-line-control bg-white text-ink hover:border-primary"} ${className}`}
    >
      <Mark on={selected} />
      <span className="min-w-0 [overflow-wrap:anywhere]">{children}</span>
    </button>
  );
}

/** 한 개 선택(걷는 거리, 일정 밀도, 지역). ChoiceButton과 같은 S1 상태이고 줄바꿈을 허용한다. */
export function SegmentButton({
  selected,
  onClick,
  children,
  className = "",
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={`flex min-h-12 items-center justify-center gap-1 rounded-xl px-1 text-base font-bold text-balance transition-[color,background-color,border-color] duration-150 ${focus} ${
        selected ? "border-2 border-primary bg-primary-soft text-primary-ink" : "border-[1.5px] border-line-control bg-white text-ink hover:border-primary"
      } ${className}`}
    >
      <Mark on={selected} />
      <span className="flex min-w-0 flex-col items-center gap-0.5 [overflow-wrap:anywhere]">{children}</span>
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
