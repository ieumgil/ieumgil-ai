// 일정 타임라인 공통 부품(결과 화면 OptionDetail · 확정·공유 화면 DayList가 함께 쓴다):
// 왼쪽 세로 1px 점선(11/25, globals.css .timeline-rail) 위에 출발·도착 깃발, 이동·점심·쉬는 시간은 작은 점, 장소는 번호 동그라미 + 카드.
import type { ReactNode } from "react";
import { TimelineProgress } from "./TimelineProgress";

/** 왼쪽 세로 연결선 + 스크롤 진행 표시(지나온 선은 파랑, 작은 원이 따라 내려감). <ol className="relative …"> 맨 앞에 둔다 */
export function TimelineLine() {
  return (
    <>
      <span className="timeline-rail absolute top-4 bottom-4 left-[calc(1rem-0.5px)]" aria-hidden="true" />
      <TimelineProgress />
    </>
  );
}

/** 타임라인 한 줄: 출발·도착만 깃발 아이콘, 나머지(이동·점심·쉬는 시간)는 세로선 위의 작은 점 + 글자 */
export function TimelineNode({ icon, children, small }: { icon?: ReactNode; children: ReactNode; small?: boolean }) {
  return (
    <li className={`relative flex items-center gap-3 py-2 ${small ? "text-sm text-ink-sub" : "text-base"}`}>
      {icon ? (
        <span data-timeline-marker="flag" className="z-10 flex size-8 shrink-0 items-center justify-center rounded-full bg-surface text-ink-sub ring-4 ring-white" aria-hidden="true">
          {icon}
        </span>
      ) : (
        <span className="z-10 flex size-8 shrink-0 items-center justify-center" aria-hidden="true">
          <span data-timeline-marker="dot" className="size-2 rounded-full bg-line-strong ring-4 ring-white" />
        </span>
      )}
      <span className="min-w-0">{children}</span>
    </li>
  );
}
