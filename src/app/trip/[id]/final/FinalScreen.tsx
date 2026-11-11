"use client";

// 확정 일정: 정한 안 하나와 지도만(다른 안·비교·설계 과정은 뺀다). 장소를 바꿨으면 바꾼 일정으로 보여준다.
// 모바일: 위 지도 + 아래 일정, PC: 왼쪽 지도 + 오른쪽 일정. 지도 경로선은 열 때마다 받고 저장하지 않는다.
// 시각은 모두 코드가 계산한 값(이동시간은 직선거리 어림)이고, 경로선은 "일반 차량 경로"다.
import { ArrowLeft, ArrowLeftRight, Car, Check, CircleAlert, CircleCheck, Flag, ListChecks, Phone, Printer, Utensils, X } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ComingSoon } from "@/components/ComingSoon";
import { TripMap } from "@/components/map/TripMap";
import { TopBar } from "@/components/TopBar";
import { Button, ButtonLink } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/StatusChip";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toHHMM } from "@/lib/engine/types";
import { formatDay, formatRange, nightsBetween, tripLabel } from "@/lib/plan/dates";
import { VERDICT_CHIP, verdictText } from "@/lib/trip/labels";
import { callPlaces, questionsByPlace } from "@/lib/trip/questions";
import { setCallResult, useCallResults, useConfirmedOption, useEditedOptions, useSavedTrip, type CallResult } from "@/lib/trip/store";
import { dayMapLabel, dayMapPoints, visitsOf } from "@/lib/trip/map-points";
import type { DayView, OptionView, TripView } from "@/lib/trip/view";

export function FinalScreen() {
  const { id } = useParams<{ id: string }>();
  const trip = useSavedTrip();
  if (id !== "new") return <ComingSoon title="예시 루트" />;
  if (trip === undefined) return null;
  if (trip === null) return <Empty text="만든 일정이 없어요" body="일정은 이 탭에서만 보관해요. 조건을 고르고 다시 만들어 주세요." href="/plan/when" cta="일정 만들기" />;
  return <Final trip={trip} />;
}

function Empty({ text, body, href, cta }: { text: string; body: string; href: string; cta: string }) {
  return (
    <main className="mx-auto flex w-full max-w-[30rem] flex-1 flex-col gap-4 px-5 pt-4 pb-7">
      <TopBar backHref="/trip/new" backLabel="일정 비교 화면으로" />
      <h1 className="mt-8 text-title font-bold">{text}</h1>
      <p className="text-base text-ink-sub">{body}</p>
      <ButtonLink href={href}>{cta}</ButtonLink>
    </main>
  );
}

function Final({ trip }: { trip: TripView }) {
  const confirmedId = useConfirmedOption(trip);
  const edited = useEditedOptions(trip);
  const base = trip.options.find((o) => o.id === confirmedId);
  if (!base) return <Empty text="아직 정한 일정이 없어요" body="일정 비교 화면에서 마음에 드는 안을 골라 '이 일정으로 정하기'를 눌러 주세요." href="/trip/new" cta="일정 고르러 가기" />;
  return <FinalOption trip={trip} o={edited[base.id] ?? base} />;
}

