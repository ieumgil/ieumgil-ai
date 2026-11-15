// 확정 일정의 하루 목록: 출발 → 이동 → 장소(사진 · 시각 · 이름 · 판단 칩 · 전화 · 가서 볼 것) → 점심·휴식 → 도착. 인쇄할 때는 모든 날을 펼친다.
// 장소 줄은 카드가 아니라 구분선 행이다. 같은 '가서 볼 것' 안내가 하루 2곳 이상이면 목록 위에 한 번만 보여준다(내용은 지우지 않는다).
import { Flag, Phone } from "lucide-react";
import { PhoneText } from "@/components/PhoneText";
import { PlacePhoto } from "@/components/photos/PlacePhoto";
import { StatusChip } from "@/components/ui/StatusChip";
import { toHHMM } from "@/lib/engine/types";
import { VERDICT_CHIP, verdictText } from "@/lib/trip/labels";
import { stopAnchor, visitsOf } from "@/lib/trip/map-points";
import { splitCommonOnSite } from "@/lib/trip/questions";
import type { DayView, TripView } from "@/lib/trip/view";

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
      <ol className="flex flex-col">
        <Row icon={<Flag size={16} />}>
          <span className="font-bold">{toHHMM(d.startMin)}</span> {d.startName} 출발
        </Row>
        {d.items.map((it, i) => {
          if (it.kind === "travel") {
            return (
              <li key={i} className="py-1 pl-11 text-sm text-ink-sub">
                차량 약 {it.minutes}분 · {it.km}km
              </li>
            );
          }
          if (it.kind === "lunch") {
            return (
              <Row key={i}>
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
          const here = perPlace.get(it.placeId) ?? [];
          return (
            <li key={i} id={stopAnchor(it.placeId)} className="flex gap-3 border-b border-line py-4">
              <span
                className="flex min-h-8 min-w-8 shrink-0 aspect-square items-center justify-center rounded-full bg-primary text-base leading-none font-bold text-white"
                aria-hidden="true"
              >
                {numberOf.get(it.placeId)}
              </span>
              <PlacePhoto id={it.placeId} name={p.name} category={p.category} size="sm" className="print:hidden" />
              <div className="min-w-0 flex-1">
                <p className="text-base font-bold text-primary-ink tabular-nums">
                  약 {toHHMM(it.arriveMin)}~{toHHMM(it.departMin)}
                </p>
                <h2 className="text-heading leading-snug font-bold [overflow-wrap:anywhere]">
                  <span className="sr-only">{numberOf.get(it.placeId)}번째 장소: </span>
                  {p.name}
                </h2>
                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-0">
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
                {cautions?.get(it.placeId) && (
                  <p className="mt-1 flex items-start gap-2 text-base font-bold text-caution-ink">
                    <span aria-hidden="true">!</span>
                    <span className="sr-only">주의: </span>
                    {cautions.get(it.placeId)}
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
              </div>
            </li>
          );
        })}
        <Row icon={<Flag size={16} />}>
          <span className="font-bold">약 {toHHMM(arrival)}</span> {d.endName} 도착
        </Row>
      </ol>
    </>
  );
}

/** icon이 없으면(점심 같은 줄) 글자만 같은 자리에 맞춰 둔다 */
function Row({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className={`flex items-center gap-3 py-2 text-base ${icon ? "" : "pl-11"}`}>
      {icon && (
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface text-ink-sub" aria-hidden="true">
          {icon}
        </span>
      )}
      <span>{children}</span>
    </li>
  );
}
