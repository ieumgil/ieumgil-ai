"use client";

// 고른 안의 상세: 공통 질문 → 날짜 탭(지도는 탭 아래) → 하루 타임라인(출발 · 이동 · 장소 카드 · 점심·휴식 · 도착).
// 시각은 모두 코드가 계산한 값이다. 이동시간은 열 때 받은 카카오 실제 값이고, 못 받은 구간만 직선거리 추정이라 '추정'을 붙인다.
import { Car, ChevronDown, CircleAlert, Coffee, Flag, Hourglass, Utensils } from "lucide-react";
import type { ReactNode } from "react";
import { PlaceCard } from "@/components/trip/PlaceCard";
import { StatusChip } from "@/components/ui/StatusChip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toHHMM } from "@/lib/engine/types";
import { formatDay } from "@/lib/plan/dates";
import { isPhoneQuestion } from "@/lib/trip/questions";
import type { DayView, ItemView, OptionView, TripView } from "@/lib/trip/view";

const FIT_CHIP = { 여유: { s: "ok", t: "시간 여유 있어요" }, 빠듯: { s: "caution", t: "조금 빠듯해요" }, 부족: { s: "blocked", t: "시간이 부족해요" } } as const;

export function OptionDetail({
  o,
  trip,
  onSwap,
  onMap,
  day: dayIndex,
  onDay,
  map,
}: {
  o: OptionView;
  trip: TripView;
  onSwap: (placeId: string) => void;
  /** 장소 번호를 누르면 지도에서 그 장소를 보여준다 */
  onMap?: (placeId: string) => void;
  day: number;
  onDay: (i: number) => void;
  /** 이 칸 안에 넣을 지도(넓은 PC에서는 따로 칸이 있어 null) */
  map: ReactNode;
}) {
  const counts = new Map<string, number>();
  o.checkBeforeGo.filter((q) => isPhoneQuestion(q.question)).forEach((q) => counts.set(q.question, (counts.get(q.question) ?? 0) + 1));
  const common = new Set([...counts].filter(([, n]) => n > 1).map(([q]) => q));
  const day = (d: DayView, i: number) => <DayPanel key={d.date} d={d} index={i} o={o} trip={trip} common={common} onSwap={onSwap} onMap={onMap} />;

  return (
    <div className="px-5 pt-6 lg:px-0">
      <h2 className="text-xl leading-snug font-bold">{o.title}</h2>
      <p className="mt-1 text-base text-ink-sub">{o.summary}</p>
      {common.size > 0 && (
        <details className="group mt-4 rounded-2xl bg-caution-bg px-4 py-1 text-caution-ink">
          <summary className="flex min-h-touch cursor-pointer list-none items-center justify-between gap-2 text-base font-bold">
            <span className="inline-flex items-center gap-2">
              <CircleAlert size={20} aria-hidden="true" />
              여러 곳에 공통으로 물어볼 것 {common.size}가지
            </span>
            <ChevronDown size={20} className="transition-transform duration-200 group-open:rotate-180" aria-hidden="true" />
          </summary>
          <ul className="list-disc pb-3 pl-9 text-base leading-relaxed">
            {[...common].map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </details>
      )}
      {o.days.length > 1 ? (
        <Tabs value={o.days[dayIndex].date} onValueChange={(v) => onDay(Math.max(0, o.days.findIndex((d) => d.date === v)))} className="mt-5">
          <TabsList className="w-full">
            {o.days.map((d, i) => (
              <TabsTrigger key={d.date} value={d.date} className="flex-col gap-0 font-bold data-active:text-primary-ink">
                {i + 1}일째
                <span className="text-sm font-normal">{formatDay(d.date)}</span>
              </TabsTrigger>
            ))}
          </TabsList>
          {map && <div className="mt-4">{map}</div>}
          {o.days.map((d, i) => (
            <TabsContent key={d.date} value={d.date} className="animate-rise">
              {day(d, i)}
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        <>
          {map && <div className="mt-5">{map}</div>}
          {o.days.map(day)}
        </>
      )}
    </div>
  );
}

function DayPanel({
  d,
  index,
  o,
  trip,
  common,
  onSwap,
  onMap,
}: {
  d: DayView;
  index: number;
  o: OptionView;
  trip: TripView;
  common: Set<string>;
  onSwap: (placeId: string) => void;
  onMap?: (placeId: string) => void;
}) {
  const visits = d.items.filter((x): x is Extract<ItemView, { kind: "visit" }> => x.kind === "visit");
  const numberOf = new Map(visits.map((v, i) => [v.placeId, i + 1]));
  const last = d.items.at(-1);
  const arrival = last && last.kind === "travel" ? last.startMin + last.minutes : d.endMin;
  return (
    <div className="mt-4" aria-label={`${index + 1}일째`}>
      <div className="flex flex-wrap items-center gap-2">
        <StatusChip status={FIT_CHIP[d.fit].s}>{FIT_CHIP[d.fit].t}</StatusChip>
        <span className="text-sm text-ink-sub">
          {visits.length}곳 · 이동 약 {d.travelMin}분{d.estimated ? "(추정)" : ""}
        </span>
      </div>
      {d.realIssue && (
        <p className="mt-2 rounded-xl bg-caution-bg px-3 py-2 text-sm leading-normal text-caution-ink">
          <span className="sr-only">주의: </span>실제 차량 이동시간으로는 빠듯해요: {d.realIssue}
        </p>
      )}

      <ol className="relative mt-4 flex flex-col">
        <span className="absolute top-4 bottom-4 left-[0.9375rem] w-0.5 rounded-full bg-line" aria-hidden="true" />
        <Node icon={<Flag size={16} />} muted>
          <span className="font-bold">{toHHMM(d.startMin)}</span> {d.startName} 출발
        </Node>
        {d.items.map((it, i) => {
          if (it.kind === "travel") {
            return (
              <li key={i} className="relative flex items-center gap-2 py-1.5 pl-11 text-sm text-ink-sub">
                <Car size={16} aria-hidden="true" />
                차량 약 {it.minutes}분 · {it.km}km{it.estimated ? " · 추정" : ""}
              </li>
            );
          }
          if (it.kind === "lunch") {
            return (
              <Node key={i} icon={<Utensils size={16} />} muted>
                <span className="font-bold">
                  {toHHMM(it.startMin)}~{toHHMM(it.endMin)}
                </span>{" "}
                점심·휴식 <span className="text-sm text-ink-sub">· 음식점은 추천하지 않아요</span>
              </Node>
            );
          }
          if (it.kind === "rest" || it.kind === "wait") {
            return (
              <Node key={i} icon={it.kind === "rest" ? <Coffee size={16} /> : <Hourglass size={16} />} muted small>
                {toHHMM(it.startMin)}~{toHHMM(it.endMin)} {it.kind === "rest" ? "쉬는 시간" : "문 열 때까지 기다리기"}
              </Node>
            );
          }
          return <PlaceCard key={it.placeId} it={it} no={numberOf.get(it.placeId)!} o={o} trip={trip} common={common} delay={i} onSwap={onSwap} onMap={onMap} />;
        })}
        <Node icon={<Flag size={16} />} muted>
          <span className="font-bold">약 {toHHMM(arrival)}</span> {d.endName} 도착 <span className="text-sm text-ink-sub">· 마치는 시각 {toHHMM(d.endMin)}</span>
        </Node>
      </ol>
    </div>
  );
}

function Node({ icon, children, muted, small }: { icon: ReactNode; children: ReactNode; muted?: boolean; small?: boolean }) {
  return (
    <li className={`relative flex items-center gap-3 py-1.5 ${small ? "text-sm text-ink-sub" : "text-base"}`}>
      <span className={`z-10 flex size-8 shrink-0 items-center justify-center rounded-full ${muted ? "bg-surface text-ink-sub ring-4 ring-white" : "bg-primary text-white"}`} aria-hidden="true">
        {icon}
      </span>
      <span>{children}</span>
    </li>
  );
}
