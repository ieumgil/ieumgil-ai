// 확정 일정의 하루 목록: 출발 → 이동 → 장소(사진 · 시각 · 이름 · 판단 칩 · 전화 · 가서 볼 것) → 점심·휴식 → 도착. 인쇄할 때는 모든 날을 펼친다.
// 결과 화면(OptionDetail)과 같은 타임라인이다(11/18): 왼쪽 세로 연결선 위에 출발·도착 깃발, 이동·점심은 작은 점, 장소는 번호 + 카드.
// 확정 화면은 보기 전용이라 카드에 바꾸기·자세히가 없다. 같은 '가서 볼 것' 안내가 하루 2곳 이상이면 목록 위에 한 번만 보여준다(내용은 지우지 않는다).
import { Flag, Phone } from "lucide-react";
import { PhoneText } from "@/components/PhoneText";
import { PlacePhoto } from "@/components/photos/PlacePhoto";
import { StatusChip } from "@/components/ui/StatusChip";
import { toHHMM } from "@/lib/engine/types";
import { VERDICT_CHIP, verdictText } from "@/lib/trip/labels";
import { stopAnchor, visitsOf } from "@/lib/trip/map-points";
import { splitCommonOnSite } from "@/lib/trip/questions";
import type { DayView, TripView } from "@/lib/trip/view";
import { TimelineLine, TimelineNode } from "./Timeline";

const NO_ON_SITE: Map<string, string[]> = new Map();

/** cautions: 장소 id → 비·눈 주의 문구(확정·공유 화면이 날씨 예보로 만든 것, 없으면 지금 화면 그대로) */
export function DayList({ d, trip, calls, onSite = NO_ON_SITE, cautions }: { d: DayView; trip: TripView; calls: Set<string>; onSite?: Map<string, string[]>; cautions?: Map<string, string> }) {
  const visits = visitsOf(d);
  const numberOf = new Map(visits.map((v, i) => [v.placeId, i + 1]));
  const { common, perPlace } = splitCommonOnSite(
    visits.map((v) => v.placeId),
    onSite,
  );
  const last = d.items.at(-1);
  const arrival = last && last.kind === "travel" ? last.startMin + last.minutes : d.endMin;
  return (
    <>
      {common.length > 0 && (
        <div className="mb-2 border-b border-line pb-4 text-base leading-relaxed text-ink-sub">
          <p className="font-bold">가서 보고 확인할 것 · 공통</p>
          <ul className="list-disc pl-6">
            {common.map((c) => (
              <li key={c.text}>
                {c.text}
                <span className="text-sm"> · {c.nos.join("·")}번 장소</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <ol className="relative flex flex-col">
        <TimelineLine />
        <TimelineNode icon={<Flag size={16} />}>
          <span className="font-bold">{toHHMM(d.startMin)}</span> {d.startName} 출발
        </TimelineNode>
        {d.items.map((it, i) => {
          if (it.kind === "travel") {
            return (
              <TimelineNode key={i} small>
                차량 약 {it.minutes}분 · {it.km}km{it.estimated ? " · 추정" : ""}
              </TimelineNode>
            );
          }
          if (it.kind === "lunch") {
            return (
              <TimelineNode key={i}>
                <span className="font-bold">
                  {toHHMM(it.startMin)}~{toHHMM(it.endMin)}
                </span>
                {" 점심·휴식"}
              </TimelineNode>
            );
          }
          if (it.kind !== "visit") {
            return (
              <TimelineNode key={i} small>
                {toHHMM(it.startMin)}~{toHHMM(it.endMin)} {it.kind === "rest" ? "쉬는 시간" : "문 열 때까지 기다리기"}
              </TimelineNode>
            );
          }
          const p = trip.places[it.placeId];
          const j = trip.judgments[it.placeId];
          const here = perPlace.get(it.placeId) ?? [];
          const no = numberOf.get(it.placeId);
          const headline = it.why ?? j.reasons[0];
          return (
            <li key={i} id={stopAnchor(it.placeId)} className="relative flex gap-3 py-2">
              <span
                className="z-10 mt-3 flex min-h-8 min-w-8 aspect-square shrink-0 self-start items-center justify-center rounded-full bg-primary px-1 text-base leading-none font-bold text-white ring-4 ring-white"
                aria-hidden="true"
              >
                {no}
              </span>
              <article className="min-w-0 flex-1 rounded-2xl border border-line bg-white p-4">
                <div className="flex flex-wrap gap-3">
                  <PlacePhoto id={it.placeId} name={p.name} category={p.category} size="card" className="print:hidden" />
                  <div className="grow basis-[10rem] [overflow-wrap:break-word]">
                    <p className="text-base font-bold text-primary-ink tabular-nums">
                      약 {toHHMM(it.arriveMin)}~{toHHMM(it.departMin)}
                    </p>
                    <p className="text-sm text-ink-sub">
                      머무는 {it.stayMin}분{it.extraMin ? ` + 여유 ${it.extraMin}분` : ""}
                    </p>
                    <h2 className="mt-1 text-heading font-bold">
                      <span className="sr-only">{no}번째 장소: </span>
                      {p.name}
                    </h2>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-0">
                  <StatusChip status={VERDICT_CHIP[j.verdict]}>{verdictText(j.verdict, calls.has(it.placeId))}</StatusChip>
                  <a
                    href={`tel:${p.phone.replace(/[^\d]/g, "")}`}
                    aria-label={`공식 전화 ${p.phone} 걸기`}
                    className="inline-flex min-h-touch items-center gap-2 text-base font-bold text-primary tabular-nums hover:underline"
                  >
                    <Phone size={16} aria-hidden="true" />
                    <span>
                      <PhoneText phone={p.phone} />
                    </span>
                  </a>
                </div>
                {headline && <p className="mt-2 text-base leading-relaxed text-pretty">{headline}</p>}
                {cautions?.get(it.placeId) && (
                  <p className="mt-2 flex items-start gap-2 rounded-xl bg-caution-bg px-3 py-2 text-base text-caution-ink">
                    <span aria-hidden="true" className="font-bold">
                      !
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="sr-only">주의: </span>
                      {cautions.get(it.placeId)}
                    </span>
                  </p>
                )}
                {here.length > 0 && (
                  <div className="mt-2 text-base leading-relaxed text-ink-sub">
                    <p className="font-bold">가서 보고 확인할 것</p>
                    <ul className="list-disc pl-6">
                      {here.map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </article>
            </li>
          );
        })}
        <TimelineNode icon={<Flag size={16} />}>
          <span className="font-bold">약 {toHHMM(arrival)}</span> {d.endName} 도착
        </TimelineNode>
      </ol>
    </>
  );
}
