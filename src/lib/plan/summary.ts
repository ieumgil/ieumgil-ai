// 입력 단계 요약(PC 오른쪽 '고른 조건' 카드): 단계별로 고른 값을 짧은 줄로.
import { CONDITION_LABELS, conditionRows, TRAVELER_LABELS } from "../engine/conditions";
import { formatRange, tripLabel } from "./dates";
import { nightsOf } from "./progress";
import { ARRIVAL_POINTS, type Pace, type PlanInput } from "./types";

export const PACE_LABEL: Record<Pace, string> = { slow: "여유롭게", normal: "보통", busy: "많이" };

/** 단계별 요약 줄. 아직 고르지 않았으면 빈 배열 */
export function summaryLines(p: PlanInput): string[][] {
  const nights = nightsOf(p);
  const when = [
    p.startDate && p.endDate && nights !== null ? `${formatRange(p.startDate, p.endDate)} · ${tripLabel(nights)}` : "",
    p.arrival ? `${ARRIVAL_POINTS.find((a) => a.id === p.arrival)?.label} 도착 · ${p.startTime}~${p.endTime}` : "",
    p.transport ? (p.transport === "car" ? `자가용${p.disabledPermit ? " · 장애인 표지" : ""}` : "택시") : "",
    nights && p.lodging ? `숙소 ${p.lodging}` : "",
  ].filter(Boolean);
  const who = p.travelers.map((t) => TRAVELER_LABELS[t]);
  const rows = conditionRows(p);
  const on = rows.must.filter((r) => r.on).map((r) => CONDITION_LABELS[r.key]);
  const conditions =
    p.travelers.length === 0
      ? []
      : [on.length ? on.join(" · ") : "꼭 필요한 조건 없음", ...(rows.showWalkLimit ? [`한 번에 걷기 ${p.walkLimit ? `${p.walkLimit}m` : "제한 없음"}`] : [])];
  const taste = p.categories.length
    ? [p.categories.join(" · "), `일정 ${PACE_LABEL[p.pace]}`, ...(p.mustVisit.length ? [`꼭 갈 곳 ${p.mustVisit.length}곳`] : [])]
    : [];
  return [when, who, conditions, taste];
}
