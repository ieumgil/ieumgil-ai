"use client";

// 장소 바꾸기 창: AI가 이미 판단한 근처 후보(최대 3곳). 고르면 코드가 시각을 다시 계산·검사하고, 걸리면 이유를 보여주고 바꾸지 않는다(AI·서버 호출 없음).
import { ArrowLeftRight, CircleAlert, Undo2 } from "lucide-react";
import { useState } from "react";
import { PlacePhoto } from "@/components/photos/PlacePhoto";
import { StatusChip } from "@/components/ui/StatusChip";
import { Button } from "@/components/ui/button";
import { SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { haversineKm } from "@/lib/engine/travel";
import { alternativesFor } from "@/lib/trip/edit";
import { VERDICT_CHIP, verdictText } from "@/lib/trip/labels";
import type { OptionView, TripView } from "@/lib/trip/view";

/** 장소 바꾸기: AI가 이미 판단한 근처 후보. 고르면 코드가 시각을 다시 계산하고, 검사에 걸리면 이유를 보여주고 바꾸지 않는다 */
export function SwapSheet({ placeId, o, trip, onSwap, onClose }: { placeId: string; o: OptionView; trip: TripView; onSwap: (from: string, to: string) => string | null; onClose: () => void }) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const from = trip.placeData[placeId];
  const originalId = o.swapped?.[placeId];
  const list = alternativesFor(o, placeId);
  return (
    <>
      <SheetHeader className="px-0 pt-6">
        <SheetTitle className="flex items-center gap-2 pr-12 text-xl font-bold">
          <ArrowLeftRight className="shrink-0 text-primary" aria-hidden="true" />
          {trip.places[placeId].name} 대신 갈 곳
        </SheetTitle>
        <SheetDescription>AI가 이번 조건으로 이미 살펴본 근처 장소예요. 고르면 시각을 다시 계산해요.</SheetDescription>
      </SheetHeader>
      {list.length === 0 ? (
        <p className="rounded-2xl bg-surface p-4 text-base text-ink-sub">근처에 바꿀 만한 곳이 없어요.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {list.map((id) => {
            const p = trip.places[id];
            const j = trip.judgments[id];
            const back = id === originalId;
            const km = from && trip.placeData[id] ? haversineKm(from, trip.placeData[id]) : null;
            return (
              <li key={id} className="rounded-2xl bg-surface p-4">
                <div className="flex gap-3">
                  <PlacePhoto id={id} name={p.name} category={p.category} size="sm" className="bg-white" />
                  <div className="min-w-0 flex-1">
                    <p className="text-lg leading-snug font-bold">{p.name}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <StatusChip status={VERDICT_CHIP[j.verdict]}>{verdictText(j.verdict, (trip.unknowns?.[id]?.length ?? 0) + (trip.asks[id]?.length ?? 0) > 0)}</StatusChip>
                      <span className="text-sm text-ink-sub">
                        {p.region} · {p.category}
                        {km !== null && ` · 약 ${km < 1 ? "1km 안" : `${Math.round(km)}km`}`}
                      </span>
                    </div>
                  </div>
                </div>
                {j.reasons[0] && <p className="mt-2 text-base leading-relaxed">{j.reasons[0]}</p>}
                {errors[id] && (
                  <p role="alert" className="mt-2 flex items-start gap-2 rounded-lg bg-blocked-bg px-3 py-2 text-base text-blocked-ink">
                    <CircleAlert size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
                    바꿀 수 없어요: {errors[id]}
                  </p>
                )}
                <Button
                  variant={back ? "outline" : "primary"}
                  size="sm"
                  className="mt-3 w-full"
                  onClick={() => {
                    const err = onSwap(placeId, id);
                    if (err) setErrors((e) => ({ ...e, [id]: err }));
                  }}
                >
                  {back ? <Undo2 aria-hidden="true" /> : <ArrowLeftRight aria-hidden="true" />}
                  {back ? "원래 장소로 되돌리기" : "이곳으로 바꾸기"}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      <Button variant="secondary" className="mt-4 w-full" onClick={onClose}>
        닫기
      </Button>
    </>
  );
}
