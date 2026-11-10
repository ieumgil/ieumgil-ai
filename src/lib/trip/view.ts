// 결과 화면에 넘길 값(JSON으로 직렬화 가능). 서버(/api/plan)가 만들고 화면(/trip/[id])이 그린다.
// 카카오 길찾기 결과는 넣지 않는다(지금은 직선거리 추정만 씀). 개인정보 없음.

import type { Confidence, Verdict } from "../ai/guards";
import type { EvidenceIndex } from "../ai/judge";
import type { TripResult } from "../ai/trip";
import type { DayFit } from "../engine/check";
import type { PlanInput } from "../plan/types";
import type { Category, Place, Region } from "../types";

export const TRIP_VIEW_VERSION = 1;

export type ItemView =
  | { kind: "travel"; toName: string; minutes: number; km: number; estimated: boolean; startMin: number }
  | { kind: "visit"; placeId: string; arriveMin: number; departMin: number; stayMin: number; extraMin: number; why?: string }
  | { kind: "lunch"; startMin: number; endMin: number }
  | { kind: "rest"; startMin: number; endMin: number }
  | { kind: "wait"; startMin: number; endMin: number };

export interface DayView {
  date: string;
  startName: string;
  endName: string;
  startMin: number;
  endMin: number;
  fit: DayFit;
  travelMin: number;
  estimated: boolean;
  items: ItemView[];
}

export interface OptionView {
  id: string;
  strategy: string;
  title: string;
  summary: string;
  source: "ai" | "rule";
  days: DayView[];
  checkBeforeGo: { placeId: string; question: string }[];
  cautions: { placeId: string; text: string }[];
  review?: { fatigue: number; slack: number; taste: number; comment: string };
  fixes: number;
  fixedViolations: string[];
  stats: { places: number; travelMin: number; checkNeeded: number };
}

export interface PlaceView {
  id: string;
  name: string;
  category: Category;
  region: Region;
  phone: string;
  address?: string;
  photo?: { url: string; credit?: string };
  onSite?: string;
}

export interface JudgmentView {
  verdict: Verdict;
  reasons: string[];
  confidence?: Confidence;
  source: "ai" | "rule";
  evidence: { id: string; label: string }[];
}

export interface TripView {
  version: number;
  createdAt: string;
  input: Pick<PlanInput, "startDate" | "endDate" | "travelers" | "transport" | "disabledPermit" | "categories" | "pace" | "lodging">;
  usedFallback: boolean;
  calls: number;
  ms: number;
  notes: string[];
  options: OptionView[];
  places: Record<string, PlaceView>;
  judgments: Record<string, JudgmentView>;
}

export function toTripView(r: TripResult, input: PlanInput, places: Place[], evidence: EvidenceIndex): TripView {
  const byId = new Map(places.map((p) => [p.id, p]));
  const used = new Set<string>();
  const judgments: Record<string, JudgmentView> = {};
  const verdictOf = (id: string): Verdict | undefined => r.judge?.judgments.get(id)?.verdict ?? r.rule.filter.candidates.find((c) => c.place.id === id)?.rule;

  const options: OptionView[] = r.options.map((o) => {
    const review = r.reviews.find((x) => x.optionId === o.id);
    const days: DayView[] = o.check.timelines.map((tl, i) => {
      const frame = r.rule.frames[i];
      const whyOf = new Map(o.draft.days[i].stops.map((s) => [s.placeId, s.why]));
      return {
        date: tl.date,
        startName: frame.start.name,
        endName: frame.end.name,
        startMin: frame.startMin,
        endMin: frame.endMin,
        fit: o.check.fits[i],
        travelMin: tl.travelMin,
        estimated: tl.estimatedTravel,
        items: tl.items.map((it): ItemView => {
          if (it.kind === "travel") return { kind: "travel", toName: it.to.name, minutes: it.leg.minutes, km: it.leg.km, estimated: it.leg.estimated, startMin: it.startMin };
          if (it.kind === "visit") {
            used.add(it.placeId);
            return { kind: "visit", placeId: it.placeId, arriveMin: it.arriveMin, departMin: it.departMin, stayMin: it.stayMin, extraMin: it.extraMin, why: whyOf.get(it.placeId) };
          }
          if (it.kind === "lunch") return { kind: "lunch", startMin: it.startMin, endMin: it.endMin };
          if (it.kind === "rest") return { kind: "rest", startMin: it.startMin, endMin: it.endMin };
          return { kind: "wait", startMin: it.startMin, endMin: it.endMin };
        }),
      };
    });
    const ids = o.draft.days.flatMap((d) => d.stops.map((s) => s.placeId));
    // 규칙 일정은 LLM 질문이 없으므로 '모름' 항목 질문을 붙인다
    const questions = o.checkBeforeGo.length
      ? o.checkBeforeGo
      : ids.flatMap((id) => (r.rule.filter.candidates.find((c) => c.place.id === id)?.floor.asks ?? []).map((question) => ({ placeId: id, question })));
    return {
      id: o.id,
      strategy: o.strategy,
      title: o.title,
      summary: o.summary,
      source: o.source,
      days,
      checkBeforeGo: questions,
      cautions: o.cautions,
      review: review && { fatigue: review.fatigue, slack: review.slack, taste: review.taste, comment: review.comment },
      fixes: o.fixes,
      fixedViolations: o.fixedViolations,
      stats: { places: ids.length, travelMin: days.reduce((a, d) => a + d.travelMin, 0), checkNeeded: ids.filter((id) => verdictOf(id) === "확인 필요").length },
    };
  });

  const placeViews: Record<string, PlaceView> = {};
  for (const id of used) {
    const p = byId.get(id)!;
    const labels = new Map((evidence[id] ?? []).map((e) => [e.id, e.label]));
    const j = r.judge?.judgments.get(id);
    const v = verdictOf(id)!;
    judgments[id] = {
      verdict: v,
      reasons: j?.reasons ?? [],
      confidence: j?.confidence,
      source: j?.source ?? "rule",
      evidence: (j?.evidence ?? []).map((e) => ({ id: e, label: labels.get(e) ?? e })),
    };
    placeViews[id] = {
      id,
      name: p.name_ko,
      category: p.category,
      region: p.region,
      phone: p.phone,
      address: p.address,
      photo: p.photos?.[0] && { url: p.photos[0].url, credit: p.photos[0].credit },
      onSite: p.on_site?.text,
    };
  }

  return {
    version: TRIP_VIEW_VERSION,
    createdAt: new Date().toISOString(),
    input: { startDate: input.startDate, endDate: input.endDate, travelers: input.travelers, transport: input.transport, disabledPermit: input.disabledPermit, categories: input.categories, pace: input.pace, lodging: input.lodging },
    usedFallback: r.usedFallback,
    calls: r.calls,
    ms: r.ms,
    notes: r.rule.notes.filter((n) => n.startsWith("꼭 가고 싶은 곳") || n.includes("숙소")),
    options,
    places: placeViews,
    judgments,
  };
}
