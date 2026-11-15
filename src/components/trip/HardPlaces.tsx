// 이번 조건으로 가기 어려운 곳과 대안(정보만, 11/14). 꼭 가고 싶은 곳·대표 관광지·좋아하는 분야 중 빠진 곳을
// 이유(✕ + 글자)와 함께 보여주고, 같은 분야의 가까운 갈 만한 곳을 하나 알려준다. 누르는 기능은 없다.
// 면은 쓰지 않는다: 접는 줄 위아래 구분선, 항목은 구분선 행, 대안은 굵은 글자 한 줄.
import { PlacePhoto } from "@/components/photos/PlacePhoto";
import { StatusChip } from "@/components/ui/StatusChip";
import { Disclosure } from "@/components/ui/disclosure";
import { haversineKm } from "@/lib/engine/travel";
import { VERDICT_CHIP } from "@/lib/trip/labels";
import type { TripView } from "@/lib/trip/view";

const KIND_TEXT = { 조건: "꼭 필요한 조건이 맞지 않아요", 휴무: "여행 날짜에 쉬어요", "AI 판단": "AI가 어렵다고 판단했어요" } as const;

export function HardPlaces({ trip }: { trip: TripView }) {
  const list = trip.hard ?? [];
  if (list.length === 0) return null;
  return (
    <div className="px-4 md:px-6 lg:px-0">
      <Disclosure
        className="mt-8 border-y border-line"
        summary={
          <>
            <span className="font-bold text-blocked-ink" aria-hidden="true">
              ✕
            </span>{" "}
            이번 조건으로 가기 어려운 곳 {list.length}곳
          </>
        }
      >
        <p className="text-base text-pretty text-ink-sub">꼭 가고 싶은 곳·대표 관광지·좋아하는 분야 중에 일정에 넣지 않은 곳이에요. 대신 갈 만한 가까운 곳도 함께 적었어요.</p>
        <ul className="mt-2 flex flex-col">
          {list.map((h) => {
            const p = trip.places[h.placeId];
            const alt = h.altId ? trip.places[h.altId] : undefined;
            const altJ = h.altId ? trip.judgments[h.altId] : undefined;
            const from = trip.placeData[h.placeId];
            const to = h.altId ? trip.placeData[h.altId] : undefined;
            const km = from && to ? haversineKm(from, to) : undefined;
            return (
              <li key={h.placeId} className="border-b border-line py-4 last:border-b-0">
                <div className="flex flex-wrap gap-3">
                  <PlacePhoto id={h.placeId} name={p.name} category={p.category} size="sm" />
                  <div className="min-w-0 grow basis-[10rem]">
                    <h3 className="text-heading font-bold [overflow-wrap:anywhere]">{p.name}</h3>
                    <p className="text-sm font-bold text-pine">
                      {p.region} · {p.category}
                    </p>
                    {h.mustVisit && <p className="text-sm text-ink-sub">꼭 가고 싶은 곳</p>}
                    <p className="mt-2">
                      <StatusChip status="blocked">{KIND_TEXT[h.kind]}</StatusChip>
                    </p>
                  </div>
                </div>
                <ul className="mt-3 list-disc pl-6 text-base leading-relaxed">
                  {h.reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
                {alt && altJ && (
                  <div className="mt-3 text-base leading-relaxed">
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
      </Disclosure>
    </div>
  );
}
