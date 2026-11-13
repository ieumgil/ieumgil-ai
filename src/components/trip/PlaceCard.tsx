"use client";

// 장소 카드: 사진 · 도착 예상 시각 · 이름 · 판단 칩 · 공식 정보 없음 · 한 줄 이유 · 전화 · [바꾸기] · [자세히].
// 가독성 원칙: 카드에는 핵심만, AI 판단 이유·도착하면·물어볼 것·근거는 [자세히]로 펼친다.
import { ArrowLeftRight, ChevronDown, CircleAlert, Info, Phone } from "lucide-react";
import { type ReactNode, useState } from "react";
import { PlacePhoto } from "@/components/photos/PlacePhoto";
import { StatusChip } from "@/components/ui/StatusChip";
import { toHHMM } from "@/lib/engine/types";
import { UNKNOWN_LABEL, VERDICT_CHIP, verdictText } from "@/lib/trip/labels";
import { questionsByPlace } from "@/lib/trip/questions";
import type { ItemView, OptionView, TripView } from "@/lib/trip/view";

export function PlaceCard({
  it,
  no,
  o,
  trip,
  common,
  delay,
  onSwap,
}: {
  it: Extract<ItemView, { kind: "visit" }>;
  no: number;
  o: OptionView;
  trip: TripView;
  common: Set<string>;
  delay: number;
  onSwap: (placeId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const p = trip.places[it.placeId];
  const j = trip.judgments[it.placeId];
  const questions = (questionsByPlace(o).get(it.placeId) ?? []).filter((q) => !common.has(q));
  const unknown = (trip.unknowns?.[it.placeId] ?? []).map((k) => UNKNOWN_LABEL[k] ?? k);
  const cautions = o.cautions.filter((c) => c.placeId === it.placeId).map((c) => c.text);
  const headline = it.why ?? j.reasons[0];
  const reasons = j.reasons.filter((r) => r !== headline);
  const detailId = `place-${it.placeId}-${no}`;
  const replacedId = o.swapped?.[it.placeId];
  return (
    <li className="relative flex animate-rise gap-3 py-2" style={{ animationDelay: `${Math.min(delay, 8) * 50}ms` }}>
      <span className="z-10 mt-3 flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-base font-bold text-white ring-4 ring-white" aria-hidden="true">
        {no}
      </span>
      <article className="min-w-0 flex-1 rounded-2xl bg-white p-4 shadow-[0_1px_3px_rgb(25_31_40/0.08),0_4px_16px_rgb(25_31_40/0.06)] ring-1 ring-line">
        <div className="flex gap-3">
          <PlacePhoto id={it.placeId} name={p.name} category={p.category} />
          <div className="min-w-0 flex-1">
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
          </div>
        </div>
        {/* 판정·바꾼 장소는 사진 아래 전체 너비로(좁은 칸에서 칩이 꺾이지 않게) */}
        {replacedId && (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-primary-soft px-2 py-0.5 text-sm font-medium text-primary-ink">
            <ArrowLeftRight size={14} aria-hidden="true" />
            바꾼 장소 · 원래 {trip.places[replacedId]?.name}
          </p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <StatusChip status={VERDICT_CHIP[j.verdict]}>{verdictText(j.verdict, questions.length + unknown.length > 0)}</StatusChip>
        </div>
        {unknown.length > 0 && (
          <p className="mt-1.5 flex items-start gap-1.5 text-sm text-ink-sub">
            <Info size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            공식 정보 없음: {unknown.join(" · ")}
          </p>
        )}
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
            onClick={() => onSwap(it.placeId)}
            aria-label={`${p.name} 다른 곳으로 바꾸기`}
            className="inline-flex min-h-touch grow basis-[6rem] items-center justify-center gap-1.5 rounded-xl bg-surface px-3 text-base font-medium whitespace-nowrap text-ink transition-[background-color,transform] duration-150 hover:bg-line active:scale-[0.98]"
          >
            <ArrowLeftRight size={18} aria-hidden="true" />
            바꾸기
          </button>
          <button
            type="button"
            aria-expanded={open}
            aria-controls={detailId}
            onClick={() => setOpen((v) => !v)}
            className="inline-flex min-h-touch grow basis-[6rem] items-center justify-center gap-1 rounded-xl bg-surface px-3 text-base font-medium whitespace-nowrap text-ink transition-[background-color,transform] duration-150 hover:bg-line active:scale-[0.98]"
          >
            자세히
            {questions.length > 0 && <span className="rounded-full bg-caution-bg px-1.5 text-sm font-bold text-caution-ink">물어볼 것 {questions.length}</span>}
            <ChevronDown size={18} className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`} aria-hidden="true" />
          </button>
        </div>

        {open && (
          <div id={detailId} className="mt-3 flex animate-rise flex-col gap-3 border-t border-line pt-3 text-base leading-relaxed">
            <p className="text-sm text-ink-sub">
              {p.region} · {p.category}
              {j.confidence ? ` · AI 판단의 확신 ${j.confidence}` : ""}
            </p>
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
              <Block title="전화로 물어볼 것">
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
