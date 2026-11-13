"use client";

// 출발 전 전화 확인 체크리스트: 날짜별로 장소마다 물어볼 것과 공식 전화, [괜찮대요]/[어렵대요].
// 어렵대요면 그 자리에서 다른 곳으로 바꾸기를 권하고, 모두 괜찮으면 "출발 준비 끝!". 결과는 이 탭에만 보관한다.
import { ArrowLeftRight, Check, CircleAlert, CircleCheck, ListChecks, Phone, X } from "lucide-react";
import { StatusChip } from "@/components/ui/StatusChip";
import { ButtonLink } from "@/components/ui/button";
import { formatDay } from "@/lib/plan/dates";
import { tripHref } from "@/lib/trip/example";
import { visitsOf } from "@/lib/trip/map-points";
import { callPlaces, questionsByPlace } from "@/lib/trip/questions";
import { type CallResult, setCallResult, useCallResults } from "@/lib/trip/store";
import type { OptionView, TripView } from "@/lib/trip/view";

export function Checklist({ o, trip }: { o: OptionView; trip: TripView }) {
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
          <ButtonLink href={`${tripHref(trip)}?swap=${id}`} className="h-12 w-full text-base">
            <ArrowLeftRight aria-hidden="true" />
            다른 곳으로 바꾸기
          </ButtonLink>
        </div>
      )}
    </li>
  );
}
