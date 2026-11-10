"use client";

// 결과 화면: AI가 만든 일정 2~3안 비교 → 고른 안의 날짜별 타임라인 → 이 일정으로 정하기.
// 가독성 원칙: 카드에는 핵심(시각·이름·판단·한 줄 이유·전화)만, 나머지는 [자세히]로 펼친다.
// 시각은 모두 코드가 계산한 값이고, 이동시간은 지금 직선거리 추정치라 '약'과 '추정'을 붙인다.
// PC는 왼쪽(요약·안 고르기·지도 자리) + 오른쪽(타임라인), 모바일은 위아래로 쌓고 아래에 확정 버튼을 고정한다.
import {
  Accessibility,
  Baby,
  BedDouble,
  CalendarDays,
  Car,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  Coffee,
  Flag,
  Hourglass,
  ListChecks,
  Map as MapIcon,
  MapPin,
  PersonStanding,
  Phone,
  Sparkles,
  Utensils,
} from "lucide-react";
import { useParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { ComingSoon } from "@/components/ComingSoon";
import { TopBar } from "@/components/TopBar";
import { Button, ButtonLink } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { StatusChip, type ChipStatus } from "@/components/ui/StatusChip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { Verdict } from "@/lib/ai/guards";
import { toHHMM } from "@/lib/engine/types";
import { formatDay, formatRange, nightsBetween, tripLabel } from "@/lib/plan/dates";
import { TRAVELER_LABELS } from "@/lib/engine/conditions";
import { confirmOption, useConfirmedOption, useSavedTrip } from "@/lib/trip/store";
import type { DayView, ItemView, OptionView, TripView } from "@/lib/trip/view";

const VERDICT_CHIP: Record<Verdict, ChipStatus> = { 적합: "ok", 주의: "caution", "확인 필요": "caution", 부적합: "blocked" };
const FIT_CHIP = { 여유: { s: "ok", t: "시간 여유 있어요" }, 빠듯: { s: "caution", t: "조금 빠듯해요" }, 부족: { s: "blocked", t: "시간이 부족해요" } } as const;
const STRATEGY_LABEL: Record<string, string> = { 여유: "여유롭게", 취향: "좋아하는 곳 중심", 실내: "실내 위주", "확인 적게": "확인할 것 적게", 규칙: "기본 일정" };
const TRAVELER_ICON = { wheelchair: <Accessibility size={16} />, elder: <PersonStanding size={16} />, stroller: <Baby size={16} /> } as const;

export function TripScreen() {
  const { id } = useParams<{ id: string }>();
  const trip = useSavedTrip();
  if (id !== "new") return <ComingSoon title="예시 루트" />;
  if (trip === undefined) return null;
  if (trip === null) {
    return (
      <main className="mx-auto flex w-full max-w-[30rem] flex-1 flex-col gap-4 px-5 pt-4 pb-7">
        <TopBar backHref="/" backLabel="처음 화면으로" />
        <h1 className="mt-8 text-title font-bold">만든 일정이 없어요</h1>
        <p className="text-base text-ink-sub">일정은 이 탭에서만 보관해요. 조건을 고르고 다시 만들어 주세요.</p>
        <ButtonLink href="/plan/when">일정 만들기</ButtonLink>
      </main>
    );
  }
  return <TripResult trip={trip} />;
}

function TripResult({ trip }: { trip: TripView }) {
  const confirmedId = useConfirmedOption(trip);
  const [selected, setSelected] = useState(confirmedId ?? trip.options[0]?.id);
  const [sheetOpen, setSheetOpen] = useState(false);
  const option = trip.options.find((o) => o.id === selected) ?? trip.options[0];
  const isConfirmed = confirmedId === option.id;

  const confirm = () => {
    confirmOption(trip, option.id);
    setSheetOpen(true);
  };

  return (
    <main className="mx-auto w-full max-w-[34rem] flex-1 pb-28 lg:max-w-[72rem] lg:pb-12">
      <div className="px-5 pt-4">
        <TopBar backHref="/plan/taste" backLabel="조건 화면으로" />
      </div>

      <div className="lg:grid lg:grid-cols-[23rem_minmax(0,1fr)] lg:gap-8 lg:px-5">
        {/* 왼쪽(PC) / 위(모바일): 요약 · 안 고르기 · 지도 자리 */}
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <Summary trip={trip} />
          {trip.options.length > 1 && <OptionPicker trip={trip} selected={option.id} confirmedId={confirmedId} onSelect={setSelected} />}
          <div className="mx-5 mt-4 hidden flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line-strong bg-surface py-10 text-center text-ink-sub lg:mx-0 lg:flex">
            <MapIcon size={28} aria-hidden="true" />
            <p className="text-base font-medium">지도는 곧 이곳에 보여드릴게요</p>
            <p className="text-sm">번호는 타임라인 순서와 같아요</p>
          </div>
          <div className="mt-4 hidden lg:block">
            <ConfirmButton confirmed={isConfirmed} onConfirm={confirm} onOpen={() => setSheetOpen(true)} title={option.title} />
          </div>
        </aside>

        {/* 오른쪽(PC) / 아래(모바일): 고른 안 */}
        <section key={option.id} className="animate-rise" aria-label={`${option.title} 일정`}>
          <OptionDetail o={option} trip={trip} />
          <Footnotes trip={trip} />
        </section>
      </div>

      {/* 모바일: 아래 고정 확정 버튼 */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white/95 px-5 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
        <div className="mx-auto max-w-[30rem]">
          <ConfirmButton confirmed={isConfirmed} onConfirm={confirm} onOpen={() => setSheetOpen(true)} title={option.title} />
        </div>
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="mx-auto max-h-[85dvh] max-w-[34rem] overflow-y-auto rounded-t-3xl px-5 pb-8">
          <ConfirmSheet o={option} trip={trip} onChange={() => setSheetOpen(false)} />
        </SheetContent>
      </Sheet>
    </main>
  );
}

function Summary({ trip }: { trip: TripView }) {
  const nights = trip.input.startDate && trip.input.endDate ? nightsBetween(trip.input.startDate, trip.input.endDate) : 0;
  const ai = !trip.usedFallback;
  return (
    <header className="animate-rise px-5 pt-6 lg:px-0">
      <p className="flex items-center gap-1.5 text-sm font-bold text-primary-ink">
        <Sparkles size={16} aria-hidden="true" />
        {ai ? "AI 추천 일정" : "기본 일정"}
      </p>
      <h1 className="mt-1 text-title font-bold">{ai ? `일정 ${trip.options.length}가지를 만들었어요` : "기본 일정을 만들었어요"}</h1>
      <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="여행 조건">
        <Pill icon={<CalendarDays size={16} />}>
          {trip.input.startDate && trip.input.endDate ? formatRange(trip.input.startDate, trip.input.endDate) : ""} · {tripLabel(nights)}
        </Pill>
        {trip.input.travelers.map((t) => (
          <Pill key={t} icon={TRAVELER_ICON[t]}>
            {TRAVELER_LABELS[t]}
          </Pill>
        ))}
        <Pill icon={<Car size={16} />}>{trip.input.transport === "car" ? "자가용" : "택시"}</Pill>
        {trip.input.lodging && <Pill icon={<BedDouble size={16} />}>숙소 {trip.input.lodging}</Pill>}
      </ul>
      {!ai && <Notice>AI 설계를 불러오지 못해 규칙으로 만든 일정이에요.</Notice>}
      {trip.notes.map((n) => (
        <Notice key={n}>{n}</Notice>
      ))}
    </header>
  );
}

function Pill({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-sm font-medium text-ink">
      <span className="text-ink-sub" aria-hidden="true">
        {icon}
      </span>
      {children}
    </li>
  );
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <p className="mt-3 flex items-start gap-2 rounded-xl bg-caution-bg px-4 py-3 text-base text-caution-ink">
      <CircleAlert size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span>
        <span className="sr-only">주의: </span>
        {children}
      </span>
    </p>
  );
}

function OptionPicker({ trip, selected, confirmedId, onSelect }: { trip: TripView; selected: string; confirmedId: string | null; onSelect: (id: string) => void }) {
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
        spacing={3}
        className="mt-3 flex w-full snap-x items-stretch justify-start gap-3 overflow-x-auto px-5 pb-2 lg:flex-col lg:overflow-visible lg:px-0"
      >
        {trip.options.map((o, i) => {
          const avg = o.review ? ((o.review.fatigue + o.review.slack + o.review.taste) / 3).toFixed(1) : null;
          return (
            <ToggleGroupItem
              key={o.id}
              value={o.id}
              style={{ animationDelay: `${60 + i * 70}ms` }}
              className="h-auto w-[16.5rem] shrink-0 animate-rise snap-start flex-col items-stretch gap-2 rounded-2xl border-2 border-surface bg-surface p-4 text-left whitespace-normal transition-[border-color,background-color,transform] duration-200 hover:bg-surface active:scale-[0.99] data-[state=on]:border-primary data-[state=on]:bg-primary-soft lg:w-full"
            >
              <span className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 text-sm font-bold text-primary-ink">
                  <span className="flex size-7 items-center justify-center rounded-full bg-primary text-sm text-white">{o.id}</span>
                  {STRATEGY_LABEL[o.strategy] ?? o.strategy}
                </span>
                {confirmedId === o.id && (
                  <span className="inline-flex items-center gap-1 text-sm font-bold text-primary">
                    <CircleCheck size={16} aria-hidden="true" />
                    정했어요
                  </span>
                )}
              </span>
              <span className="text-lead leading-snug font-bold text-ink">{o.title}</span>
              <span className="line-clamp-2 text-sm leading-normal font-normal text-ink-sub">{o.summary}</span>
              <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-medium text-ink">
                <span className="inline-flex items-center gap-1">
                  <MapPin size={16} className="text-ink-sub" aria-hidden="true" />
                  {o.stats.places}곳
                </span>
                <span className="inline-flex items-center gap-1">
                  <Car size={16} className="text-ink-sub" aria-hidden="true" />
                  이동 약 {o.stats.travelMin}분
                </span>
                {o.stats.checkNeeded > 0 && (
                  <span className="inline-flex items-center gap-1 text-caution-ink">
                    <CircleAlert size={16} aria-hidden="true" />
                    확인 {o.stats.checkNeeded}곳
                  </span>
                )}
              </span>
              {o.review && (
                <span className="text-sm font-normal text-ink-sub">
                  AI 점검 {avg}/5 <span className="text-ink-sub/80">(피로도 {o.review.fatigue} · 여유 {o.review.slack} · 취향 {o.review.taste})</span>
                </span>
              )}
            </ToggleGroupItem>
          );
        })}
      </ToggleGroup>
    </section>
  );
}

