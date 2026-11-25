"use client";

// 입력 단계의 선택 요소(11/25 다시 그림 — 웹쟁이 레퍼런스: .planning/research/selection-controls-2026-11-25.md).
// 전에는 모든 선택이 '흰 상자 + 회색 테두리 → 파란 테두리 + 연한 파랑 면 + 파란 원 ✓'로 같아 AI 기본 디자인처럼 보였다.
// 실제 사이트처럼 요소 종류마다 한 가지 변화만 쓴다(✓는 색만으로 구분하지 않으려고 모두 남긴다, D-05):
//   · 하나 고르는 분할 칸(SegmentButton) = 삼성생명 다이렉트 성별 칸: 흰 칸 + 1px 선 → 2px 파랑 테두리 + 파랑 글자 500 + ✓ (면 없음)
//   · 알약·타일(ChoiceButton) = SK렌터카 상품 알약: 연회색 면(테두리 없음) → 파랑 면 + 흰 글자 500 + ✓
//   · 목록(CheckRow·CheckBox) = 두루누비·롯데렌터카 폼: 상자 없는 행 + 구분선, 왼쪽 24px 네모 → 파랑 채움 + 흰 ✓, 글자가 진해짐
import type { ReactNode } from "react";
import { CheckIcon } from "@/components/icons";

const focus = "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary";

/**
 * 고르면 나타나는 ✓ 기호. 글자 폭만큼만 차지하는 알약 칩 전용: 버튼 왼쪽 안쪽 여백에 띄워(absolute) 두어, 안 고른 상태에서도 글자가 가운데에 오고
 * 고를 때 폭·글자 자리가 흔들리지 않는다. 알약은 좌우 같은 여백(px-6)이라 ✓와 글자가 겹치지 않는다.
 * 칸 폭이 정해진 분할·타일 버튼은 InlineLabel(✓를 글자 바로 앞에)을 쓴다.
 */
function Mark({ on }: { on: boolean }) {
  return (
    <span aria-hidden="true" className={`pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-sm leading-none font-medium ${on ? "" : "invisible"}`}>
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
        <span aria-hidden="true" className="shrink-0 text-sm leading-none font-medium">
          ✓
        </span>
      )}
      <span className={className}>{children}</span>
    </span>
  );
}

/** 알약·타일 버튼(하나 또는 여러 개). 안 고르면 연회색 면(테두리 없음), 고르면 파랑 면 + 흰 글자 + ✓(SK렌터카 알약). */
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
      className={`relative inline-flex min-h-touch items-center justify-center px-6 text-base press ${focus} ${
        shape === "pill" ? "rounded-full" : "min-h-12 rounded-xl"
      } ${selected ? "bg-primary font-medium text-white" : "bg-surface text-ink hover:bg-line"} ${className}`}
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

/** 한 개 선택 분할 칸(걷는 거리, 일정 밀도, 지역). 흰 칸 + 1px 선, 고르면 2px 파랑 테두리 + 파랑 글자 + ✓(삼성생명 다이렉트 성별 칸). 줄바꿈 허용. */
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
      className={`relative flex min-h-12 items-center justify-center rounded-xl bg-white px-2 text-base text-balance press ${focus} ${
        selected ? "border-2 border-primary font-medium text-primary-ink" : "border border-line-control text-ink-sub hover:border-primary hover:text-ink"
      } ${className}`}
    >
      <InlineLabel on={selected} className={`flex flex-col items-center gap-0.5 ${fluid ? "[overflow-wrap:break-word]" : "min-w-0 [overflow-wrap:anywhere]"}`}>
        {children}
      </InlineLabel>
    </button>
  );
}

/** 24px 네모 체크 표시(목록 행 왼쪽): 안 고르면 흰 칸 + 회색 선, 고르면 파랑 채움 + 흰 ✓. 장식이라 읽지 않는다(상태는 버튼·체크박스가 알린다).
 *  반지름은 6px — 24px 칸에 컨트롤 반지름 12px를 쓰면 동그라미가 되어 라디오처럼 보인다(테마의 중간 반지름은 11px라 칸에 직접 6px를 준다) */
export function CheckBox({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      style={{ borderRadius: "0.375rem" }}
      className={`flex size-6 shrink-0 items-center justify-center border-[1.5px] transition-colors ${on ? "border-primary bg-primary text-white" : "border-line-control bg-white text-transparent"}`}
    >
      <CheckIcon size={16} strokeWidth={2.6} />
    </span>
  );
}

/** 체크박스 줄(조건 목록, 장애인 표지): 상자 없는 행 + 아래 구분선, 왼쪽 24px 네모, 고르면 글자가 진해진다. 태그는 오른쪽 보조 글자. */
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
    <label className="flex min-h-13 cursor-pointer items-center gap-3 border-b border-line py-3 has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary">
      {/* 진짜 체크박스는 네모 위에 투명하게 겹쳐 둔다(누르기·키보드·화면 읽기는 그대로, 보이는 모양은 CheckBox) */}
      <span className="relative flex shrink-0">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="absolute inset-0 m-0 size-6 cursor-pointer opacity-0" />
        <CheckBox on={checked} />
      </span>
      <span className={`flex-1 text-base ${checked ? "font-medium text-ink" : "text-ink-sub"}`}>{children}</span>
      {tag && <span className="shrink-0 text-sm text-ink-sub">{tag}</span>}
    </label>
  );
}
