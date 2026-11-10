// 후보 거르기(코드). LLM에 넘기기 전에 갈 수 없는 곳을 뺀다.
// - 안전 하한이 '부적합'(필수 조건 '불가', 걸을 거리 초과)인 곳 → 제외
// - 여행 날짜에 모두 휴무인 곳 → 제외
// - '확인 필요'는 빼지 않고 뒤 순위로 둔다(11/10 결정: 일정에 넣되 표시)
// 순위: 적합·주의 먼저 → 꼭 가고 싶은 곳 → 취향 → 선호 조건 → 출발점과 가까운 곳

import { safetyFloor, type Floor } from "../ai/guards";
import type { PlanInput } from "../plan/types";
import type { Place } from "../types";
import { closedOn } from "./closed";
import { resolveConditions, type ResolvedConditions } from "./conditions";
import { haversineKm } from "./travel";
import type { Point } from "./types";

export interface Candidate {
  place: Place;
  floor: Floor;
  /** 0 = 적합·주의, 1 = 확인 필요 */
  tier: 0 | 1;
  score: number;
  mustVisit: boolean;
  /** 이 날짜들에 연다 */
  openDates: string[];
  warnings: string[];
}

export interface Excluded {
  place: Place;
  reasons: string[];
  mustVisit: boolean;
}

export interface FilterResult {
  conditions: ResolvedConditions;
  candidates: Candidate[];
  excluded: Excluded[];
}

export function filterCandidates(
  places: Place[],
  input: PlanInput,
  dates: string[],
  origin: Point,
  max = 20,
): FilterResult {
  const conditions = resolveConditions(input);
  const candidates: Candidate[] = [];
  const excluded: Excluded[] = [];

  for (const place of places) {
    const mustVisit = input.mustVisit.includes(place.id);
    const floor = safetyFloor(place, conditions);
    if (floor.verdict === "부적합") {
      excluded.push({ place, reasons: floor.reasons, mustVisit });
      continue;
    }
    const status = dates.map((d) => ({ d, c: closedOn(place.hours, d) }));
    const openDates = status.filter((s) => !s.c.closed).map((s) => s.d);
    if (openDates.length === 0) {
      excluded.push({ place, reasons: [`여행 날짜에 쉬어요(${status[0].c.reason})`], mustVisit });
      continue;
    }
    const warnings: string[] = [];
    const unknown = [...new Set(status.flatMap((s) => s.c.unknown))];
    if (unknown.length) warnings.push(`휴무일 확인 필요: ${unknown.join(", ")}`);
    if (!place.hours.always_open && !place.hours.summer && !place.hours.winter) warnings.push("운영시간 확인 필요");

    const preferMet = conditions.prefer.filter((k) => place.access[k].value === "가능").length;
    const km = haversineKm(origin, place);
    const score =
      (mustVisit ? 100 : 0) +
      (input.categories.includes(place.category) ? 5 : 0) +
      preferMet +
      (floor.verdict === "주의" ? -1 : 0) -
      km / 10;
    candidates.push({ place, floor, tier: floor.verdict === "확인 필요" ? 1 : 0, score, mustVisit, openDates, warnings });
  }

  candidates.sort((a, b) => Number(b.mustVisit) - Number(a.mustVisit) || a.tier - b.tier || b.score - a.score);
  const kept = candidates.filter((c, i) => c.mustVisit || i < max);
  return { conditions, candidates: kept, excluded };
}
