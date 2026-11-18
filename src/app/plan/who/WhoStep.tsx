"use client";

// 2단계 누구와 (시안 Who.dc.html)
import type { ReactNode } from "react";
import { ElderIcon, LockIcon, StrollerIcon, WheelchairIcon } from "@/components/icons";
import { CheckDot } from "@/components/plan/choices";
import { INCOMPLETE_ID, IncompleteNotice, incompleteLabel } from "@/components/plan/IncompleteNotice";
import { StepFooter, StepShell } from "@/components/plan/StepShell";
import { updatePlan, usePlan } from "@/lib/plan/store";
import type { TravelerType } from "@/lib/plan/types";

const TYPES: { id: TravelerType; title: string; body: string; icon: ReactNode }[] = [
  {
    id: "wheelchair",
    title: "휠체어 이용",
    body: "계단·단차 없는 길과 장애인 화장실을 확인해요",
    icon: <WheelchairIcon size={28} />,
  },
  {
    id: "elder",
    title: "보행이 불편한 어르신",
    body: "걷는 거리와 쉴 곳을 먼저 확인해요",
    icon: <ElderIcon size={28} />,
  },
  {
    id: "stroller",
    title: "유모차 동반",
    body: "엘리베이터와 수유실·기저귀 교환대를 확인해요",
    icon: <StrollerIcon size={28} />,
  },
];

export function WhoStep() {
  const plan = usePlan();
  const toggle = (id: TravelerType) =>
    updatePlan((cur) => ({
      travelers: cur.travelers.includes(id) ? cur.travelers.filter((t) => t !== id) : [...cur.travelers, id],
    }));

  return (
    <StepShell
      step={2}
      backHref="/plan/when"
      title="누구와 함께 여행하나요?"
      description="해당하는 것을 모두 골라 주세요. 고른 유형에 맞춰 꼭 필요한 조건을 미리 켜 둘게요."
      footer={
        <StepFooter
          prevHref="/plan/when"
          nextHref="/plan/conditions"
          nextLabel="다음 · 꼭 필요한 조건"
          blockedLabel={plan.travelers.length === 0 ? "유형을 골라 주세요" : incompleteLabel(plan, 2)}
          blockedTarget={plan.travelers.length === 0 ? "field-travelers" : INCOMPLETE_ID}
        />
      }
    >
      <IncompleteNotice plan={plan} step={2} />
      <div id="field-travelers" className="flex flex-col gap-3 px-4 md:px-6">
        {TYPES.map((t) => {
          const on = plan.travelers.includes(t.id);
          return (
            <button
              key={t.id}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(t.id)}
              className={`flex min-h-20 w-full flex-wrap items-center gap-3 rounded-2xl p-4 text-left transition-[background-color,border-color] duration-150 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                on ? "border-2 border-primary bg-primary-soft" : "border-[1.5px] border-line-control bg-white hover:border-primary"
              }`}
            >
              <span className="shrink-0 text-primary">{t.icon}</span>
              <span className="flex min-w-0 grow basis-[10rem] flex-col gap-1">
                <span className="text-base font-bold text-ink">{t.title}</span>
                <span className="text-base text-ink-sub">{t.body}</span>
              </span>
              <span className="ml-auto">
                <CheckDot on={on} />
              </span>
            </button>
          );
        })}
        <p className="text-sm text-ink-sub">여러 개를 함께 고를 수 있어요 · 예: 휠체어를 쓰는 할머니와 유모차를 탄 아이가 함께 가는 여행</p>
        <p className="flex items-start gap-2 text-sm text-ink-sub">
          <LockIcon size={16} className="mt-0.5 shrink-0" />
          이름·연락처는 받지 않아요. 고른 조건은 일정 계산에만 써요.
        </p>
      </div>
    </StepShell>
  );
}
