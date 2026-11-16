"use client";

// 장소 카드(S2 한 겹): 사진 · 도착 예상 시각 · 이름 · 판단 칩 · 공식 정보 없음 · 한 줄 이유 · 전화 · [바꾸기] · 아래 펼침 줄 [자세히].
// 가독성 원칙: 카드에는 핵심만, AI 판단 이유·도착하면·전화로 물어볼 것·가서 볼 것·공공데이터로 확인한 것·근거는 [자세히]로 펼친다.
import { ArrowLeftRight, ChevronDown, Phone } from "lucide-react";
import { type ReactNode, useState } from "react";
import { PhoneText } from "@/components/PhoneText";
import { PlacePhoto } from "@/components/photos/PlacePhoto";
import { StatusChip } from "@/components/ui/StatusChip";
import { toHHMM } from "@/lib/engine/types";
import { evidenceSourceText, publicAccessLines, UNKNOWN_LABEL, VERDICT_CHIP, verdictText } from "@/lib/trip/labels";
import { stopAnchor } from "@/lib/trip/map-points";
import { ON_SITE_KEYS, onSiteByPlace, questionsByPlace } from "@/lib/trip/questions";
import type { ItemView, OptionView, TripView } from "@/lib/trip/view";

export function PlaceCard({
  it,
  no,
  o,
  trip,
  common,
  onSwap,
  onMap,
}: {
  it: Extract<ItemView, { kind: "visit" }>;
  no: number;
  o: OptionView;
  trip: TripView;
  common: Set<string>;
  onSwap: (placeId: string) => void;
  /** 번호를 누르면 지도에서 이 장소를 보여준다(없으면 번호는 그냥 표시) */
  onMap?: (placeId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const p = trip.places[it.placeId];
  const j = trip.judgments[it.placeId];
  const questions = (questionsByPlace(o).get(it.placeId) ?? []).filter((q) => !common.has(q));
  const onSite = onSiteByPlace(o).get(it.placeId) ?? [];
  const unknownKeys = trip.unknowns?.[it.placeId] ?? [];
  const unknown = unknownKeys.map((k) => UNKNOWN_LABEL[k] ?? k);
  const needsCall = questions.length > 0 || unknownKeys.some((k) => !ON_SITE_KEYS.has(k));
  const cautions = o.cautions.filter((c) => c.placeId === it.placeId).map((c) => c.text);
  const headline = it.why ?? j.reasons[0];
  const reasons = j.reasons.filter((r) => r !== headline);
  const pub = publicAccessLines(trip.placeData?.[it.placeId]);
  const detailId = `place-${it.placeId}-${no}`;
  const replacedId = o.swapped?.[it.placeId];
  const nameId = `name-${it.placeId}-${no}`;
  return (
    <li className="relative flex gap-3 py-2">
      {onMap ? (
        <button
          type="button"
          onClick={() => onMap(it.placeId)}
          aria-label={`${no} ${p.name} 지도에서 보기`}
          title="지도에서 보기"
          className="group/no z-10 -m-1.5 flex min-h-touch min-w-touch shrink-0 items-start justify-center pt-1.5 focus-visible:outline-none"
        >
          <span className="flex min-h-8 min-w-8 aspect-square self-start items-center justify-center rounded-full bg-primary px-1 text-base leading-none font-bold text-white ring-4 ring-white transition-transform group-hover/no:scale-110 group-focus-visible/no:outline-3 group-focus-visible/no:outline-offset-2 group-focus-visible/no:outline-primary">
            {no}
          </span>
        </button>
      ) : (
        <span className="z-10 mt-3 flex min-h-8 min-w-8 aspect-square shrink-0 self-start items-center justify-center rounded-full bg-primary px-1 text-base leading-none font-bold text-white ring-4 ring-white" aria-hidden="true">
          {no}
        </span>
      )}
      <article id={stopAnchor(it.placeId)} className="min-w-0 flex-1 rounded-2xl border border-line bg-white p-4">
        <div className="flex flex-wrap gap-3">
          <PlacePhoto id={it.placeId} name={p.name} category={p.category} size="card" />
          {/* min-w-0를 두지 않는다: 이름 낱말이 사진 옆 칸에 안 들어가면 칸이 사진 아래 줄로 내려가 넓게 쓰고, 그래도 안 들어갈 때만 글자 사이에서 끊긴다 */}
          <div className="grow basis-[10rem] [overflow-wrap:break-word]">
            <p className="text-base font-bold text-primary-ink tabular-nums">
              약 {toHHMM(it.arriveMin)}~{toHHMM(it.departMin)}
            </p>
            <p className="text-sm text-ink-sub">
              머무는 {it.stayMin}분{it.extraMin ? ` + 여유 ${it.extraMin}분` : ""}
            </p>
            <h3 id={nameId} className="mt-1 text-heading font-bold">
              <span className="sr-only">{no}번째 장소: </span>
              {p.name}
            </h3>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1">
          <StatusChip status={VERDICT_CHIP[j.verdict]}>{verdictText(j.verdict, needsCall)}</StatusChip>
          {unknown.length > 0 && <span className="min-w-0 text-sm text-ink-sub [overflow-wrap:anywhere]">공식 정보 없음: {unknown.join(" · ")}</span>}
        </div>
        {replacedId && <p className="mt-1 text-sm text-ink-sub">바꾼 장소 · 원래 {trip.places[replacedId]?.name}</p>}
        {headline && <p className="mt-2 text-base leading-relaxed text-pretty">{headline}</p>}
        {cautions.length > 0 && (
          <div className="mt-2 flex flex-col gap-1 rounded-xl bg-caution-bg px-3 py-2 text-base text-caution-ink">
            {cautions.map((c) => (
              <p key={c} className="flex items-start gap-2">
                <span aria-hidden="true" className="font-bold">
                  !
                </span>
                <span className="min-w-0 flex-1">
                  <span className="sr-only">주의: </span>
                  {c}
                </span>
              </p>
            ))}
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href={`tel:${p.phone.replace(/[^\d]/g, "")}`}
            aria-label={`공식 전화 ${p.phone} 걸기`}
            className="inline-flex min-h-touch grow basis-[12rem] items-center justify-center gap-2 rounded-xl border-[1.5px] border-primary bg-white px-3 text-base font-bold text-primary transition-colors hover:bg-primary-soft hover:text-primary-ink"
          >
            <Phone size={18} className="shrink-0" aria-hidden="true" />
            <span className="tabular-nums">
              전화 <PhoneText phone={p.phone} />
            </span>
          </a>
          <button
            type="button"
            onClick={() => onSwap(it.placeId)}
            aria-label={`${p.name} 다른 곳으로 바꾸기`}
            className="inline-flex min-h-touch items-center gap-2 rounded-xl px-3 text-base font-bold text-ink transition-colors hover:bg-surface"
          >
            <ArrowLeftRight size={18} aria-hidden="true" />
            바꾸기
          </button>
        </div>

        {/* 펼침 줄: 버튼 모양이 아니라 카드 아래 구분선 + 44px 줄 */}
        <button
          type="button"
          aria-expanded={open}
          aria-controls={detailId}
          aria-describedby={nameId}
          onClick={() => setOpen((v) => !v)}
          className={`mt-4 -mx-4 flex min-h-touch w-[calc(100%+2rem)] items-center justify-between gap-2 border-t border-line px-4 text-left text-base font-bold text-ink transition-colors hover:bg-surface focus-visible:-outline-offset-3 focus-visible:outline-3 focus-visible:outline-primary ${open ? "" : "-mb-4 rounded-b-2xl"}`}
        >
          <span>
            자세히
            {questions.length > 0 && ` · 물어볼 것 ${questions.length}`}
          </span>
          <ChevronDown size={18} className={`shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>

        {open && (
          <div id={detailId} className="mt-4 flex flex-col gap-4 text-base leading-relaxed">
            <p className="text-sm font-bold text-pine">
              {p.region} · {p.category}
              {j.confidence && <span className="font-normal text-ink-sub">{` · AI 판단의 확신 ${j.confidence}`}</span>}
            </p>
            {reasons.length > 0 && (
              <Block title="AI 판단 이유">
                <ul className="list-disc pl-6">
                  {reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </Block>
            )}
            {p.onSite && <Block title="도착하면">{p.onSite}</Block>}
            {questions.length > 0 && (
              <Block title="전화로 물어볼 것">
                <ul className="list-disc pl-6">
                  {questions.map((q) => (
                    <li key={q}>{q}</li>
                  ))}
                </ul>
              </Block>
            )}
            {onSite.length > 0 && (
              <Block title="가서 보고 확인할 것">
                <ul className="list-disc pl-6">
                  {onSite.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </Block>
            )}
            {pub.length > 0 && (
              <Block title="공공데이터로 확인한 것">
                <ul className="flex flex-col gap-2">
                  {pub.map((l) => (
                    <li key={l.key} className="flex items-start gap-2">
                      <span aria-hidden="true" className="font-bold text-primary-ink">
                        ✓
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="font-bold">{l.headline}</span>
                        {l.noNursing && <span className="block text-base text-ink-sub">수유실은 정보 없음</span>}
                        <span className="block text-sm text-ink-sub">
                          {l.note}
                          {l.note ? " · " : ""}
                          {l.source}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </Block>
            )}
            {j.evidence.length > 0 && <p className="text-sm leading-normal text-ink-sub">{evidenceSourceText(j.evidence)}</p>}
          </div>
        )}
      </article>
    </li>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-base font-bold text-ink">{title}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}
