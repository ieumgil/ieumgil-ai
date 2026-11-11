"use client";

// 2단계 누구와 (시안 Who.dc.html)
import type { ReactNode } from "react";
import { ElderIcon, LockIcon, StrollerIcon, WheelchairIcon } from "@/components/icons";
import { CheckDot, LIFT } from "@/components/plan/choices";
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
    body: "엘리베이터와 수유실·기저귀대를 확인해요",
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
      <div id="field-travelers" className="flex flex-col gap-3 px-5 pt-4 pb-1">
        {TYPES.map((t) => {
          const on = plan.travelers.includes(t.id);
          return (
            <button
              key={t.id}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(t.id)}
              className={`group flex min-h-23 w-full items-center gap-3.5 rounded-2xl border-2 p-4 text-left transition-[background-color,border-color,box-shadow,translate,transform] duration-150 active:scale-[0.99] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                on ? "border-primary bg-primary-soft" : `border-surface bg-surface hover:border-primary/40 hover:bg-white ${LIFT}`
              }`}
            >
              <span className="flex size-13 shrink-0 items-center justify-center rounded-full bg-white text-primary transition-transform duration-200 motion-safe:group-hover:scale-110">
                {t.icon}
              </span>
              <span className="flex flex-1 flex-col gap-1">
                <span className="text-lg font-bold text-ink">{t.title}</span>
                <span className="text-base leading-normal text-ink-sub">{t.body}</span>
              </span>
              <CheckDot on={on} />
            </button>
          );
        })}
        <p className="mt-1 text-sm leading-relaxed text-ink-sub">
          여러 개를 함께 고를 수 있어요. 예: 휠체어를 쓰는 할머니와 유모차를 탄 아이가 함께 가는 여행
        </p>
        <p className="flex items-start gap-1.5 text-sm leading-normal text-ink-sub">
          <LockIcon size={16} className="mt-0.5 shrink-0" />
          이름·연락처는 받지 않아요. 고른 조건은 일정 계산에만 써요.
        </p>
      </div>
    </StepShell>
  );
}
