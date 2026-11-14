// 결과 화면에 넘길 값(JSON으로 직렬화 가능). 서버(/api/plan)가 만들고 화면(/trip/[id])이 그린다.
// 카카오 길찾기 결과는 넣지 않는다(탭에 보관하는 시각은 직선거리 추정, 화면은 열 때 real-travel.ts로 실제 값을 받아 다시 계산). 개인정보 없음.
// 장소 바꾸기(대체 후보)는 화면에서 코드로 다시 계산한다 → 그때 필요한 하루 틀·장소 정보·초안도 함께 싣는다.

import type { Confidence, Verdict } from "../ai/guards";
import type { EvidenceIndex } from "../ai/judge";
import type { TripResult } from "../ai/trip";
import type { DayFit } from "../engine/check";
import type { DayTimeline } from "../engine/timeline";
import type { DayFrame, PlanDayDraft, PlanDraft } from "../engine/types";
import type { PlanInput } from "../plan/types";
import type { Category, Place, Region } from "../types";
import { pickAlternatives, type PoolPlace } from "./alternatives";

export const TRIP_VIEW_VERSION = 2;

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
  /** 실제 이동시간(카카오)으로 다시 계산했더니 넘치는 경우 그 내용(화면 메모리에서만, 저장 안 함) */
  realIssue?: string;
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
  /** 장소·순서·체류(시각 없음). 바꾸기 후 다시 계산할 때 쓴다 */
  draft: PlanDraft;
  /** 장소 id → 바꿀 수 있는 후보 id(최대 3) */
  alternatives: Record<string, string[]>;
  /** 바꾼 장소: 새 id → 원래 id (사용자가 바꿨을 때만) */
  swapped?: Record<string, string>;
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
  input: Pick<PlanInput, "startDate" | "endDate" | "travelers" | "transport" | "disabledPermit" | "categories" | "pace" | "lodging"> & Partial<Pick<PlanInput, "lodging2">>;
  usedFallback: boolean;
  calls: number;
  ms: number;
  notes: string[];
  /** 안을 하나만 만든 이유(2박 3일 등). 있으면 결과 위에 안내로 보여준다 */
  oneOption?: string;
  options: OptionView[];
  places: Record<string, PlaceView>;
  judgments: Record<string, JudgmentView>;
  /** 날짜마다 시작·끝 지점과 시각(다시 계산용) */
  frames: DayFrame[];
  /** 일정·후보 장소의 원본 정보(다시 계산용: 좌표·운영시간·체류 범위) */
  placeData: Record<string, Place>;
  /** 장소별 '모름' 항목 질문(코드 안전 하한). 바꾼 장소의 출발 전 확인에 쓴다 */
  asks: Record<string, string[]>;
  /** 장소별 공식 정보가 없는 필수 항목(access 키 또는 walk_distance). '확인 필요'의 이유로 보여준다 */
  unknowns?: Record<string, string[]>;
}

/** 계산된 하루 일정 → 화면 값 */
export function toDayView(tl: DayTimeline, frame: DayFrame, fit: DayFit, day: PlanDayDraft): DayView {
  const whyOf = new Map(day.stops.map((s) => [s.placeId, s.why]));
  return {
    date: tl.date,
    startName: frame.start.name,
    endName: frame.end.name,
    startMin: frame.startMin,
    endMin: frame.endMin,
    fit,
    travelMin: tl.travelMin,
    estimated: tl.estimatedTravel,
    items: tl.items.map((it): ItemView => {
      if (it.kind === "travel") return { kind: "travel", toName: it.to.name, minutes: it.leg.minutes, km: it.leg.km, estimated: it.leg.estimated, startMin: it.startMin };
      if (it.kind === "visit") return { kind: "visit", placeId: it.placeId, arriveMin: it.arriveMin, departMin: it.departMin, stayMin: it.stayMin, extraMin: it.extraMin, why: whyOf.get(it.placeId) };
      if (it.kind === "lunch") return { kind: "lunch", startMin: it.startMin, endMin: it.endMin };
      if (it.kind === "rest") return { kind: "rest", startMin: it.startMin, endMin: it.endMin };
      return { kind: "wait", startMin: it.startMin, endMin: it.endMin };
    }),
  };
}

export function toTripView(r: TripResult, input: PlanInput, places: Place[], evidence: EvidenceIndex): TripView {
  const byId = new Map(places.map((p) => [p.id, p]));
  const used = new Set<string>();
  const judgments: Record<string, JudgmentView> = {};
  const verdictOf = (id: string): Verdict | undefined => r.judge?.judgments.get(id)?.verdict ?? r.rule.filter.candidates.find((c) => c.place.id === id)?.rule;

  // 대체 후보: AI가 판단한 후보(실패했으면 규칙 판단) 중 부적합이 아닌 곳
  const pool: PoolPlace[] = r.llmCandidates.flatMap((c) => {
    const v = verdictOf(c.place.id);
    return v && v !== "부적합" ? [{ place: c.place, verdict: v }] : [];
  });
  const floorOf = (id: string) => r.rule.filter.candidates.find((c) => c.place.id === id)?.floor;
  const asksOf = (id: string) => floorOf(id)?.asks ?? [];

  const options: OptionView[] = r.options.map((o) => {
    const review = r.reviews.find((x) => x.optionId === o.id);
    const days: DayView[] = o.check.timelines.map((tl, i) => toDayView(tl, r.rule.frames[i], o.check.fits[i], o.draft.days[i]));
    const alternatives = pickAlternatives(o.draft, pool, byId);
    o.draft.days.forEach((d) => d.stops.forEach((st) => used.add(st.placeId)));
    Object.values(alternatives).flat().forEach((id) => used.add(id));
    const ids = o.draft.days.flatMap((d) => d.stops.map((s) => s.placeId));
    // 규칙 일정은 LLM 질문이 없으므로 '모름' 항목 질문을 붙인다
    const questions = o.checkBeforeGo.length
      ? o.checkBeforeGo
      : ids.flatMap((id) => asksOf(id).map((question) => ({ placeId: id, question })));
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
      draft: o.draft,
      alternatives,
    };
  });

  const placeViews: Record<string, PlaceView> = {};
  const placeData: Record<string, Place> = {};
  const asks: Record<string, string[]> = {};
  const unknowns: Record<string, string[]> = {};
  for (const id of used) {
    placeData[id] = byId.get(id)!;
    asks[id] = asksOf(id);
    unknowns[id] = floorOf(id)?.unknown ?? [];
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
    input: { startDate: input.startDate, endDate: input.endDate, travelers: input.travelers, transport: input.transport, disabledPermit: input.disabledPermit, categories: input.categories, pace: input.pace, lodging: input.lodging, lodging2: input.lodging2 },
    usedFallback: r.usedFallback,
    calls: r.calls,
    ms: r.ms,
    notes: r.rule.notes.filter((n) => n.startsWith("꼭 가고 싶은 곳") || n.includes("숙소")),
    ...(r.oneOption ? { oneOption: r.oneOption } : {}),
    options,
    places: placeViews,
    judgments,
    frames: r.rule.frames,
    placeData,
    asks,
    unknowns,
  };
}
