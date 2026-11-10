"use client";

// 결과 화면: AI가 만든 일정 2~3안 비교 → 고른 안의 날짜별 시간순 카드. 지도는 나중에.
// 시각은 모두 코드가 계산한 값이고, 이동시간은 지금 직선거리 추정치라 '약'과 '(추정)'을 붙인다.
import { useParams } from "next/navigation";
import { useState } from "react";
import { ComingSoon } from "@/components/ComingSoon";
import { TopBar } from "@/components/TopBar";
import { ButtonLink } from "@/components/ui/Button";
import { StatusChip, type ChipStatus } from "@/components/ui/StatusChip";
import type { Verdict } from "@/lib/ai/guards";
import { toHHMM } from "@/lib/engine/types";
import { formatDay, formatRange, nightsBetween, tripLabel } from "@/lib/plan/dates";
import { TRAVELER_LABELS } from "@/lib/engine/conditions";
import { useSavedTrip } from "@/lib/trip/store";
import type { DayView, OptionView, TripView } from "@/lib/trip/view";

const VERDICT_CHIP: Record<Verdict, ChipStatus> = { 적합: "ok", 주의: "caution", "확인 필요": "caution", 부적합: "blocked" };
const FIT_CHIP = { 여유: { s: "ok", t: "시간 여유 있어요" }, 빠듯: { s: "caution", t: "조금 빠듯해요" }, 부족: { s: "blocked", t: "시간이 부족해요" } } as const;

export function TripScreen() {
  const { id } = useParams<{ id: string }>();
  const trip = useSavedTrip();
  if (id !== "new") return <ComingSoon title="예시 루트" />;
  if (trip === undefined) return null;
  if (trip === null) {
    return (
      <main className="mx-auto flex w-full max-w-[30rem] flex-1 flex-col gap-4 px-5 pt-4 pb-7">
        <TopBar backHref="/" backLabel="처음 화면으로" />
        <h1 className="mt-8 text-[1.75rem] font-bold">만든 일정이 없어요</h1>
        <p className="text-base text-ink-sub">일정은 이 탭에서만 보관해요. 조건을 고르고 다시 만들어 주세요.</p>
        <ButtonLink href="/plan/when">일정 만들기</ButtonLink>
      </main>
    );
  }
  return <TripResult trip={trip} />;
}

function TripResult({ trip }: { trip: TripView }) {
  const [selected, setSelected] = useState(trip.options[0]?.id);
  const option = trip.options.find((o) => o.id === selected) ?? trip.options[0];
  const nights = trip.input.startDate && trip.input.endDate ? nightsBetween(trip.input.startDate, trip.input.endDate) : 0;
  const who = trip.input.travelers.map((t) => TRAVELER_LABELS[t]).join("·");
  const ai = !trip.usedFallback;

  return (
    <main className="mx-auto flex w-full max-w-[34rem] flex-1 flex-col pb-10">
      <div className="px-5 pt-4">
        <TopBar backHref="/plan/taste" backLabel="조건 화면으로" />
      </div>
      <header className="px-5 pt-6">
        <p className="text-sm text-ink-sub">
          {trip.input.startDate && trip.input.endDate ? formatRange(trip.input.startDate, trip.input.endDate) : ""} · {tripLabel(nights)} · {who} · {trip.input.transport === "car" ? "자가용" : "택시"}
        </p>
        <h1 className="mt-1 text-[1.75rem] leading-[1.35] font-bold">{ai ? `AI가 일정 ${trip.options.length}가지를 만들었어요` : "기본 일정을 만들었어요"}</h1>
        {!ai && <p className="mt-2 rounded-xl bg-caution-bg px-4 py-3 text-base text-caution-ink">! AI 설계를 불러오지 못해 규칙으로 만든 일정이에요.</p>}
        {trip.notes.map((n) => (
          <p key={n} className="mt-2 rounded-xl bg-caution-bg px-4 py-3 text-base text-caution-ink">
            <span aria-hidden="true">! </span>
            {n}
          </p>
        ))}
      </header>

      {trip.options.length > 1 && (
        <section className="px-5 pt-6" aria-labelledby="compare">
          <h2 id="compare" className="text-lg font-bold">
            일정 비교
          </h2>
          <div className="mt-3 flex snap-x gap-3 overflow-x-auto pb-2" role="radiogroup" aria-label="일정 고르기">
            {trip.options.map((o) => (
              <OptionCard key={o.id} o={o} selected={o.id === option.id} onSelect={() => setSelected(o.id)} />
            ))}
          </div>
        </section>
      )}

      {option && <OptionDetail key={option.id} o={option} trip={trip} />}

      <section className="flex flex-col gap-2 px-5 pt-8 text-sm leading-normal text-ink-sub">
        <p>이동 시간은 직선거리로 어림한 추정치예요. 경로는 일반 차량 기준이며 휠체어 안전 경로를 뜻하지 않아요.</p>
        <p>접근성 정보는 한국관광공사 무장애 여행정보를 AI가 읽고 정리한 것이라 현장과 다를 수 있어요. 출발 전에 공식 전화로 확인해 주세요.</p>
      </section>

      <details className="mx-5 mt-6 rounded-2xl bg-surface p-4">
        <summary className="min-h-touch cursor-pointer text-base font-bold">AI 설계 과정 보기</summary>
        <ul className="mt-2 flex flex-col gap-1.5 text-sm leading-normal text-ink-sub">
          <li>AI 호출 {trip.calls}회 · {Math.round(trip.ms / 1000)}초</li>
          <li>장소 판단: 후보마다 3번 판단해 맞춰 보고, 근거가 원문에 없으면 버렸어요.</li>
          {trip.options.map((o) => (
            <li key={o.id}>
              {o.title}: {o.source === "ai" ? `검사 통과${o.fixes ? ` (다시 고친 횟수 ${o.fixes})` : ""}` : "규칙 일정"}
              {o.fixedViolations.length > 0 && <span> · 고친 내용: {o.fixedViolations.join(" / ")}</span>}
              {o.review && <span> · 점검: {o.review.comment}</span>}
            </li>
          ))}
        </ul>
      </details>

      <div className="flex flex-col gap-2.5 px-5 pt-6">
        <ButtonLink href="/plan/when" variant="outline">
          조건 바꿔 다시 만들기
        </ButtonLink>
      </div>
    </main>
  );
}

