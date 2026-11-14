// 결과 화면 맨 위 요약: 몇 가지 일정을 만들었는지, 여행 조건(날짜·유형·이동·숙소) 알약, 안내(규칙 일정·후보 부족 등).
import { Accessibility, Baby, BedDouble, CalendarDays, Car, CircleAlert, Info, PersonStanding, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { TRAVELER_LABELS } from "@/lib/engine/conditions";
import { formatRange, nightsBetween, tripLabel } from "@/lib/plan/dates";
import { lodgingText } from "@/lib/plan/summary";
import type { TripView } from "@/lib/trip/view";

const TRAVELER_ICON = { wheelchair: <Accessibility size={16} />, elder: <PersonStanding size={16} />, stroller: <Baby size={16} /> } as const;

export function Summary({ trip }: { trip: TripView }) {
  const nights = trip.input.startDate && trip.input.endDate ? nightsBetween(trip.input.startDate, trip.input.endDate) : 0;
  const ai = !trip.usedFallback;
  return (
    <header className="animate-rise px-5 pt-6 lg:px-0">
      <p className="flex items-center gap-1.5 text-sm font-bold text-primary-ink">
        <Sparkles size={16} aria-hidden="true" />
        {ai ? "AI 추천 일정" : "기본 일정"}
      </p>
      <h1 className="mt-1 text-title font-bold">{!ai ? "기본 일정을 만들었어요" : trip.options.length > 1 ? `일정 ${trip.options.length}가지를 만들었어요` : "일정을 만들었어요"}</h1>
      <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="여행 조건">
        <Pill icon={<CalendarDays size={16} />}>
          {trip.input.startDate && trip.input.endDate ? formatRange(trip.input.startDate, trip.input.endDate) : ""} · {tripLabel(nights)}
        </Pill>
        {trip.input.travelers.map((t) => (
          <Pill key={t} icon={TRAVELER_ICON[t]}>
            {TRAVELER_LABELS[t]}
          </Pill>
        ))}
        <Pill icon={<Car size={16} />}>{trip.input.transport === "car" ? "자가용" : "택시"}</Pill>
        {trip.input.lodging && <Pill icon={<BedDouble size={16} />}>숙소 {lodgingText(trip.input.lodging, nights > 1 ? trip.input.lodging2 : "same")}</Pill>}
      </ul>
      {!ai && <Notice>AI 설계를 불러오지 못해 규칙으로 만든 일정이에요.</Notice>}
      {ai && trip.oneOption && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-primary-soft px-4 py-3 text-base text-primary-ink">
          <Info size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>{trip.oneOption}</span>
        </p>
      )}
      {trip.notes.map((n) => (
        <Notice key={n}>{n}</Notice>
      ))}
    </header>
  );
}

function Pill({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-sm font-medium text-ink">
      <span className="text-ink-sub" aria-hidden="true">
        {icon}
      </span>
      {children}
    </li>
  );
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <p className="mt-3 flex items-start gap-2 rounded-xl bg-caution-bg px-4 py-3 text-base text-caution-ink">
      <CircleAlert size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span>
        <span className="sr-only">주의: </span>
        {children}
      </span>
    </p>
  );
}
