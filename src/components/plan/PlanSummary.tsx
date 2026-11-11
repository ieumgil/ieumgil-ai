"use client";

// PC 입력 단계 오른쪽: 지금까지 고른 조건이 단계마다 쌓이는 요약 카드. 단계 이름을 누르면 그 단계로 간다.
// 값은 이 탭의 입력 보관소(sessionStorage)에서만 읽는다(서버로 보내지 않음).
import { Check } from "lucide-react";
import Link from "next/link";
import { STEPS, tasteDone, whenDone, whoDone } from "@/lib/plan/progress";
import { usePlan } from "@/lib/plan/store";
import { summaryLines } from "@/lib/plan/summary";

export function PlanSummary({ current }: { current: 1 | 2 | 3 | 4 }) {
  const plan = usePlan();
  const lines = summaryLines(plan);
  // 3단계(조건)는 꼭 고를 것이 없어 지나간 뒤에만 끝난 것으로 본다
  const done = [whenDone(plan), whoDone(plan), whoDone(plan) && current > 3, tasteDone(plan)];
  return (
    <section aria-labelledby="plan-summary" className="rounded-3xl bg-surface p-5">
      <h2 id="plan-summary" className="text-lg font-bold">
        고른 조건
      </h2>
      <ol className="mt-3 flex flex-col gap-1">
        {STEPS.map((s, i) => {
          const here = i + 1 === current;
          return (
            <li key={s.href} className={`rounded-2xl px-3 py-2 ${here ? "bg-white ring-2 ring-primary" : ""}`} aria-current={here ? "step" : undefined}>
              <Link href={s.href} className="flex min-h-touch items-center gap-2 text-base font-bold underline-offset-4 hover:underline">
                <span
                  className={`flex size-6 shrink-0 items-center justify-center rounded-full text-sm ${done[i] ? "bg-primary text-white" : here ? "bg-primary-soft text-primary-ink" : "bg-white text-ink-sub"}`}
                  aria-hidden="true"
                >
                  {done[i] ? <Check size={14} strokeWidth={3} /> : i + 1}
                </span>
                {s.name}
                {done[i] && <span className="sr-only">(고름)</span>}
              </Link>
              {lines[i].length > 0 ? (
                <ul className="flex flex-col gap-0.5 pb-1 pl-8 text-base leading-snug text-ink">
                  {lines[i].map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              ) : (
                <p className="pb-1 pl-8 text-base text-ink-sub">{here ? "지금 고르는 중이에요" : "아직 안 골랐어요"}</p>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
