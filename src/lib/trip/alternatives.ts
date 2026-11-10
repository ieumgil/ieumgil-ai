// 대체 후보 고르기(코드). 일정을 만들 때 AI가 이미 판단한 후보 중, 그 안에 안 들어간 곳을 장소마다 몇 개 골라 둔다.
// AI를 다시 부르지 않는다. 이유 문구는 ② 판단 때 쓴 이유를 그대로 쓴다(11/10 결정).
// 순서: 판단이 좋은 곳(적합 → 주의 → 확인 필요) + 바꿀 장소와 가까운 곳. 부적합·그날 휴무·이미 일정에 있는 곳은 뺀다.

import type { Verdict } from "../ai/guards";
import { closedOn } from "../engine/closed";
import { haversineKm } from "../engine/travel";
import type { PlanDraft } from "../engine/types";
import type { Place } from "../types";

export interface PoolPlace {
  place: Place;
  verdict: Verdict;
}

const RANK: Partial<Record<Verdict, number>> = { 적합: 0, 주의: 1, "확인 필요": 2 };
/** 판단 한 단계 차이를 거리 몇 km로 칠지 */
const RANK_KM = 6;

export function pickAlternatives(
  draft: PlanDraft,
  pool: PoolPlace[],
  placesById: Map<string, Place>,
  { max = 3, maxKm = 25 }: { max?: number; maxKm?: number } = {},
): Record<string, string[]> {
  const used = new Set(draft.days.flatMap((d) => d.stops.map((s) => s.placeId)));
  const out: Record<string, string[]> = {};
  for (const day of draft.days) {
    for (const stop of day.stops) {
      const from = placesById.get(stop.placeId);
      if (!from) continue;
      out[stop.placeId] = pool
        .filter((c) => RANK[c.verdict] !== undefined && !used.has(c.place.id) && !closedOn(c.place.hours, day.date).closed)
        .map((c) => ({ id: c.place.id, km: haversineKm(from, c.place), rank: RANK[c.verdict]! }))
        .filter((c) => c.km <= maxKm)
        .sort((a, b) => a.rank * RANK_KM + a.km - (b.rank * RANK_KM + b.km))
        .slice(0, max)
        .map((c) => c.id);
    }
  }
  return out;
}
