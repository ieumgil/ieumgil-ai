// 안 고르기: 성격이 다른 2~3안을 카드로(갈 곳 한 줄 요약 · 장소 수 · 이동 시간 · 전화로 확인할 곳 수).
import { Car, CircleCheck, MapPin, Phone, Route } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { routeSummary } from "@/lib/trip/labels";
import { callPlaces } from "@/lib/trip/questions";
import type { TripView } from "@/lib/trip/view";

const STRATEGY_LABEL: Record<string, string> = { 여유: "여유롭게", 취향: "좋아하는 곳 중심", 실내: "실내 위주", "확인 적게": "확인할 것 적게", 규칙: "기본 일정" };

export function OptionPicker({ trip, selected, confirmedId, onSelect }: { trip: TripView; selected: string; confirmedId: string | null; onSelect: (id: string) => void }) {
  return (
    <section className="pt-6" aria-labelledby="compare">
      <h2 id="compare" className="px-5 text-lg font-bold lg:px-0">
        마음에 드는 일정을 골라 보세요
      </h2>
      <ToggleGroup
        type="single"
        value={selected}
        onValueChange={(v) => v && onSelect(v)}
        aria-label="일정 고르기"
        rovingFocus={false}
        spacing={3}
        className="mt-3 flex w-full flex-col items-stretch gap-3 px-5 lg:px-0"
      >
        {trip.options.map((o, i) => {
          const calls = callPlaces(o).length;
          return (
            <ToggleGroupItem
              key={o.id}
              value={o.id}
              style={{ animationDelay: `${60 + i * 70}ms` }}
              className="h-auto w-full animate-rise flex-col items-stretch gap-2 rounded-2xl border-2 border-surface bg-surface p-4 text-left whitespace-normal transition-[border-color,background-color,box-shadow,translate,transform] duration-200 motion-safe:hover:-translate-y-0.5 hover:border-primary/40 hover:bg-white hover:shadow-[0_0.5rem_1.25rem_rgb(20_80_163/0.12)] active:scale-[0.99] data-[state=on]:border-primary data-[state=on]:bg-primary-soft data-[state=on]:hover:translate-y-0 data-[state=on]:hover:shadow-none"
            >
              <span className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 text-sm font-bold text-primary-ink">
                  <span className="flex size-7 items-center justify-center rounded-full bg-primary text-sm text-white">{o.id}</span>
                  {STRATEGY_LABEL[o.strategy] ?? o.strategy}
                </span>
                {confirmedId === o.id && (
                  <span className="inline-flex items-center gap-1 text-sm font-bold text-primary-ink">
                    <CircleCheck size={16} aria-hidden="true" />
                    정했어요
                  </span>
                )}
              </span>
              <span className="text-lead leading-snug font-bold text-ink">{o.title}</span>
              <span className="flex items-start gap-1.5 text-base leading-snug font-medium text-ink">
                <Route size={18} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
                <span>{routeSummary(o, trip)}</span>
              </span>
              <span className="mt-1 grid grid-cols-3 gap-2 text-sm font-medium text-ink">
                <span className="inline-flex items-center gap-1">
                  <MapPin size={16} className="text-ink-sub" aria-hidden="true" />
                  {o.stats.places}곳
                </span>
                <span className="inline-flex items-center gap-1">
                  <Car size={16} className="text-ink-sub" aria-hidden="true" />
                  이동 약 {o.stats.travelMin}분
                </span>
                <span className={`inline-flex items-center gap-1 ${calls > 0 ? "text-caution-ink" : "text-ink"}`}>
                  <Phone size={16} aria-hidden="true" />
                  전화 확인 {calls}곳
                </span>
              </span>
            </ToggleGroupItem>
          );
        })}
      </ToggleGroup>
    </section>
  );
}