function OptionCard({ o, selected, onSelect }: { o: OptionView; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`flex w-[16rem] shrink-0 snap-start flex-col gap-2 rounded-2xl border-2 p-4 text-left focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary ${selected ? "border-primary bg-primary-soft" : "border-surface bg-surface"}`}
    >
      <span className="text-sm font-bold text-primary-ink">{o.id}안 · {o.strategy}</span>
      <span className="text-[1.0625rem] leading-snug font-bold">{o.title}</span>
      <span className="text-sm leading-normal text-ink-sub">{o.summary}</span>
      <span className="mt-1 flex flex-wrap gap-1.5 text-sm">
        <span className="rounded-full bg-white px-2.5 py-1">장소 {o.stats.places}곳</span>
        <span className="rounded-full bg-white px-2.5 py-1">이동 약 {o.stats.travelMin}분</span>
        {o.stats.checkNeeded > 0 && <StatusChip status="caution">확인 필요 {o.stats.checkNeeded}곳</StatusChip>}
      </span>
      {o.review && (
        <span className="text-sm text-ink-sub">
          피로도 {o.review.fatigue}/5 · 시간 여유 {o.review.slack}/5 · 취향 {o.review.taste}/5
        </span>
      )}
    </button>
  );
}

function OptionDetail({ o, trip }: { o: OptionView; trip: TripView }) {
  const [dayIndex, setDayIndex] = useState(0);
  const day = o.days[dayIndex];
  // 여러 곳에 똑같이 붙은 질문은 한 번만(예: 걷는 거리)
  const counts = new Map<string, number>();
  o.checkBeforeGo.forEach((q) => counts.set(q.question, (counts.get(q.question) ?? 0) + 1));
  const common = [...counts].filter(([, n]) => n > 1).map(([q]) => q);

  return (
    <section className="px-5 pt-6" aria-label={`${o.title} 자세히`}>
      <h2 className="text-lg font-bold">{o.title}</h2>
      {o.days.length > 1 && (
        <div className="mt-3 flex gap-2" role="tablist" aria-label="날짜">
          {o.days.map((d, i) => (
            <button
              key={d.date}
              type="button"
              role="tab"
              aria-selected={i === dayIndex}
              onClick={() => setDayIndex(i)}
              className={`min-h-touch flex-1 rounded-xl px-3 text-base font-bold ${i === dayIndex ? "bg-primary text-white" : "bg-surface text-ink"}`}
            >
              {i + 1}일째
              <span className="block text-sm font-normal">{formatDay(d.date)}</span>
            </button>
          ))}
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <StatusChip status={FIT_CHIP[day.fit].s}>{FIT_CHIP[day.fit].t}</StatusChip>
        <span className="text-sm text-ink-sub">이동 약 {day.travelMin}분{day.estimated ? "(추정)" : ""}</span>
      </div>
      {common.length > 0 && (
        <div className="mt-3 rounded-xl bg-caution-bg px-4 py-3 text-base text-caution-ink">
          <p className="font-bold">! 여러 곳 공통으로 출발 전에 확인할 것</p>
          <ul className="mt-1 list-disc pl-5">
            {common.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </div>
      )}
      <Timeline day={day} o={o} trip={trip} common={new Set(common)} />
    </section>
  );
}

function arrivalAtEnd(day: DayView): number {
  const last = day.items.at(-1);
  return last && last.kind === "travel" ? last.startMin + last.minutes : day.endMin;
}

function Timeline({ day, o, trip, common }: { day: DayView; o: OptionView; trip: TripView; common: Set<string> }) {
  return (
    <ol className="mt-4 flex flex-col gap-2">
      <li className="text-base font-bold">
        {toHHMM(day.startMin)} {day.startName} 출발
      </li>
      {day.items.map((it, i) => {
        if (it.kind === "travel") {
          return (
            <li key={i} className="flex items-center gap-2 py-1 pl-3 text-sm text-ink-sub">
              <span aria-hidden="true">↓</span> 차량 약 {it.minutes}분 · {it.km}km{it.estimated ? " (추정)" : ""}
              {i === day.items.length - 1 && ` → ${it.toName}`}
            </li>
          );
        }
        if (it.kind === "lunch") {
          return (
            <li key={i} className="rounded-xl border border-dashed border-line-strong px-4 py-3 text-base">
              {toHHMM(it.startMin)}~{toHHMM(it.endMin)} 점심·휴식 <span className="text-sm text-ink-sub">(음식점은 추천하지 않아요)</span>
            </li>
          );
        }
        if (it.kind === "rest" || it.kind === "wait") {
          return (
            <li key={i} className="px-4 text-sm text-ink-sub">
              {toHHMM(it.startMin)}~{toHHMM(it.endMin)} {it.kind === "rest" ? "쉬는 시간" : "문 열 때까지 기다리기"}
            </li>
          );
        }
        const p = trip.places[it.placeId];
        const j = trip.judgments[it.placeId];
        const questions = o.checkBeforeGo.filter((q) => q.placeId === it.placeId && !common.has(q.question)).map((q) => q.question);
        const caution = o.cautions.filter((c) => c.placeId === it.placeId).map((c) => c.text);
        return (
          <li key={i} className="flex flex-col gap-2 rounded-2xl bg-surface p-4">
            <p className="text-sm text-ink-sub">
              약 {toHHMM(it.arriveMin)}~{toHHMM(it.departMin)} · 머무는 시간 {it.stayMin}분{it.extraMin ? ` + 여유 ${it.extraMin}분` : ""}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-bold">{p.name}</h3>
              <StatusChip status={VERDICT_CHIP[j.verdict]}>
                {j.verdict}
                {j.confidence ? ` · 확신 ${j.confidence}` : ""}
              </StatusChip>
            </div>
            <p className="text-sm text-ink-sub">
              {p.region} · {p.category}
            </p>
            {it.why && <p className="text-base leading-relaxed">{it.why}</p>}
            {j.reasons.length > 0 && (
              <ul className="list-disc pl-5 text-base leading-relaxed text-ink-sub">
                {j.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            )}
            {caution.map((c) => (
              <p key={c} className="rounded-lg bg-caution-bg px-3 py-2 text-base text-caution-ink">
                ! {c}
              </p>
            ))}
            {p.onSite && (
              <p className="text-base leading-relaxed">
                <span className="font-bold">도착하면</span> {p.onSite}
              </p>
            )}
            {questions.length > 0 && (
              <div className="text-base">
                <p className="font-bold">출발 전 확인</p>
                <ul className="list-disc pl-5 leading-relaxed">
                  {questions.map((q) => (
                    <li key={q}>{q}</li>
                  ))}
                </ul>
              </div>
            )}
            <a
              href={`tel:${p.phone.replace(/[^\d]/g, "")}`}
              className="flex min-h-touch items-center justify-center rounded-xl border-[1.5px] border-primary bg-white px-4 text-base font-bold text-primary"
            >
              공식 전화 {p.phone}
            </a>
            {j.evidence.length > 0 && (
              <p className="text-sm leading-normal text-ink-sub">
                근거: 한국관광공사 무장애 여행정보({[...new Set(j.evidence.map((e) => e.label.replace(/^무장애·|^안내·/, "")))].join(", ")}) · AI 정리
              </p>
            )}
          </li>
        );
      })}
      <li className="text-base font-bold">
        약 {toHHMM(arrivalAtEnd(day))} {day.endName} 도착
        <span className="ml-1 text-sm font-normal text-ink-sub">(마치는 시각 {toHHMM(day.endMin)})</span>
      </li>
    </ol>
  );
}
