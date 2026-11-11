"use client";

// 3단계 꼭 필요한 조건 (시안 Conditions.dc.html)
// 어떤 조건이 필수/선호인지는 엔진 규칙(src/lib/engine/conditions.ts)이 정하고, 이 화면은 켜고 끄기만 한다.
import Link from "next/link";
import { CheckRow, SegmentButton } from "@/components/plan/choices";
import { INCOMPLETE_ID, IncompleteNotice, incompleteLabel } from "@/components/plan/IncompleteNotice";
import { StepFooter, StepShell } from "@/components/plan/StepShell";
import { TRAVELER_LABELS, conditionRows } from "@/lib/engine/conditions";
import { updatePlan, usePlan } from "@/lib/plan/store";
import type { WalkLimit } from "@/lib/plan/types";

const TRAVELER_CHIPS = { wheelchair: "휠체어 이용", elder: "보행이 불편한 어르신", stroller: "유모차 동반" } as const;
const WALK_LIMITS: { value: WalkLimit; label: string }[] = [
  { value: 100, label: "100m" },
  { value: 300, label: "300m" },
  { value: 500, label: "500m" },
  { value: null, label: "제한 없음" },
];

export function ConditionsStep() {
  const plan = usePlan();
  const rows = conditionRows(plan);
  const setOn = (key: string, on: boolean) =>
    updatePlan((cur) => ({ conditionOverrides: { ...cur.conditionOverrides, [key]: on } }));
  const hasParking = rows.must.some((r) => r.key === "disabled_parking");
  const parkingHint =
    plan.transport === "car" &&
    !plan.disabledPermit &&
    plan.travelers.some((t) => t === "wheelchair" || t === "elder");

  return (
    <StepShell
      step={3}
      backHref="/plan/who"
      title="꼭 필요한 조건을 확인해 주세요"
      footer={
        <StepFooter
          prevHref="/plan/who"
          nextHref="/plan/taste"
          nextLabel="다음 · 좋아하는 곳"
          blockedLabel={incompleteLabel(plan, 3)}
          blockedTarget={INCOMPLETE_ID}
        />
      }
    >
      <div className="flex flex-wrap items-center gap-2 px-5 pt-3">
        {plan.travelers.map((t) => (
          <span key={t} className="rounded-full bg-primary-soft px-3 py-1.5 text-sm font-medium text-primary-ink">
            {TRAVELER_CHIPS[t]}
          </span>
        ))}
        <Link href="/plan/who" className="flex min-h-touch items-center px-1 text-base text-primary underline-offset-4 hover:underline">
          바꾸기
        </Link>
      </div>
      <IncompleteNotice plan={plan} step={3} />

      <div className="flex flex-col gap-2 px-5 pt-3">
        {rows.must.length > 0 && (
          <>
            <h2 className="mt-2 mb-0.5 text-base font-bold">꼭 필요해요 · 하나라도 안 맞으면 루트에서 빼요</h2>
            {rows.must.map((r) => (
              <CheckRow key={r.key} checked={r.on} onChange={(v) => setOn(r.key, v)} tag={r.who}>
                {r.label}
              </CheckRow>
            ))}
          </>
        )}
        {hasParking && (
          <p className="text-sm leading-normal text-ink-sub">
            장애인 전용 주차구역은 1단계에서 &lsquo;장애인 사용 자동차 표지&rsquo;를 골라서 나와요.
          </p>
        )}
        {parkingHint && (
          <p className="text-sm leading-normal text-ink-sub">
            장애인 사용 자동차 표지가 있으면{" "}
            <Link href="/plan/when" className="text-primary underline underline-offset-4">
              1단계
            </Link>
            에서 골라 주세요. 장애인 전용 주차구역도 확인해요.
          </p>
        )}

        {rows.showWalkLimit && (
          <>
            <h2 className="mt-3.5 mb-0.5 text-base font-bold" id="walk-limit">
              한 번에 걸을 수 있는 거리 · {TRAVELER_LABELS.elder} 기준
            </h2>
            <p className="mb-1 text-sm leading-normal text-ink-sub">주차장에서 입구까지, 관람 동선 길이와 비교해요</p>
            <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-labelledby="walk-limit">
              {WALK_LIMITS.map((w) => (
                <SegmentButton
                  key={w.label}
                  selected={plan.walkLimit === w.value}
                  onClick={() => updatePlan({ walkLimit: w.value })}
                  className="text-base font-medium"
                >
                  {w.label}
                </SegmentButton>
              ))}
            </div>
          </>
        )}

        {rows.prefer.length > 0 && (
          <>
            <h2 className="mt-3.5 mb-0.5 text-base font-bold">있으면 좋아요 · 추천 순위에만 반영해요</h2>
            {rows.prefer.map((r) => (
              <CheckRow key={r.key} checked={r.on} onChange={(v) => setOn(r.key, v)} tag={r.who}>
                {r.label}
              </CheckRow>
            ))}
          </>
        )}
      </div>
    </StepShell>
  );
}
