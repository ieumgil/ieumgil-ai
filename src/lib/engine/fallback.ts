// 규칙 일정(코드만). LLM이 실패하면 이 일정 1안을 보여주고, AI 일정의 비교 기준으로도 쓴다.
// 1) 후보 거르기 2) 날마다 개수 정하기(반나절 2~3, 하루 3~5, 밀도로 조절) 3) 그날 출발점에서 가까운 순으로 고르기
// 4) 5곳 이하라 순서를 모두 따져(최대 120가지) 이동이 가장 짧고 검사를 통과하는 순서 5) 그래도 위반이면 한 곳씩 줄이기

import type { PlanInput } from "../plan/types";
import type { Place } from "../types";
import { checkPlan, type CheckResult } from "./check";
import { filterCandidates, type Candidate, type FilterResult } from "./filter";
import { buildFrames } from "./frames";
import { haversineKm } from "./travel";
import { timelineOptions } from "./timeline";
import type { DayFrame, PlanDayDraft, PlanDraft, Point, TravelFn } from "./types";

export interface RulePlan {
  draft: PlanDraft;
  frames: DayFrame[];
  filter: FilterResult;
  check: CheckResult;
  /** 화면에 보여줄 안내(상한 축소, 숙소 가정 등) */
  notes: string[];
}

/** 날마다 몇 곳: 쓸 수 있는 시간 5시간 미만이면 반나절 */
export function targetCount(availableMin: number, pace: PlanInput["pace"]): number {
  const half = availableMin < 5 * 60;
  const table = half ? { slow: 2, normal: 2, busy: 3 } : { slow: 3, normal: 4, busy: 5 };
  return table[pace];
}

const midStay = (p: Place) => Math.round((p.stay_min + p.stay_max) / 2 / 5) * 5;

function permutations<T>(xs: T[]): T[][] {
  if (xs.length <= 1) return [xs];
  return xs.flatMap((x, i) => permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map((rest) => [x, ...rest]));
}

export function rulePlan(input: PlanInput, places: Place[], travel: TravelFn): RulePlan {
  const notes: string[] = [];
  const built = buildFrames(input);
  let frames = built.frames;
  const lodgingAssumed = built.lodgingAssumed;
  const dates = frames.map((f) => f.date);
  // 규칙 일정은 제외되지 않은 곳을 모두 본다(20곳 제한은 LLM에 넘길 때만)
  const filter = filterCandidates(places, input, dates, frames[0].start, Infinity);
  const placesById = new Map(places.map((p) => [p.id, p]));
  const options = timelineOptions(input);
  const used = new Set<string>();
  const days: PlanDayDraft[] = [];

  for (const ex of filter.excluded.filter((e) => e.mustVisit)) {
    notes.push(`꼭 가고 싶은 곳 '${ex.place.name_ko}'는 조건에 맞지 않아 뺐어요: ${ex.reasons.join(", ")}`);
  }

  for (let di = 0; di < frames.length; di++) {
    const frame = frames[di];
    const available = frame.endMin - frame.startMin;
    const want = targetCount(available, input.pace);
    // 확인 필요는 감점(-6), 그날 출발점에서 멀수록 감점(km/2): 멀리 떨어진 적합 1곳보다 가까운 곳들을 묶는다
    const near = (c: Candidate, from: Point) => c.score - c.tier * 6 - haversineKm(from, c.place) / 2;
    const pool = filter.candidates
      .filter((c) => !used.has(c.place.id) && c.openDates.includes(frame.date))
      .sort((a, b) => Number(b.mustVisit) - Number(a.mustVisit) || near(b, frame.start) - near(a, frame.start));

    let picked = pool.slice(0, want);
    if (picked.length < want) notes.push(`${di + 1}일째는 조건에 맞는 곳이 적어 ${picked.length}곳으로 줄였어요`);

    let best: PlanDayDraft = { date: frame.date, stops: [] };
    while (picked.length > 0) {
      let bestCost = Infinity;
      let bestOk = false;
      for (const order of permutations(picked)) {
        const day: PlanDayDraft = { date: frame.date, stops: order.map((c) => ({ placeId: c.place.id, stayMin: midStay(c.place) })) };
        const r = checkPlan({ days: [day] }, { frames: [frame], placesById, travel, options });
        const cost = r.timelines[0].travelMin + r.violations.length * 1000;
        if (cost < bestCost) {
          bestCost = cost;
          best = day;
          bestOk = r.ok;
        }
      }
      if (bestOk) break;
      // 위반이 남으면 점수가 가장 낮은 곳(꼭 가고 싶은 곳 제외)을 빼고 다시
      const drop = [...picked].reverse().find((c) => !c.mustVisit) ?? picked[picked.length - 1];
      picked = picked.filter((c) => c !== drop);
      best = { date: frame.date, stops: [] };
      notes.push(`${di + 1}일째는 시간이 모자라 '${drop.place.name_ko}'를 뺐어요`);
    }
    best.stops.forEach((s) => used.add(s.placeId));
    days.push(best);

    // 숙소 미정: 첫날 마지막 장소 근처를 숙소로 가정하고 다음 날부터 그곳에서 출발
    if (di === 0 && lodgingAssumed && frames.length > 1) {
      const last = best.stops.at(-1);
      const lp = last && placesById.get(last.placeId);
      if (lp) {
        const lodging: Point = { id: "lodging-assumed", name: `${lp.name_ko} 근처 숙소(가정)`, lat: lp.lat, lng: lp.lng };
        frames = buildFrames(input, lodging).frames;
        notes.push(`숙소가 미정이라 첫날 마지막 장소(${lp.name_ko}) 근처를 숙소로 가정했어요`);
      }
    }
  }

  const draft = { days };
  const check = checkPlan(draft, {
    frames,
    placesById,
    travel,
    options,
    candidateIds: new Set(filter.candidates.map((c) => c.place.id)),
    verdicts: new Map(filter.candidates.map((c) => [c.place.id, c.rule])),
  });
  return { draft, frames, filter, check, notes };
}