function ConfirmButton({ confirmed, onConfirm, onOpen, title }: { confirmed: boolean; onConfirm: () => void; onOpen: () => void; title: string }) {
  return confirmed ? (
    <Button variant="outline" className="w-full" onClick={onOpen}>
      <ListChecks aria-hidden="true" />
      정한 일정 · 출발 전 확인할 것 보기
    </Button>
  ) : (
    <Button className="w-full active:scale-[0.99]" onClick={onConfirm} aria-label={`${title} 일정으로 정하기`}>
      <CircleCheck aria-hidden="true" />이 일정으로 정하기
    </Button>
  );
}

function OptionDetail({ o, trip }: { o: OptionView; trip: TripView }) {
  const counts = new Map<string, number>();
  o.checkBeforeGo.forEach((q) => counts.set(q.question, (counts.get(q.question) ?? 0) + 1));
  const common = new Set([...counts].filter(([, n]) => n > 1).map(([q]) => q));
  const day = (d: DayView, i: number) => <DayPanel key={d.date} d={d} index={i} o={o} trip={trip} common={common} />;

  return (
    <div className="px-5 pt-6 lg:px-0">
      <h2 className="text-xl leading-snug font-bold">{o.title}</h2>
      <p className="mt-1 text-base text-ink-sub">{o.summary}</p>
      {common.size > 0 && (
        <details className="group mt-4 rounded-2xl bg-caution-bg px-4 py-1 text-caution-ink">
          <summary className="flex min-h-touch cursor-pointer list-none items-center justify-between gap-2 text-base font-bold">
            <span className="inline-flex items-center gap-2">
              <CircleAlert size={20} aria-hidden="true" />
              여러 곳 공통으로 확인할 것 {common.size}가지
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
        <Tabs defaultValue={o.days[0].date} className="mt-5">
          <TabsList className="w-full">
            {o.days.map((d, i) => (
              <TabsTrigger key={d.date} value={d.date} className="flex-col gap-0 font-bold data-active:text-primary-ink">
                {i + 1}일째
                <span className="text-sm font-normal">{formatDay(d.date)}</span>
              </TabsTrigger>
            ))}
          </TabsList>
          {o.days.map((d, i) => (
            <TabsContent key={d.date} value={d.date} className="animate-rise">
              {day(d, i)}
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        o.days.map(day)
      )}
    </div>
  );
}

function DayPanel({ d, index, o, trip, common }: { d: DayView; index: number; o: OptionView; trip: TripView; common: Set<string> }) {
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
          return <PlaceCard key={i} it={it} no={numberOf.get(it.placeId)!} o={o} trip={trip} common={common} delay={i} />;
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

function PlaceCard({ it, no, o, trip, common, delay }: { it: Extract<ItemView, { kind: "visit" }>; no: number; o: OptionView; trip: TripView; common: Set<string>; delay: number }) {
  const [open, setOpen] = useState(false);
  const p = trip.places[it.placeId];
  const j = trip.judgments[it.placeId];
  const questions = o.checkBeforeGo.filter((q) => q.placeId === it.placeId && !common.has(q.question)).map((q) => q.question);
  const cautions = o.cautions.filter((c) => c.placeId === it.placeId).map((c) => c.text);
  const headline = it.why ?? j.reasons[0];
  const reasons = j.reasons.filter((r) => r !== headline);
  const detailId = `place-${it.placeId}-${no}`;
  return (
    <li className="relative flex animate-rise gap-3 py-2" style={{ animationDelay: `${Math.min(delay, 8) * 50}ms` }}>
      <span className="z-10 mt-3 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-base font-bold text-white ring-4 ring-white" aria-hidden="true">
        {no}
      </span>
      <article className="min-w-0 flex-1 rounded-2xl bg-white p-4 shadow-[0_1px_3px_rgb(25_31_40/0.08),0_4px_16px_rgb(25_31_40/0.06)] ring-1 ring-line">
        <p className="flex flex-wrap items-baseline gap-x-2 text-base">
          <span className="font-bold text-primary-ink tabular-nums">
            약 {toHHMM(it.arriveMin)}~{toHHMM(it.departMin)}
          </span>
          <span className="text-sm text-ink-sub">
            머무는 {it.stayMin}분{it.extraMin ? ` + 여유 ${it.extraMin}분` : ""}
          </span>
        </p>
        <h3 className="mt-1 text-lg leading-snug font-bold">
          <span className="sr-only">{no}번째 장소: </span>
          {p.name}
        </h3>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <StatusChip status={VERDICT_CHIP[j.verdict]}>
            {j.verdict}
            {j.confidence ? ` · 확신 ${j.confidence}` : ""}
          </StatusChip>
          <span className="text-sm text-ink-sub">
            {p.region} · {p.category}
          </span>
        </div>
        {headline && <p className="mt-2.5 text-base leading-relaxed">{headline}</p>}
        {cautions.map((c) => (
          <p key={c} className="mt-2 flex items-start gap-2 rounded-lg bg-caution-bg px-3 py-2 text-base text-caution-ink">
            <CircleAlert size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
            {c}
          </p>
        ))}

        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href={`tel:${p.phone.replace(/[^\d]/g, "")}`}
            aria-label={`공식 전화 ${p.phone} 걸기`}
            className="inline-flex min-h-touch grow basis-[11.5rem] items-center justify-center gap-1.5 rounded-xl border-[1.5px] border-primary bg-white px-3 text-base font-bold whitespace-nowrap text-primary transition-colors hover:bg-primary-soft active:scale-[0.99]"
          >
            <Phone size={18} className="shrink-0" aria-hidden="true" />
            <span className="hidden sm:inline">전화</span>
            <span className="tabular-nums">{p.phone}</span>
          </a>
          <button
            type="button"
            aria-expanded={open}
            aria-controls={detailId}
            onClick={() => setOpen((v) => !v)}
            className="inline-flex min-h-touch grow basis-[7rem] items-center justify-center gap-1 rounded-xl bg-surface px-3 text-base font-medium whitespace-nowrap text-ink transition-colors hover:bg-line"
          >
            자세히
            {questions.length > 0 && <span className="rounded-full bg-caution-bg px-1.5 text-sm font-bold text-caution-ink">확인 {questions.length}</span>}
            <ChevronDown size={18} className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`} aria-hidden="true" />
          </button>
        </div>

        {open && (
          <div id={detailId} className="mt-3 flex animate-rise flex-col gap-3 border-t border-line pt-3 text-base leading-relaxed">
            {reasons.length > 0 && (
              <Block title="AI 판단 이유">
                <ul className="list-disc pl-5">
                  {reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </Block>
            )}
            {p.onSite && <Block title="도착하면">{p.onSite}</Block>}
            {questions.length > 0 && (
              <Block title="출발 전 확인">
                <ul className="list-disc pl-5">
                  {questions.map((q) => (
                    <li key={q}>{q}</li>
                  ))}
                </ul>
              </Block>
            )}
            {j.evidence.length > 0 && (
              <p className="text-sm leading-normal text-ink-sub">
                근거: 한국관광공사 무장애 여행정보({[...new Set(j.evidence.map((e) => e.label.replace(/^무장애·|^안내·/, "")))].join(", ")}) · AI 정리
              </p>
            )}
          </div>
        )}
      </article>
    </li>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-sm font-bold text-ink-sub">{title}</p>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}

function ConfirmSheet({ o, trip, onChange }: { o: OptionView; trip: TripView; onChange: () => void }) {
  const byPlace = new Map<string, string[]>();
  for (const q of o.checkBeforeGo) byPlace.set(q.placeId, [...(byPlace.get(q.placeId) ?? []), q.question]);
  const places = o.days.flatMap((d) => d.items.filter((x): x is Extract<ItemView, { kind: "visit" }> => x.kind === "visit").map((v) => v.placeId));
  return (
    <>
      <SheetHeader className="px-0 pt-6">
        <SheetTitle className="flex items-center gap-2 text-xl font-bold">
          <CircleCheck className="text-primary" aria-hidden="true" />
          &lsquo;{o.title}&rsquo; 일정으로 정했어요
        </SheetTitle>
        <SheetDescription>출발 전에 아래 장소에 전화로 확인해 두면 좋아요. 이 일정은 이 탭에만 보관돼요.</SheetDescription>
      </SheetHeader>
      <ol className="flex flex-col gap-3">
        {places.map((id, i) => {
          const p = trip.places[id];
          const qs = byPlace.get(id) ?? [];
          return (
            <li key={id} className="rounded-2xl bg-surface p-4">
              <p className="flex items-center gap-2 text-base font-bold">
                <span className="flex size-6 items-center justify-center rounded-full bg-primary text-sm text-white" aria-hidden="true">
                  {i + 1}
                </span>
                {p.name}
              </p>
              {qs.length > 0 ? (
                <ul className="mt-2 list-disc pl-5 text-base leading-relaxed">
                  {qs.map((q) => (
                    <li key={q}>{q}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-base text-ink-sub">따로 확인할 것은 없어요.</p>
              )}
              <a href={`tel:${p.phone.replace(/[^\d]/g, "")}`} className="mt-3 inline-flex min-h-touch w-full items-center justify-center gap-2 rounded-xl border-[1.5px] border-primary bg-white text-base font-bold text-primary">
                <Phone size={18} aria-hidden="true" />
                {p.phone}
              </a>
            </li>
          );
        })}
      </ol>
      <div className="mt-4 flex flex-col gap-2">
        <Button variant="secondary" onClick={onChange}>
          닫기
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            confirmOption(trip, null);
            onChange();
          }}
        >
          정한 것 취소하고 다른 일정 보기
        </Button>
      </div>
    </>
  );
}

function Footnotes({ trip }: { trip: TripView }) {
  return (
    <div className="px-5 lg:px-0">
      <section className="mt-8 flex flex-col gap-1.5 text-sm leading-normal text-ink-sub">
        <p>이동 시간은 직선거리로 어림한 추정치예요. 경로는 일반 차량 기준이며 휠체어 안전 경로를 뜻하지 않아요.</p>
        <p>접근성 정보는 한국관광공사 무장애 여행정보를 AI가 읽고 정리한 것이라 현장과 다를 수 있어요.</p>
      </section>
      <details className="group mt-5 rounded-2xl bg-surface px-4 py-1">
        <summary className="flex min-h-touch cursor-pointer list-none items-center justify-between text-base font-bold">
          <span className="inline-flex items-center gap-2">
            <Sparkles size={18} aria-hidden="true" />
            AI 설계 과정 보기
          </span>
          <ChevronDown size={20} className="transition-transform duration-200 group-open:rotate-180" aria-hidden="true" />
        </summary>
        <ul className="flex flex-col gap-1.5 pb-3 text-sm leading-normal text-ink-sub">
          <li>
            AI 호출 {trip.calls}회 · {Math.round(trip.ms / 1000)}초
          </li>
          <li>장소 판단: 후보마다 3번 판단해 맞춰 보고, 근거가 원문에 없으면 버렸어요.</li>
          {trip.options.map((o) => (
            <li key={o.id}>
              {o.id}안 {o.title}: {o.source === "ai" ? `검사 통과${o.fixes ? ` (다시 고친 횟수 ${o.fixes})` : ""}` : "규칙 일정"}
              {o.fixedViolations.length > 0 && <span> · 고친 내용: {o.fixedViolations.join(" / ")}</span>}
              {o.review && <span> · 점검: {o.review.comment}</span>}
            </li>
          ))}
        </ul>
      </details>
      <ButtonLink href="/plan/when" variant="outline" className="mt-5">
        조건 바꿔 다시 만들기
      </ButtonLink>
    </div>
  );
}
