"use client";

// 고른 안의 상세: 공통 질문 → 날짜 탭(지도는 탭 아래) → 하루 타임라인(출발 · 이동 · 장소 카드 · 점심·휴식 · 도착).
// [순서 고치기]를 누르면 그날 장소가 짧은 목록으로 바뀌고 위·아래로 옮기거나 뺄 수 있다(AI 호출 없음, 코드가 다시 계산·검사).
// 시각은 모두 코드가 계산한 값이다. 이동시간은 열 때 받은 카카오 실제 값이고, 못 받은 구간만 직선거리 추정이라 '추정'을 붙인다.
import { ArrowDown, ArrowUp, ArrowUpDown, Car, Check, ChevronDown, CircleAlert, Coffee, Flag, Hourglass, Undo2, Utensils, X } from "lucide-react";
import { type ReactNode, useState } from "react";
import { PlaceCard } from "@/components/trip/PlaceCard";
import { StatusChip } from "@/components/ui/StatusChip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toHHMM } from "@/lib/engine/types";
import { formatDay } from "@/lib/plan/dates";
import { isPhoneQuestion } from "@/lib/trip/questions";
import type { DayView, ItemView, OptionView, TripView } from "@/lib/trip/view";

/** 순서 바꾸기·빼기. 실패하면 이유 문장, 성공하면 null */
export interface DayEditor {
  move: (placeId: string, dir: -1 | 1) => string | null;
  remove: (placeId: string) => string | null;
  /** 처음 일정으로(바꾸기·순서·빼기 모두 되돌림) */
  reset: () => void;
  /** 처음 일정과 다른가 */
  edited: boolean;
}

const FIT_CHIP = { 여유: { s: "ok", t: "시간 여유 있어요" }, 빠듯: { s: "caution", t: "조금 빠듯해요" }, 부족: { s: "blocked", t: "시간이 부족해요" } } as const;

export function OptionDetail({
  o,
  trip,
  onSwap,
  onMap,
  day: dayIndex,
  onDay,
  map,
  editor,
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
  /** 순서 바꾸기·빼기(없으면 버튼을 숨긴다) */
  editor?: DayEditor;
}) {
  const counts = new Map<string, number>();
  o.checkBeforeGo.filter((q) => isPhoneQuestion(q.question)).forEach((q) => counts.set(q.question, (counts.get(q.question) ?? 0) + 1));
  const common = new Set([...counts].filter(([, n]) => n > 1).map(([q]) => q));
  const day = (d: DayView, i: number) => <DayPanel key={d.date} d={d} index={i} o={o} trip={trip} common={common} onSwap={onSwap} onMap={onMap} editor={editor} />;

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
  editor,
}: {
  d: DayView;
  index: number;
  o: OptionView;
  trip: TripView;
  common: Set<string>;
  onSwap: (placeId: string) => void;
  onMap?: (placeId: string) => void;
  editor?: DayEditor;
}) {
  const [editing, setEditing] = useState(false);
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
        {editor && !editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="ml-auto inline-flex min-h-touch items-center gap-1.5 rounded-xl bg-surface px-3 text-base font-medium text-ink transition-colors hover:bg-line"
          >
            <ArrowUpDown size={18} aria-hidden="true" />
            순서 고치기
          </button>
        )}
      </div>
      {d.realIssue && (
        <p className="mt-2 rounded-xl bg-caution-bg px-3 py-2 text-sm leading-normal text-caution-ink">
          <span className="sr-only">주의: </span>실제 차량 이동시간으로는 빠듯해요: {d.realIssue}
        </p>
      )}

      {editor && editing && <EditList visits={visits} trip={trip} index={index} editor={editor} onDone={() => setEditing(false)} />}

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

function EditList({
  visits,
  trip,
  index,
  editor,
  onDone,
}: {
  visits: Extract<ItemView, { kind: "visit" }>[];
  trip: TripView;
  index: number;
  editor: DayEditor;
  onDone: () => void;
}) {
  const [msg, setMsg] = useState<{ text: string; bad: boolean } | null>(null);
  const must = new Set(trip.input.mustVisit ?? []);
  const run = (fn: () => string | null, ok: string) => {
    const err = fn();
    setMsg(err ? { text: err, bad: true } : { text: `${ok} 시각을 다시 계산했어요.`, bad: false });
  };
  const iconBtn = "flex size-touch shrink-0 items-center justify-center rounded-xl bg-surface text-ink transition-colors hover:bg-line disabled:opacity-35 disabled:hover:bg-surface";
  return (
    <section aria-label={`${index + 1}일째 순서 고치기`} className="mt-4 animate-rise rounded-2xl bg-primary-soft p-3">
      <p className="px-1 text-base text-ink-sub">위·아래로 옮기거나 빼면 시각을 다시 계산해요. 다른 날로 옮기기는 안 돼요.</p>
      <ol className="mt-2 flex flex-col gap-2">
        {visits.map((v, i) => {
          const name = trip.places[v.placeId].name;
          return (
            <li key={v.placeId} className="flex items-center gap-2 rounded-xl bg-white p-2 ring-1 ring-line">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-base font-bold text-white" aria-hidden="true">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 text-base leading-snug font-bold">
                {name}
                {must.has(v.placeId) && <span className="block text-sm font-normal text-ink-sub">꼭 가고 싶은 곳</span>}
              </span>
              <button type="button" className={iconBtn} disabled={i === 0} aria-label={`${name} 위로 옮기기`} onClick={() => run(() => editor.move(v.placeId, -1), `${name}: 위로 옮겼어요.`)}>
                <ArrowUp size={20} aria-hidden="true" />
              </button>
              <button type="button" className={iconBtn} disabled={i === visits.length - 1} aria-label={`${name} 아래로 옮기기`} onClick={() => run(() => editor.move(v.placeId, 1), `${name}: 아래로 옮겼어요.`)}>
                <ArrowDown size={20} aria-hidden="true" />
              </button>
              <button
                type="button"
                className={`${iconBtn} text-blocked-ink`}
                disabled={visits.length <= 1}
                aria-label={`${name} 일정에서 빼기`}
                onClick={() => run(() => editor.remove(v.placeId), must.has(v.placeId) ? `${name}: 꼭 가고 싶은 곳인데 뺐어요. [처음 일정으로]로 되돌릴 수 있어요.` : `${name}: 뺐어요.`)}
              >
                <X size={20} aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ol>
      <p aria-live="polite" className={msg ? `mt-2 rounded-xl px-3 py-2 text-base ${msg.bad ? "bg-caution-bg text-caution-ink" : "bg-white text-primary-ink"}` : "sr-only"}>
        {msg && (msg.bad ? `바꾸지 않았어요. ${msg.text}` : msg.text)}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={onDone} className="inline-flex min-h-touch grow items-center justify-center gap-1.5 rounded-xl bg-primary px-4 text-base font-bold text-white transition-colors hover:bg-primary-ink">
          <Check size={18} aria-hidden="true" />
          다 고쳤어요
        </button>
        {editor.edited && (
          <button
            type="button"
            onClick={() => {
              editor.reset();
              setMsg({ text: "처음 일정으로 되돌렸어요.", bad: false });
            }}
            className="inline-flex min-h-touch grow items-center justify-center gap-1.5 rounded-xl bg-white px-4 text-base font-medium text-ink ring-1 ring-line transition-colors hover:bg-surface"
          >
            <Undo2 size={18} aria-hidden="true" />
            처음 일정으로
          </button>
        )}
      </div>
    </section>
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