function FinalOption({ trip, o }: { trip: TripView; o: OptionView }) {
  const [dayIndex, setDayIndex] = useState(0);
  const day = o.days[dayIndex] ?? o.days[0];
  // 날짜·장소가 바뀔 때만 새 배열 → 그때만 지도를 다시 그린다
  const points = useMemo(() => dayMapPoints(trip, o, dayIndex), [trip, o, dayIndex]);
  const mapLabel = dayMapLabel(trip, o, dayIndex);
  const nights = trip.input.startDate && trip.input.endDate ? nightsBetween(trip.input.startDate, trip.input.endDate) : 0;
  const callSet = new Set(callPlaces(o));

  return (
    <main className="mx-auto w-full max-w-[34rem] flex-1 pb-10 md:max-w-[48rem] lg:max-w-[76rem] xl:max-w-[88rem]">
      <div className="px-5 pt-4 print:hidden">
        <TopBar backHref="/trip/new" backLabel="일정 비교 화면으로" />
      </div>

      <header className="animate-rise px-5 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
          <Link href="/trip/new" className="inline-flex min-h-touch items-center gap-1.5 text-base font-medium text-primary-ink underline-offset-4 hover:underline">
            <ArrowLeft size={18} aria-hidden="true" />
            다른 안 보기
          </Link>
          <Button variant="ghost" size="sm" onClick={() => window.print()}>
            <Printer aria-hidden="true" />
            인쇄·PDF로 저장
          </Button>
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-sm font-bold text-primary-ink">
          <CircleCheck size={16} aria-hidden="true" />
          확정한 일정
        </p>
        <h1 className="mt-1 text-title font-bold">{o.title}</h1>
        <p className="mt-1 text-base text-ink-sub">
          {trip.input.startDate && trip.input.endDate ? formatRange(trip.input.startDate, trip.input.endDate) : ""} · {tripLabel(nights)} · {o.stats.places}곳
        </p>
      </header>

      {o.days.length > 1 && (
        <Tabs value={day.date} onValueChange={(v) => setDayIndex(Math.max(0, o.days.findIndex((d) => d.date === v)))} className="mt-4 px-5 print:hidden">
          <TabsList className="w-full">
            {o.days.map((d, i) => (
              <TabsTrigger key={d.date} value={d.date} className="flex-col gap-0 font-bold data-active:text-primary-ink">
                {i + 1}일째
                <span className="text-sm font-normal">{formatDay(d.date)}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      <div className="mt-4 lg:grid lg:grid-cols-[minmax(0,1fr)_26rem] lg:gap-8 lg:px-5 xl:grid-cols-[minmax(0,1fr)_30rem]">
        <div className="px-5 lg:sticky lg:top-4 lg:self-start lg:px-0 print:hidden">
          <TripMap key={dayIndex} points={points} label={mapLabel} className="h-72 md:h-96 lg:h-[calc(100dvh-14rem)] lg:min-h-[28rem]" />
        </div>

        <div className="px-5 lg:px-0">
          {o.days.map((d, i) => (
            <section key={d.date} className={i === dayIndex ? "animate-rise" : "hidden print:block"} aria-label={`${i + 1}일째 일정`}>
              {o.days.length > 1 && (
                <h2 className={`mb-2 text-lg font-bold ${i === dayIndex ? "hidden print:block" : ""}`}>
                  {i + 1}일째 · {formatDay(d.date)}
                </h2>
              )}
              <DayList d={d} trip={trip} calls={callSet} />
            </section>
          ))}
          <Checklist o={o} trip={trip} />
          <section className="mt-8 flex flex-col gap-1.5 text-sm leading-normal text-ink-sub">
            <p>지도의 선은 일반 차량 경로예요. 휠체어 안전 경로를 뜻하지 않아요.</p>
            <p>일정의 이동 시간은 직선거리로 어림한 추정치예요. 이 일정은 이 탭에만 보관돼요.</p>
          </section>
        </div>
      </div>
    </main>
  );
}

function DayList({ d, trip, calls }: { d: DayView; trip: TripView; calls: Set<string> }) {
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
          <li key={i} className="flex gap-3 rounded-2xl bg-white p-3 ring-1 ring-line">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-base font-bold text-white" aria-hidden="true">
              {numberOf.get(it.placeId)}
            </span>
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

function Checklist({ o, trip }: { o: OptionView; trip: TripView }) {
  const qs = questionsByPlace(o);
  const all = callPlaces(o);
  const results = useCallResults(trip);
  if (all.length === 0) return null;
  const done = all.filter((id) => results[id]).length;
  const hard = all.filter((id) => results[id] === "hard").length;
  const left = all.length - done;
  const status =
    left > 0
      ? `${all.length}곳 중 ${done}곳 확인했어요 · 남은 곳 ${left}곳${hard ? ` · 어렵다고 한 곳 ${hard}곳` : ""}`
      : hard
        ? `모두 확인했어요. 어렵다고 한 곳 ${hard}곳은 다른 곳으로 바꾸는 게 좋아요.`
        : "모두 괜찮다고 확인했어요.";
  return (
    <section className="mt-8 break-inside-avoid-page" aria-labelledby="checklist-title">
      <h2 id="checklist-title" className="flex items-center gap-2 text-lg font-bold">
        <ListChecks size={20} className="text-primary" aria-hidden="true" />
        출발 전 전화로 확인할 곳
      </h2>
      <p className="mt-1 text-base text-ink-sub" aria-live="polite">
        {status}
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line print:hidden" aria-hidden="true">
        <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${(done / all.length) * 100}%` }} />
      </div>
      {left === 0 && hard === 0 && (
        <p className="mt-4 flex animate-rise items-start gap-3 rounded-2xl bg-primary-soft p-4 text-base text-primary-ink">
          <CircleCheck size={22} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            <span className="font-bold">출발 준비 끝!</span> 전화로 확인할 곳을 모두 확인했어요. 현장 사정은 바뀔 수 있으니 출발 당일에도 안내를 한 번 더 살펴봐 주세요.
          </span>
        </p>
      )}

      {o.days.map((d, di) => {
        const visits = visitsOf(d);
        const ids = visits.map((v) => v.placeId).filter((id) => all.includes(id));
        if (ids.length === 0) return null;
        return (
          <div key={d.date} className="mt-5">
            {o.days.length > 1 && (
              <h3 className="text-base font-bold text-ink-sub">
                {di + 1}일째 · {formatDay(d.date)}
              </h3>
            )}
            <ul className="mt-2 flex flex-col gap-3">
              {ids.map((id) => (
                <CallItem key={id} trip={trip} id={id} no={visits.findIndex((v) => v.placeId === id) + 1} questions={qs.get(id)!} result={results[id]} />
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}

const RESULT_TEXT: Record<CallResult, string> = { ok: "괜찮다고 했어요", hard: "어렵다고 했어요" };

function CallItem({ trip, id, no, questions, result }: { trip: TripView; id: string; no: number; questions: string[]; result?: CallResult }) {
  const p = trip.places[id];
  const j = trip.judgments[id];
  const choose = (r: CallResult) => setCallResult(trip, id, result === r ? null : r);
  const choice = (r: CallResult, icon: React.ReactNode, label: string, on: string) => (
    <button
      type="button"
      aria-pressed={result === r}
      onClick={() => choose(r)}
      className={`inline-flex min-h-touch flex-1 items-center justify-center gap-1.5 rounded-xl px-3 text-base font-bold whitespace-nowrap transition-[background-color,color,transform] duration-150 active:scale-[0.98] ${result === r ? on : "bg-white text-ink ring-1 ring-line hover:bg-surface"}`}
    >
      {icon}
      {label}
    </button>
  );
  return (
    <li className={`break-inside-avoid rounded-2xl p-4 ring-1 transition-colors ${result === "ok" ? "bg-surface ring-transparent" : result === "hard" ? "bg-white ring-caution-ink/40" : "bg-white ring-line"}`}>
      <p className="flex flex-wrap items-center gap-2 text-base font-bold">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm text-white" aria-hidden="true">
          {no}
        </span>
        <span className={result === "ok" ? "text-ink-sub" : ""}>{p.name}</span>
        {j.verdict === "확인 필요" && <StatusChip status="caution">확인 필요</StatusChip>}
      </p>
      <ul className={`mt-2 list-disc pl-6 text-base leading-relaxed ${result === "ok" ? "text-ink-sub" : ""}`}>
        {questions.map((q) => (
          <li key={q}>{q}</li>
        ))}
      </ul>
      <a
        href={`tel:${p.phone.replace(/[^\d]/g, "")}`}
        aria-label={`공식 전화 ${p.phone} 걸기`}
        className="mt-3 inline-flex min-h-touch w-full items-center justify-center gap-1.5 rounded-xl border-[1.5px] border-primary bg-white px-3 text-base font-bold whitespace-nowrap text-primary tabular-nums print:hidden"
      >
        <Phone size={18} aria-hidden="true" />
        {p.phone}
      </a>
      <p className="hidden text-base print:block">
        ☎ {p.phone}
        {result ? ` · 확인 결과: ${RESULT_TEXT[result]}` : ""}
      </p>
      <div className="mt-2 flex gap-2 print:hidden" role="group" aria-label={`${p.name} 전화 결과`}>
        {choice("ok", <Check size={18} aria-hidden="true" />, "괜찮대요", "bg-primary text-white")}
        {choice("hard", <X size={18} aria-hidden="true" />, "어렵대요", "bg-caution-bg text-caution-ink ring-1 ring-caution-ink/40")}
      </div>
      {result === "hard" && (
        <div className="mt-3 flex animate-rise flex-col gap-2 rounded-xl bg-caution-bg p-3 text-base text-caution-ink print:hidden">
          <p className="flex items-start gap-2">
            <CircleAlert size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
            어렵다면 근처의 다른 곳으로 바꾸는 게 좋아요.
          </p>
          <ButtonLink href={`/trip/new?swap=${id}`} className="h-12 w-full text-base">
            <ArrowLeftRight aria-hidden="true" />
            다른 곳으로 바꾸기
          </ButtonLink>
        </div>
      )}
    </li>
  );
}
