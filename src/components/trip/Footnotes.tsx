// 결과 화면 맨 아래 안내: AI가 정리한 정보라는 것 + 'AI 설계 과정'(펼치기).
// 이동 시간·경로 문장은 11/24 뺐다(지도 아래 '일반 차량 경로 · …' 설명이 원칙 6을 맡고, 추정 구간은 이동 줄에 '추정'으로 붙는다).
import { Disclosure } from "@/components/ui/disclosure";
import type { TripView } from "@/lib/trip/view";

export function Footnotes({ trip }: { trip: TripView }) {
  return (
    <div className="mt-8 border-t border-line px-4 lg:px-0">
      <section className="mt-6 flex flex-col gap-2 text-sm leading-normal text-ink-sub">
        <p>접근성 정보는 한국관광공사 무장애 여행정보를 AI가 읽고 정리한 것이라 현장과 다를 수 있어요.</p>
      </section>
      <Disclosure summary="AI 설계 과정 보기" className="mt-4">
        <ul className="flex flex-col gap-2 pb-4 text-sm leading-normal text-ink-sub">
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
      </Disclosure>
    </div>
  );
}
