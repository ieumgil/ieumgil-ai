// 내부 화면 공용 머리 띠(11/25, 단계 4): 하늘색이 아래로 흐려지는 띠(globals.css .page-band) 안에 화면의 유일한 h1과 설명.
// 띠는 화면 좌우 끝까지, 안쪽(inner)은 그 화면 본문과 같은 폭·여백 클래스를 받아 제목이 본문 왼쪽 끝과 맞는다.
// 서버 화면(/s/[id])에서도 쓰므로 훅·window를 쓰지 않는다. 움직이지 않고, 인쇄에는 나오지 않는다(print:hidden).
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  trail,
  top,
  aside,
  inner,
  density = "default",
  titleClassName,
  className,
}: {
  title: ReactNode;
  /** 제목 아래 설명·meta(16px 보조 글자) */
  description?: ReactNode;
  /** 제목 위 입력 단계 표시(StepTrail) */
  trail?: ReactNode;
  /** 제목 위 줄: 뒤로 버튼(TopBar)·'다른 안 보기/공유/인쇄' 같은 것 */
  top?: ReactNode;
  /** PC 오른쪽 그림(소개 글). 있으면 무늬를 끈다 */
  aside?: ReactNode;
  /** 그 화면 본문 컨테이너와 같은 폭·좌우 여백 클래스 */
  inner: string;
  /** compact: 목록이 먼저 보여야 하는 화면(결과 안 비교·둘러보기) */
  density?: "default" | "compact";
  titleClassName?: string;
  className?: string;
}) {
  const pad = top
    ? density === "compact"
      ? "pt-4 pb-4 lg:pb-6"
      : "pt-4 pb-6 lg:pb-8"
    : density === "compact"
      ? "pt-4 pb-4 md:pt-6 lg:pt-8 lg:pb-6"
      : "pt-8 pb-6 lg:pt-12 lg:pb-8";
  const text = (
    <div className="min-w-0">
      {trail && <div className="mb-4">{trail}</div>}
      <h1 className={cn("font-heading text-title font-bold text-balance [overflow-wrap:anywhere]", titleClassName)}>{title}</h1>
      {description && <div className="mt-2 text-base text-ink-sub text-pretty">{description}</div>}
    </div>
  );
  return (
    <header className={cn("page-band w-full print:hidden", className)} data-aside={aside ? "" : undefined}>
      <div className={cn(inner, pad)}>
        {top && <div className="mb-2">{top}</div>}
        {aside ? (
          <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-12">
            {text}
            {aside}
          </div>
        ) : (
          text
        )}
      </div>
    </header>
  );
}
