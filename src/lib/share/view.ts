// 공유 링크를 열 때(서버): 저장된 안(장소·순서·체류·이유)을 확정 화면 값(TripView, 안 1개)으로 바꾼다.
// 시각은 코드가 다시 계산한다(직선 추정 → 화면이 열리면 /api/legs로 카카오 실제 값을 받아 메모리에서만 다시 계산).
// 장소 이름·전화·사진·좌표는 저장값이 아니라 지금의 관광지 데이터에서 붙인다. 데이터에 없어진 장소는 뺀다.

import { checkPlan } from "../engine/check";
import { timelineOptions } from "../engine/timeline";
import { estimateLeg } from "../engine/travel";
import type { PlanDraft } from "../engine/types";
import type { Place } from "../types";
import { toDayView, toPlaceView, TRIP_VIEW_VERSION, type JudgmentView, type OptionView, type PlaceView, type TripView } from "../trip/view";
import type { ShareDoc } from "./doc";

export function shareToTripView(doc: ShareDoc, id: string, places: Place[]): TripView {
  const byId = new Map(places.map((p) => [p.id, p]));
  const draft: PlanDraft = {
    days: doc.option.draft.days.map((d) => ({ ...d, stops: d.stops.filter((s) => byId.has(s.placeId)) })),
  };
  const ids = draft.days.flatMap((d) => d.stops.map((s) => s.placeId));
  const inPlan = new Set(ids);
  const swappedFrom = Object.values(doc.option.swapped ?? {}).filter((x) => byId.has(x));

  const placeData: Record<string, Place> = {};
  const placeViews: Record<string, PlaceView> = {};
  for (const pid of [...ids, ...swappedFrom]) {
    placeData[pid] = byId.get(pid)!;
    placeViews[pid] = toPlaceView(byId.get(pid)!);
  }
  const judgments: Record<string, JudgmentView> = {};
  for (const pid of ids) {
    const j = doc.judgments[pid];
    judgments[pid] = { verdict: j?.verdict ?? "확인 필요", reasons: j?.reasons ?? [], source: "ai", evidence: [] };
  }

  // 검사에 걸려도(예: 그사이 운영시간 데이터가 바뀜) 보여 주기는 한다 — 시각은 계산한 그대로
  const check = checkPlan(draft, { frames: doc.frames, placesById: byId, travel: estimateLeg, options: timelineOptions(doc.input) });
  const days = check.timelines.map((tl, i) => toDayView(tl, doc.frames[i], check.fits[i] ?? "여유", draft.days[i]));
  const option: OptionView = {
    id: doc.option.id,
    strategy: (doc.option.strategy ?? "여유") as OptionView["strategy"],
    title: doc.option.title,
    summary: doc.option.summary,
    source: "ai",
    days,
    checkBeforeGo: doc.option.checkBeforeGo.filter((q) => inPlan.has(q.placeId)),
    cautions: doc.option.cautions.filter((c) => inPlan.has(c.placeId)),
    fixes: 0,
    fixedViolations: [],
    stats: { places: ids.length, travelMin: days.reduce((a, d) => a + d.travelMin, 0), checkNeeded: ids.filter((x) => judgments[x].verdict === "확인 필요").length },
    draft,
    alternatives: {},
    ...(doc.option.swapped ? { swapped: doc.option.swapped } : {}),
  };

  return {
    version: TRIP_VIEW_VERSION,
    createdAt: `share-${id}`,
    input: doc.input,
    usedFallback: false,
    calls: 0,
    ms: 0,
    notes: [],
    options: [option],
    places: placeViews,
    judgments,
    frames: doc.frames,
    placeData,
    asks: {},
    unknowns: {},
  };
}
