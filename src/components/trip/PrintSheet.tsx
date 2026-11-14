// 인쇄·PDF용 한 장짜리 일정표(11/14). 화면에서는 숨기고, 인쇄할 때는 화면 배치 대신 이것만 나온다.
// A4 1~2장: 머리(일정 이름·날짜·유형·이동수단) → 날짜별 시간표(시각 · 장소 · 머무는 시간 · 판단 · 전화) → 출발 전 전화로 물어볼 것(체크 칸) → 안내.
// 사진·지도·버튼은 넣지 않는다(종이에서는 못 누르고 잉크만 든다). 상태는 색 없이도 읽히게 기호(✓ ! ✕)와 글자로.
import { TRAVELER_LABELS } from "@/lib/engine/conditions";
import { toHHMM } from "@/lib/engine/types";
import { formatDay, formatRange, nightsBetween, tripLabel } from "@/lib/plan/dates";
import { questionsByPlace } from "@/lib/trip/questions";
import type { OptionView, TripView } from "@/lib/trip/view";

const MARK: Record<string, string> = { 적합: "✓ 적합", 주의: "! 주의", "확인 필요": "! 확인 필요", 부적합: "✕ 부적합" };

export function PrintSheet({ trip, o, link }: { trip: TripView; o: OptionView; link?: string }) {
  const { startDate, endDate, travelers, transport } = trip.input;
  const nights = startDate && endDate ? nightsBetween(startDate, endDate) : 0;
  const qs = questionsByPlace(o);
  const calls = o.days.flatMap((d) => d.items.flatMap((i) => (i.kind === "visit" && (qs.get(i.placeId)?.length ?? 0) > 0 ? [i.placeId] : [])));
  const estimated = o.days.some((d) => d.estimated);

  return (
    <article className="print-sheet hidden text-[10.5pt] leading-snug text-black print:block">
      <header className="flex items-end justify-between gap-4 border-b-2 border-black pb-1.5">
        <div>
          <p className="text-[9pt]">이음길 AI · 여행 일정표</p>
          <h1 className="text-[16pt] leading-tight font-bold">{o.title}</h1>
        </div>
        <p className="text-right text-[9.5pt]">
          {startDate && endDate ? formatRange(startDate, endDate) : ""} · {tripLabel(nights)}
          <br />
          {travelers.map((t) => TRAVELER_LABELS[t]).join(" · ")} · {transport === "car" ? "자가용" : "택시"} · {o.stats.places}곳
        </p>
      </header>

      {o.days.map((d, di) => {
        let no = 0;
        return (
          <section key={d.date} className="mt-3 break-inside-avoid">
            <h2 className="text-[11.5pt] font-bold">
              {o.days.length > 1 ? `${di + 1}일째 · ` : ""}
              {formatDay(d.date)} <span className="font-normal">· {d.startName} → {d.endName} · 이동 약 {d.travelMin}분</span>
            </h2>
            <table className="mt-1 w-full border-collapse text-left">
              <thead>
                <tr className="border-y border-black text-[9pt]">
                  <th className="w-[5.6rem] py-0.5 font-bold">시각</th>
                  <th className="py-0.5 font-bold">장소</th>
                  <th className="w-[5.5rem] py-0.5 font-bold">판단</th>
                  <th className="w-[7.5rem] py-0.5 font-bold">전화</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-neutral-300">
                  <td className="py-0.5 tabular-nums">{toHHMM(d.startMin)}</td>
                  <td colSpan={3} className="py-0.5">{d.startName} 출발</td>
                </tr>
                {d.items.map((it, i) => {
                  if (it.kind === "travel") return null;
                  if (it.kind === "visit") {
                    no += 1;
                    const p = trip.places[it.placeId];
                    const j = trip.judgments[it.placeId];
                    const before = d.items[i - 1];
                    return (
                      <tr key={i} className="border-b border-neutral-300 align-top">
                        <td className="py-1 tabular-nums">
                          {toHHMM(it.arriveMin)}~{toHHMM(it.departMin)}
                        </td>
                        <td className="py-1">
                          <span className="font-bold">
                            {no}. {p.name}
                          </span>
                          <span className="text-[9pt]">
                            {" "}
                            · {p.category} · 머무는 {it.stayMin}분{before?.kind === "travel" ? ` · 앞에서 차량 ${before.minutes}분` : ""}
                          </span>
                          {it.why && <span className="block text-[9pt]">{it.why}</span>}
                        </td>
                        <td className="py-1 text-[9.5pt]">{MARK[j.verdict] ?? j.verdict}</td>
                        <td className="py-1 tabular-nums">{p.phone}</td>
                      </tr>
                    );
                  }
                  return (
                    <tr key={i} className="border-b border-neutral-300 text-[9.5pt]">
                      <td className="py-0.5 tabular-nums">
                        {toHHMM(it.startMin)}~{toHHMM(it.endMin)}
                      </td>
                      <td colSpan={3} className="py-0.5">
                        {it.kind === "lunch" ? "점심·휴식" : it.kind === "rest" ? "쉬는 시간" : "문 열 때까지 기다리기"}
                      </td>
                    </tr>
                  );
                })}
                <tr className="border-b border-black">
                  <td className="py-0.5 tabular-nums">약 {toHHMM(arrivalOf(d))}</td>
                  <td colSpan={3} className="py-0.5">{d.endName} 도착</td>
                </tr>
              </tbody>
            </table>
          </section>
        );
      })}

      {calls.length > 0 && (
        <section className="mt-3 break-inside-avoid">
          <h2 className="text-[11.5pt] font-bold">출발 전 전화로 물어볼 것</h2>
          <ul className="mt-1">
            {calls.map((id) => (
              <li key={id} className="flex gap-3 border-b border-neutral-300 py-1">
                <span className="w-[13rem] shrink-0">
                  <span className="font-bold">{trip.places[id].name}</span>
                  <span className="block tabular-nums">☎ {trip.places[id].phone}</span>
                </span>
                <span className="flex-1">{qs.get(id)!.join(" / ")}</span>
                <span className="shrink-0 text-[9.5pt]">□ 괜찮음 □ 어려움</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="mt-3 text-[8.5pt] leading-normal">
        <p>
          시각은 {estimated ? "카카오 차량 길찾기 값(받지 못한 구간은 직선거리 추정)" : "카카오 차량 길찾기 값"}으로 계산한 예상이에요. 경로는 일반 차량 기준이며 휠체어 안전 경로를 뜻하지 않아요.
          접근성 정보는 한국관광공사 무장애 여행정보를 AI가 정리한 것이라 현장과 다를 수 있어요.
        </p>
        {link && <p className="mt-0.5">지도와 함께 보기: {link}</p>}
      </footer>
    </article>
  );
}

function arrivalOf(d: OptionView["days"][number]): number {
  const last = d.items.at(-1);
  return last && last.kind === "travel" ? last.startMin + last.minutes : d.endMin;
}
