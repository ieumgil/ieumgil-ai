// 이번 조건으로 가기 어려운 곳과 대안(정보만, 11/14). 꼭 가고 싶은 곳·대표 관광지·좋아하는 분야 중 빠진 곳을
// 이유(✕ + 글자)와 함께 보여주고, 같은 분야의 가까운 갈 만한 곳을 하나 알려준다. 누르는 기능은 없다.
import { ChevronDown, CircleSlash } from "lucide-react";
import { PlacePhoto } from "@/components/photos/PlacePhoto";
import { StatusChip } from "@/components/ui/StatusChip";
import { haversineKm } from "@/lib/engine/travel";
import { VERDICT_CHIP } from "@/lib/trip/labels";
import type { TripView } from "@/lib/trip/view";

const KIND_TEXT = { 조건: "꼭 필요한 조건이 맞지 않아요", 휴무: "여행 날짜에 쉬어요", "AI 판단": "AI가 어렵다고 판단했어요" } as const;

export function HardPlaces({ trip }: { trip: TripView }) {
  const list = trip.hard ?? [];
  if (list.length === 0) return null;
  return (
    <div className="px-5 lg:px-0">
      <details className="group mt-8 rounded-2xl bg-surface px-4 py-1">
        <summary className="flex min-h-touch cursor-pointer list-none items-center justify-between gap-2 text-base font-bold">
          <span className="inline-flex items-center gap-2">
            <CircleSlash size={20} className="text-blocked-ink" aria-hidden="true" />
            이번 조건으로 가기 어려운 곳 {list.length}곳
          </span>
          <ChevronDown size={20} className="transition-transform duration-200 group-open:rotate-180" aria-hidden="true" />
        </summary>
        <p className="text-base text-ink-sub">꼭 가고 싶은 곳·대표 관광지·좋아하는 분야 중에 일정에 넣지 않은 곳이에요. 대신 갈 만한 가까운 곳도 함께 적었어요.</p>
        <ul className="flex flex-col gap-3 pt-3 pb-4">
          {list.map((h) => {
            const p = trip.places[h.placeId];
            const alt = h.altId ? trip.places[h.altId] : undefined;
            const altJ = h.altId ? trip.judgments[h.altId] : undefined;
            const from = trip.placeData[h.placeId];
            const to = h.altId ? trip.placeData[h.altId] : undefined;
            const km = from && to ? haversineKm(from, to) : undefined;
            return (
              <li key={h.placeId} className="rounded-2xl bg-white p-4 ring-1 ring-line">
                <div className="flex gap-3">
                  <PlacePhoto id={h.placeId} name={p.name} category={p.category} size="sm" />
                  <div className="min-w-0 flex-1">
                    <h3 className="text-lg leading-snug font-bold">{p.name}</h3>
                    <p className="text-sm text-ink-sub">
                      {p.region} · {p.category}
                      {h.mustVisit ? " · 꼭 가고 싶은 곳" : ""}
                    </p>
                    <p className="mt-1">
                      <StatusChip status="blocked">{KIND_TEXT[h.kind]}</StatusChip>
                    </p>
                  </div>
                </div>
                <ul className="mt-2 list-disc pl-5 text-base leading-relaxed">
                  {h.reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
                {alt && altJ && (
                  <div className="mt-3 rounded-xl bg-primary-soft px-3 py-2.5 text-base leading-relaxed text-primary-ink">
                    <p className="font-bold">
                      대신 갈 만한 곳: {alt.name}
                      {km !== undefined && <span className="font-normal"> · 약 {km < 1 ? "1km 안" : `${Math.round(km)}km`}</span>}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-2">
                      <StatusChip status={VERDICT_CHIP[altJ.verdict]}>{altJ.verdict}</StatusChip>
                      {altJ.reasons[0] && <span>{altJ.reasons[0]}</span>}
                    </p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </details>
    </div>
  );
}
