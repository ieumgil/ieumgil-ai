"use client";

// 입력 단계의 선택 버튼들(시안 When·Who·Conditions·Taste).
import type { ReactNode } from "react";
import { CheckIcon } from "@/components/icons";

const focus = "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary";

/** 하나 또는 여러 개 고르는 알약/네모 버튼. 고르면 연한 파랑 + 파란 테두리. */
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
      className={`min-h-touch border-[1.5px] px-3.5 text-base transition-colors ${focus} ${
        shape === "pill" ? "rounded-full" : "min-h-12 rounded-xl"
      } ${selected ? "border-primary bg-primary-soft font-bold text-primary-ink" : "border-surface bg-surface text-ink"} ${className}`}
    >
      {children}
    </button>
  );
}

/** 꽉 찬 파랑으로 표시하는 한 개 선택(걷는 거리, 일정 밀도) */
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
      className={`flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl border-[1.5px] px-1 transition-colors ${focus} ${
        selected ? "border-primary bg-primary text-white" : "border-surface bg-surface text-ink"
      } ${className}`}
    >
      {children}
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
      } ${on ? "border-primary bg-primary text-white" : "border-line-strong bg-white text-transparent"}`}
    >
      <CheckIcon size={size === "md" ? 16 : 14} strokeWidth={2.6} />
    </span>
  );
}

/** 체크박스 줄(조건 목록, 장애인 표지) */
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
      className={`flex min-h-13 cursor-pointer items-center gap-3 rounded-xl border-[1.5px] bg-surface px-3.5 py-2.5 transition-colors has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary ${
        checked ? "border-primary" : "border-surface"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-5.5 shrink-0 accent-primary"
      />
      <span className="flex-1 text-base">{children}</span>
      {tag && <span className="shrink-0 rounded-lg bg-white px-2 py-0.5 text-sm text-ink-sub">{tag}</span>}
    </label>
  );
}
