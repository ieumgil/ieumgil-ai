// 장소 바꾸기(화면에서 바로, AI·서버 호출 없음). 바꾼 뒤 시각은 코드가 다시 계산하고 검사한다.
// 검사(운영시간·휴무·하루 범위·중복)를 통과하지 못하면 바꾸지 않고 이유를 돌려준다.

import { checkPlan } from "../engine/check";
import { timelineOptions } from "../engine/timeline";
import { estimateLeg } from "../engine/travel";
import type { PlanDraft } from "../engine/types";
import { toDayView, type OptionView, type TripView } from "./view";

export type SwapResult = { ok: true; option: OptionView } | { ok: false; reason: string };

/** option(지금 화면의 안)에서 fromId를 toId로 바꾼다. 원래 안(trip.options)의 이유·질문·주의는 되돌릴 때 다시 쓴다 */
export function swapPlace(trip: TripView, option: OptionView, fromId: string, toId: string): SwapResult {
  const original = trip.options.find((o) => o.id === option.id) ?? option;
  const to = trip.placeData[toId];
  if (!to) return { ok: false, reason: "이 장소 정보를 찾지 못했어요" };
  const has = (id: string) => option.draft.days.some((d) => d.stops.some((s) => s.placeId === id));
  if (!has(fromId)) return { ok: false, reason: "바꿀 장소를 찾지 못했어요" };
  if (has(toId)) return { ok: false, reason: `${to.name_ko}는 이미 이 일정에 있어요` };

  // 원래 일정에 있던 곳으로 되돌리면 그때의 체류·이유를 그대로 쓴다
  const originalStop = original.draft.days.flatMap((d) => d.stops).find((s) => s.placeId === toId);
  const draft: PlanDraft = {
    days: option.draft.days.map((d) => ({
      ...d,
      stops: d.stops.map((s) =>
        s.placeId !== fromId
          ? s
          : (originalStop ?? { placeId: toId, stayMin: Math.min(Math.max(s.stayMin, to.stay_min), to.stay_max), restAfter: s.restAfter }),
      ),
    })),
  };

  const placesById = new Map(Object.entries(trip.placeData));
  const verdicts = new Map(Object.entries(trip.judgments).map(([id, j]) => [id, j.verdict]));
  const check = checkPlan(draft, { frames: trip.frames, placesById, travel: estimateLeg, options: timelineOptions(trip.input), verdicts });
  if (!check.ok) return { ok: false, reason: check.violations[0].message };

  // 바꾼 표시: 새 id → 맨 처음 장소 id. 원래 장소로 돌아오면 표시를 지운다
  const swapped = { ...(option.swapped ?? {}) };
  const firstId = swapped[fromId] ?? fromId;
  delete swapped[fromId];
  if (firstId !== toId) swapped[toId] = firstId;

  const ids = draft.days.flatMap((d) => d.stops.map((s) => s.placeId));
  const originalQs = (id: string) => original.checkBeforeGo.filter((q) => q.placeId === id);
  const questionsOf = (id: string) => {
    const qs = originalQs(id);
    return qs.length ? qs : (trip.asks[id] ?? []).map((question) => ({ placeId: id, question }));
  };
  const days = check.timelines.map((tl, i) => toDayView(tl, trip.frames[i], check.fits[i], draft.days[i]));
  return {
    ok: true,
    option: {
      ...option,
      draft,
      days,
      swapped,
      checkBeforeGo: ids.flatMap(questionsOf),
      cautions: original.cautions.filter((c) => ids.includes(c.placeId)),
      stats: { places: ids.length, travelMin: days.reduce((a, d) => a + d.travelMin, 0), checkNeeded: ids.filter((id) => trip.judgments[id]?.verdict === "확인 필요").length },
    },
  };
}

/** 이 장소(지금 일정에 있는 id)의 대체 후보: 맨 처음 장소의 후보 + (바꾼 상태면) 원래 장소. 일정에 이미 있는 곳은 뺀다 */
export function alternativesFor(option: OptionView, placeId: string): string[] {
  const firstId = option.swapped?.[placeId] ?? placeId;
  const inOption = new Set(option.draft.days.flatMap((d) => d.stops.map((s) => s.placeId)));
  const list = [...(firstId !== placeId ? [firstId] : []), ...(option.alternatives[firstId] ?? [])];
  return [...new Set(list)].filter((id) => !inOption.has(id));
}
