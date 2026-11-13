// 결과 화면 맨 아래 안내: 일반 차량 경로 · 추정 이동시간 · 출처 등.
import { ChevronDown, Sparkles } from "lucide-react";
import type { TripView } from "@/lib/trip/view";

export function Footnotes({ trip }: { trip: TripView }) {
  return (
    <div className="px-5 lg:px-0">
      <section className="mt-8 flex flex-col gap-1.5 text-sm leading-normal text-ink-sub">
        <p>이동 시간은 직선거리로 어림한 추정치예요. 경로는 일반 차량 기준이며 휠체어 안전 경로를 뜻하지 않아요.</p>
        <p>접근성 정보는 한국관광공사 무장애 여행정보를 AI가 읽고 정리한 것이라 현장과 다를 수 있어요.</p>
      </section>
      <details className="group mt-5 rounded-2xl bg-surface px-4 py-1">
        <summary className="flex min-h-touch cursor-pointer list-none items-center justify-between text-base font-bold">
          <span className="inline-flex items-center gap-2">
            <Sparkles size={18} aria-hidden="true" />
            AI 설계 과정 보기
          </span>
          <ChevronDown size={20} className="transition-transform duration-200 group-open:rotate-180" aria-hidden="true" />
        </summary>
        <ul className="flex flex-col gap-1.5 pb-3 text-sm leading-normal text-ink-sub">
          <li>
            AI 호출 {trip.calls}회 · {Math.round(trip.ms / 1000)}초
          </li>
          <li>장소 판단: 후보마다 3번 판단해 맞춰 보고, 근거가 원문에 없으면 버렸어요.</li>
          {trip.options.map((o) => (
            <li key={o.id}>
              {o.id}안 {o.title}: {o.source === "ai" ? `검사 통과${o.fixes ? ` (다시 고친 횟수 ${o.fixes})` : ""}` : "규칙 일정"}
              {o.fixedViolations.length > 0 && <span> · 고친 내용: {o.fixedViolations.join(" / ")}</span>}
              {o.review && <span> · 점검: {o.review.comment}</span>}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
