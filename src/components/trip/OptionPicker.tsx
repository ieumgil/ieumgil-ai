// 안 고르기: 성격이 다른 2~3안을 아이콘 없는 네 줄 카드로(A안+전략 / 제목 / 갈 곳 한 줄 요약 / 장소 수 · 이동 시간 · 전화 확인 곳 수).
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { routeSummary } from "@/lib/trip/labels";
import { callPlaces } from "@/lib/trip/questions";
import type { TripView } from "@/lib/trip/view";

const STRATEGY_LABEL: Record<string, string> = { 여유: "여유롭게", 취향: "좋아하는 곳 중심", 실내: "실내 위주", "확인 적게": "확인할 것 적게", 규칙: "기본 일정" };

export function OptionPicker({ trip, selected, confirmedId, onSelect }: { trip: TripView; selected: string; confirmedId: string | null; onSelect: (id: string) => void }) {
  return (
    <section className="pt-8" aria-labelledby="compare">
      <h2 id="compare" className="px-4 font-heading text-heading font-bold text-balance md:px-6 lg:px-0">
        마음에 드는 일정을 골라 보세요
      </h2>
      <ToggleGroup
        type="single"
        value={selected}
        onValueChange={(v) => v && onSelect(v)}
        aria-label="일정 고르기"
        rovingFocus={false}
        spacing={4}
        className="mt-3 flex w-full flex-col items-stretch gap-4 px-4 md:px-6 lg:px-0"
      >
        {trip.options.map((o) => {
          const calls = callPlaces(o).length;
          return (
            <ToggleGroupItem
              key={o.id}
              value={o.id}
              className="h-auto w-full flex-col items-stretch gap-2 rounded-2xl border-[1.5px] border-line-control bg-white p-4 text-left whitespace-normal press press-soft hover:border-primary hover:bg-white data-[state=on]:border-2 data-[state=on]:border-primary data-[state=on]:bg-primary-soft data-[state=on]:hover:bg-primary-soft"
            >
              <span className="flex items-baseline justify-between gap-2">
                <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                  <span className="text-base font-medium text-ink">{o.id}안</span>{" "}
                  <span className="text-sm font-medium text-ink-sub">{STRATEGY_LABEL[o.strategy] ?? o.strategy}</span>
                </span>
                {confirmedId === o.id && (
                  <span className="shrink-0 text-sm font-medium text-primary-ink">
                    <span aria-hidden="true">✓</span> 정했어요
                  </span>
                )}
              </span>
              <span className="text-heading leading-snug font-medium text-ink [overflow-wrap:anywhere]">{o.title}</span>
              <span className="line-clamp-2 text-base leading-snug font-normal text-ink">{routeSummary(o, trip)}</span>
              <span className="text-sm font-medium text-ink">
                {o.stats.places}곳 · 이동 약 {o.stats.travelMin}분 ·{" "}
                {calls > 0 ? (
                  <span className="text-caution-ink">
                    <span aria-hidden="true">!</span> 전화 확인 {calls}곳
                  </span>
                ) : (
                  "전화 확인 0곳"
                )}
              </span>
            </ToggleGroupItem>
          );
        })}
      </ToggleGroup>
    </section>
  );
}
