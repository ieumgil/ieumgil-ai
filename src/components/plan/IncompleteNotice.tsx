"use client";

import Link from "next/link";
import { firstIncompleteStep } from "@/lib/plan/progress";
import type { PlanInput } from "@/lib/plan/types";

export const INCOMPLETE_ID = "field-incomplete";

/** 앞 단계가 덜 채워졌을 때 안내(주소로 바로 들어온 경우 등) */
export function IncompleteNotice({ plan, step }: { plan: PlanInput; step: number }) {
  const missing = firstIncompleteStep(plan, step - 1);
  if (!missing) return null;
  return (
    <div id={INCOMPLETE_ID} className="mx-5 mt-4 rounded-xl bg-caution-bg px-4 py-3 text-base text-caution-ink" role="status">
      <span aria-hidden="true" className="font-bold">
        !{" "}
      </span>
      앞 단계 &lsquo;{missing.name}&rsquo;에서 아직 고르지 않은 항목이 있어요.{" "}
      <Link href={missing.href} className="inline-flex min-h-touch items-center font-bold underline underline-offset-4">
        채우러 가기
      </Link>
    </div>
  );
}

/** 앞 단계가 덜 채워졌으면 다음 버튼에 보여줄 문구 */
export function incompleteLabel(plan: PlanInput, step: number): string | null {
  const missing = firstIncompleteStep(plan, step - 1);
  return missing ? `'${missing.name}' 단계를 먼저 채워 주세요` : null;
}
