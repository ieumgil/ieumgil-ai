// 결과 화면 맨 위 머리: h1(몇 가지 일정을 만들었는지) + 조건을 글자로만 쓴 한 줄 meta + 안내(규칙 일정·후보 부족 등).
// 첫 화면의 색 띠는 하나뿐이다: bandUsed(예시 안내 띠를 이미 썼는지)가 거짓이면 안내 후보 중 첫 번째만 띠, 나머지는 배경 없는 '!' + 글자 줄.
// 문장은 하나도 지우지 않는다(규칙 일정 안내 등 사용자가 알아야 할 말).
import type { ReactNode } from "react";
import { TRAVELER_LABELS } from "@/lib/engine/conditions";
import { formatRange, nightsBetween, tripLabel } from "@/lib/plan/dates";
import { lodgingText } from "@/lib/plan/summary";
import type { TripView } from "@/lib/trip/view";

type Note = { text: string; tone: "caution" | "info" };

export function Summary({ trip, bandUsed = false }: { trip: TripView; bandUsed?: boolean }) {
  const { input } = trip;
  const nights = input.startDate && input.endDate ? nightsBetween(input.startDate, input.endDate) : 0;
  const ai = !trip.usedFallback;
  const meta = [
    ai ? "AI 추천" : "기본 일정",
    input.startDate && input.endDate ? formatRange(input.startDate, input.endDate) : "",
    tripLabel(nights),
    input.travelers.map((t) => TRAVELER_LABELS[t]).join(" · "),
    input.transport === "car" ? "자가용" : "택시",
    input.lodging ? `숙소 ${lodgingText(input.lodging, nights > 1 ? input.lodging2 : "same")}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  // 띠 후보 순서: 규칙 일정 안내(AI 실패) → 후보 부족 안내 → 그 밖의 안내
  const notes: Note[] = [
    ...(!ai ? [{ text: "AI 응답을 받지 못해 AI 판단 없이 짠 기본 일정이에요. 꼭 필요한 조건과 시간은 똑같이 검사했어요.", tone: "caution" as const }] : []),
    ...(ai && trip.oneOption ? [{ text: trip.oneOption, tone: "info" as const }] : []),
    ...trip.notes.map((text) => ({ text, tone: "caution" as const })),
  ];
  return (
    <header className="animate-rise px-4 pt-4 md:px-6 lg:px-0">
      <h1 className="font-heading text-title font-bold text-balance">
        {!ai ? "기본 일정을 만들었어요" : trip.options.length > 1 ? `일정 ${trip.options.length}가지를 만들었어요` : "일정을 만들었어요"}
      </h1>
      <p className="mt-2 text-sm text-pretty text-ink-sub">{meta}</p>
      {notes.map((n, i) => (n.tone === "info" ? <InfoLine key={n.text} band={!bandUsed && i === 0}>{n.text}</InfoLine> : <Notice key={n.text} band={!bandUsed && i === 0}>{n.text}</Notice>))}
    </header>
  );
}

/** 주의 안내: band면 색 띠(첫 화면에 하나), 아니면 배경 없는 '!' + 글자 줄 */
function Notice({ children, band }: { children: ReactNode; band: boolean }) {
  return (
    <p className={`flex items-start gap-2 text-base text-caution-ink ${band ? "mt-4 rounded-2xl bg-caution-bg px-4 py-3" : "mt-3"}`}>
      <span className="font-bold" aria-hidden="true">
        !
      </span>
      <span>
        <span className="sr-only">주의: </span>
        {children}
      </span>
    </p>
  );
}

/** 안내(후보가 적어 안을 줄였을 때 등): band면 연한 파랑 띠, 아니면 배경 없는 줄 */
function InfoLine({ children, band }: { children: ReactNode; band: boolean }) {
  return (
    <p className={`flex items-start gap-2 text-base ${band ? "mt-4 rounded-2xl bg-primary-soft px-4 py-3 text-primary-ink" : "mt-3 text-ink-sub"}`}>
      <span className="font-bold" aria-hidden="true">
        !
      </span>
      <span>{children}</span>
    </p>
  );
}
