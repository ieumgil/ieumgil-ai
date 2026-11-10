import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { TopBar } from "@/components/TopBar";
import { buttonClass } from "@/components/ui/button";
import { STEPS } from "@/lib/plan/progress";

/** 입력 단계 공통 틀: 상단 바, 진행 막대, 제목, 본문, 아래 고정 버튼 */
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
    <main className="mx-auto flex w-full max-w-[30rem] flex-1 flex-col">
      <div className="px-5 pt-4 pb-2">
        <TopBar backHref={backHref} backLabel={step === 1 ? "처음 화면으로" : "이전 단계로"} />
      </div>
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
    </main>
  );
}

/** 아래 고정 버튼 줄. 다음으로 갈 수 없으면 이유를 버튼 글자로 보여준다. */
export function StepFooter({
  prevHref,
  nextHref,
  nextLabel,
  blockedLabel,
}: {
  prevHref?: string;
  nextHref: string;
  nextLabel: string;
  /** 값이 있으면 다음 버튼을 비활성으로 두고 이 문구를 보여준다 */
  blockedLabel?: string | null;
}) {
  const next = blockedLabel ? (
    <button type="button" disabled className={buttonClass("disabled", "flex-[2]")}>
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

export function Section({ title, hint, children }: { title: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5 px-5 pt-6">
      <h2 className="text-lg font-bold">{title}</h2>
      {hint && <p className="text-sm leading-normal text-ink-sub">{hint}</p>}
      {children}
    </section>
  );
}
