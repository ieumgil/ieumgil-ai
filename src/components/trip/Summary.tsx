// 결과 화면 맨 위: h1(몇 가지 일정을 만들었는지) + 조건을 글자로만 쓴 한 줄 meta는 머리 띠(PageHeader, 11/25)에 — summaryHead.
// Summary는 띠 아래 안내(규칙 일정·후보 부족 등)만 그린다.
// 첫 화면의 색 띠는 하나뿐이다(하늘색 머리 띠는 화면 배경이라 세지 않는다): bandUsed(예시 안내 띠를 이미 썼는지)가 거짓이면 안내 후보 중 첫 번째만 띠, 나머지는 배경 없는 '!' + 글자 줄.
// 문장은 하나도 지우지 않는다(규칙 일정 안내 등 사용자가 알아야 할 말).
import type { ReactNode } from "react";
import { TRAVELER_LABELS } from "@/lib/engine/conditions";
import { formatRange, nightsBetween, tripLabel } from "@/lib/plan/dates";
import { lodgingText } from "@/lib/plan/summary";
import type { TripView } from "@/lib/trip/view";

type Note = { text: string; tone: "caution" | "info" };

/** 머리 띠에 들어갈 제목과 meta 한 줄 */
export function summaryHead(trip: TripView): { title: string; meta: string } {
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
  const title = !ai ? "기본 일정을 만들었어요" : trip.options.length > 1 ? `일정 ${trip.options.length}가지를 만들었어요` : "일정을 만들었어요";
  return { title, meta };
}

export function Summary({ trip, bandUsed = false }: { trip: TripView; bandUsed?: boolean }) {
  const ai = !trip.usedFallback;
  // 띠 후보 순서: 규칙 일정 안내(AI 실패) → 후보 부족 안내 → 그 밖의 안내
  const notes: Note[] = [
    ...(!ai ? [{ text: "AI 응답을 받지 못해 AI 판단 없이 짠 기본 일정이에요. 꼭 필요한 조건과 시간은 똑같이 검사했어요.", tone: "caution" as const }] : []),
    ...(ai && trip.oneOption ? [{ text: trip.oneOption, tone: "info" as const }] : []),
    ...trip.notes.map((text) => ({ text, tone: "caution" as const })),
  ];
  if (notes.length === 0) return null;
  return (
    <div className="animate-rise px-4 md:px-6 lg:px-0 [&>:first-child]:mt-0">
      {notes.map((n, i) => (n.tone === "info" ? <InfoLine key={n.text} band={!bandUsed && i === 0}>{n.text}</InfoLine> : <Notice key={n.text} band={!bandUsed && i === 0}>{n.text}</Notice>))}
    </div>
  );
}

/** 주의 안내: band면 색 띠(첫 화면에 하나), 아니면 배경 없는 '!' + 글자 줄 */
function Notice({ children, band }: { children: ReactNode; band: boolean }) {
  return (
    <p className={`flex items-start gap-2 text-base text-caution-ink ${band ? "mt-4 rounded-2xl bg-caution-bg px-4 py-3" : "mt-3"}`}>
      <span className="font-medium" aria-hidden="true">
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
      <span className="font-medium" aria-hidden="true">
        !
      </span>
      <span>{children}</span>
    </p>
  );
}
