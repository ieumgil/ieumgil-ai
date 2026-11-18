// 펼치기(네이티브 <details> 위에 44px 요약 줄 + 회전하는 화살표). 훅을 쓰지 않아 서버 부품에서도 쓸 수 있다.
// 쓰는 규칙(UI-SPEC 공통 펼치기 규칙):
// - 요약 글자가 안에 무엇이 있는지 말한다("자세히 · 물어볼 것 2").
// - 접힌 상태에서도 판정 칩, '전화로 확인할 것 있음', '공식 정보 없음', 일반 차량 경로 문구, 개인정보 한 줄은 펼치기 밖에 둔다.
// - 닫힌 펼치기 안의 대상으로 이동할 때는 lib/details.ts의 openDetailsAround로 먼저 연다.
// 기본 모양은 면이 없다(S0). 배경·테두리는 쓰는 곳이 className으로 준다.
import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Disclosure({
  summary,
  children,
  className,
  summaryClassName,
  defaultOpen = false,
  id,
}: {
  summary: ReactNode;
  children: ReactNode;
  className?: string;
  summaryClassName?: string;
  defaultOpen?: boolean;
  id?: string;
}) {
  return (
    <details id={id} data-slot="disclosure" open={defaultOpen || undefined} className={cn("group/disclosure", className)}>
      <summary
        className={cn(
          "flex min-h-touch cursor-pointer list-none items-center justify-between gap-2 text-base font-bold text-ink outline-hidden select-none [&::-webkit-details-marker]:hidden focus-visible:outline-3 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-primary",
          summaryClassName,
        )}
      >
        <span className="min-w-0">{summary}</span>
        <ChevronDown
          size={20}
          aria-hidden="true"
          className="shrink-0 transition-transform duration-[var(--motion-long)] ease-[var(--ease-state)] group-open/disclosure:rotate-180 motion-reduce:transition-none"
        />
      </summary>
      {children}
    </details>
  );
}
