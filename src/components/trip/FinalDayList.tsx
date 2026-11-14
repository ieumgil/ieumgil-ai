// 확정 일정의 하루 목록: 출발 → 이동 → 장소(사진 · 시각 · 이름 · 판단 칩 · 전화) → 점심·휴식 → 도착. 인쇄할 때는 모든 날을 펼친다.
import { Car, Flag, Phone, Utensils } from "lucide-react";
import { PlacePhoto } from "@/components/photos/PlacePhoto";
import { StatusChip } from "@/components/ui/StatusChip";
import { toHHMM } from "@/lib/engine/types";
import { VERDICT_CHIP, verdictText } from "@/lib/trip/labels";
import { stopAnchor, visitsOf } from "@/lib/trip/map-points";
import type { DayView, TripView } from "@/lib/trip/view";

export function DayList({ d, trip, calls }: { d: DayView; trip: TripView; calls: Set<string> }) {
  const numberOf = new Map(visitsOf(d).map((v, i) => [v.placeId, i + 1]));
  const last = d.items.at(-1);
  const arrival = last && last.kind === "travel" ? last.startMin + last.minutes : d.endMin;
  return (
    <ol className="flex flex-col gap-1">
      <Row icon={<Flag size={16} />}>
        <span className="font-bold">{toHHMM(d.startMin)}</span> {d.startName} 출발
      </Row>
      {d.items.map((it, i) => {
        if (it.kind === "travel") {
          return (
            <li key={i} className="flex items-center gap-2 py-1 pl-11 text-sm text-ink-sub">
              <Car size={16} aria-hidden="true" />
              차량 약 {it.minutes}분 · {it.km}km
            </li>
          );
        }
        if (it.kind === "lunch") {
          return (
            <Row key={i} icon={<Utensils size={16} />}>
              <span className="font-bold">
                {toHHMM(it.startMin)}~{toHHMM(it.endMin)}
              </span>{" "}
              점심·휴식
            </Row>
          );
        }
        if (it.kind !== "visit") {
          return (
            <li key={i} className="py-1 pl-11 text-sm text-ink-sub">
              {toHHMM(it.startMin)}~{toHHMM(it.endMin)} {it.kind === "rest" ? "쉬는 시간" : "문 열 때까지 기다리기"}
            </li>
          );
        }
        const p = trip.places[it.placeId];
        const j = trip.judgments[it.placeId];
        return (
          <li key={i} id={stopAnchor(it.placeId)} className="flex gap-3 rounded-2xl bg-white p-3 ring-1 ring-line">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-base font-bold text-white" aria-hidden="true">
              {numberOf.get(it.placeId)}
            </span>
            <PlacePhoto id={it.placeId} name={p.name} category={p.category} size="sm" className="print:hidden" />
            <div className="min-w-0 flex-1">
              <p className="text-base font-bold text-primary-ink tabular-nums">
                약 {toHHMM(it.arriveMin)}~{toHHMM(it.departMin)}
              </p>
              <h2 className="text-lg leading-snug font-bold">
                <span className="sr-only">{numberOf.get(it.placeId)}번째 장소: </span>
                {p.name}
              </h2>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <StatusChip status={VERDICT_CHIP[j.verdict]}>{verdictText(j.verdict, calls.has(it.placeId))}</StatusChip>
                <a href={`tel:${p.phone.replace(/[^\d]/g, "")}`} aria-label={`공식 전화 ${p.phone} 걸기`} className="inline-flex min-h-touch items-center gap-1.5 text-base font-bold text-primary tabular-nums">
                  <Phone size={16} aria-hidden="true" />
                  {p.phone}
                </a>
              </div>
            </div>
          </li>
        );
      })}
      <Row icon={<Flag size={16} />}>
        <span className="font-bold">약 {toHHMM(arrival)}</span> {d.endName} 도착
      </Row>
    </ol>
  );
}

function Row({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 py-1.5 text-base">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface text-ink-sub" aria-hidden="true">
        {icon}
      </span>
      <span>{children}</span>
    </li>
  );
}
