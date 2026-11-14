// LLM 판단에 코드가 강제하는 선(docs/ai-plan.md v3 원칙 1, 11/10 개정).
// 질문은 "이 사람이 여기서 관광할 수 있나" 하나다. 항목 하나가 '모름'이라고 막지 않고 LLM이 근거를 모아 판단한다.
// - 안전 하한(safetyFloor, LLM 판단에 적용): 필수 '불가' → 부적합, '부분가능' → 최소 주의, 걸을 거리가 알려져 있고 넘으면 부적합.
//   휠체어처럼 진입이 필수인데 "들어갈 수 있다"는 원문(진입 가능/부분가능)조차 없으면 확인 필요.
//   그 밖의 '모름'은 판단을 막지 않고 출발 전에 물어볼 질문(asks)으로 붙인다.
// - LLM은 하한보다 더 보수적으로만 바꿀 수 있다.
// - 근거 id가 비었거나 넘겨준 목록 밖이면 LLM 판단을 버리고 규칙 판단(ruleJudgment, 엄격)을 쓴다.
//   규칙 판단은 아무도 장소 전체를 보지 않았으므로 필수 항목이 하나라도 '모름'이면 확인 필요다.

import { CONDITION_LABELS, type ResolvedConditions } from "../engine/conditions";
import type { AccessKey, Place } from "../types";

export const VERDICTS = ["적합", "주의", "확인 필요", "부적합"] as const;
export type Verdict = (typeof VERDICTS)[number];
export type Confidence = "높음" | "보통" | "낮음";

/** 클수록 보수적 */
const RANK: Record<Verdict, number> = { 적합: 0, 주의: 1, "확인 필요": 2, 부적합: 3 };
export const moreConservative = (a: Verdict, b: Verdict): Verdict => (RANK[a] >= RANK[b] ? a : b);

export interface Floor {
  verdict: Verdict;
  /** 하한을 만든 항목(가장 엄격한 단계의 항목만) */
  keys: (AccessKey | "walk_distance")[];
  /** '모름'인 필수 항목·걷는 거리의 질문(출발 전 확인할 것) */
  asks: string[];
  /** '모름'인 필수 항목(규칙 판단과 화면 표시용) */
  unknown: (AccessKey | "walk_distance")[];
  /** 규칙으로 만든 이유 문장 */
  reasons: string[];
}

const WALK_ASK = "주차장에서 입구까지, 그리고 한 바퀴 둘러보는 길은 걸어서 대략 몇 분(몇 m) 걸리나요?";

/** 이 사람 조건으로 이 장소가 최소 어디까지 보수적이어야 하는지(LLM 판단에 적용하는 하한) */
export function safetyFloor(place: Place, cond: ResolvedConditions): Floor {
  const hits: { verdict: Verdict; key: Floor["keys"][number]; reason: string }[] = [];
  const asks: string[] = [];
  const unknown: Floor["unknown"] = [];

  for (const key of cond.must) {
    const a = place.access[key];
    const label = CONDITION_LABELS[key];
    if (a.value === "불가") hits.push({ verdict: "부적합", key, reason: `${label}: 어려워요` });
    else if (a.value === "모름") {
      unknown.push(key);
      if (a.ask) asks.push(a.ask);
      // 진입은 최소 근거: 들어갈 수 있다는 원문이 없으면 적합이 될 수 없다
      if (key === "step_free_entrance") hits.push({ verdict: "확인 필요", key, reason: `${label}: 들어갈 수 있다는 공식 정보가 없어요` });
    } else if (a.value === "부분가능") hits.push({ verdict: "주의", key, reason: `${label}: ${a.note ?? "일부만 가능해요"}` });
  }
  for (const key of cond.caution) {
    const a = place.access[key];
    if (a.value === "불가" || a.value === "부분가능") {
      hits.push({ verdict: "주의", key, reason: `${CONDITION_LABELS[key]}: ${a.note ?? (a.value === "불가" ? "어려워요" : "일부만 가능해요")}` });
    }
  }

  if (cond.walkLimitM !== null) {
    const limit = cond.walkLimitM;
    const distances = [place.parking_to_entrance?.meters, place.route_length?.meters];
    const over = distances.filter((m): m is number => m !== undefined && m > limit);
    if (over.length > 0) {
      hits.push({ verdict: "부적합", key: "walk_distance", reason: `걷는 거리: 약 ${Math.max(...over)}m로 ${limit}m를 넘어요` });
    } else if (distances.some((m) => m === undefined)) {
      unknown.push("walk_distance");
      asks.push(WALK_ASK);
    }
  }

  if (hits.length === 0) return { verdict: "적합", keys: [], asks, unknown, reasons: [] };
  const top = hits.reduce((v, h) => moreConservative(v, h.verdict), "적합" as Verdict);
  const atTop = hits.filter((h) => h.verdict === top);
  return { verdict: top, keys: atTop.map((h) => h.key), asks, unknown, reasons: atTop.map((h) => h.reason) };
}

/** LLM이 낸 판단(스키마 검사를 통과한 원본) */
export interface RawJudgment {
  placeId: string;
  verdict: Verdict;
  reasons: string[];
  evidence: string[];
}

export interface Judgment {
  placeId: string;
  verdict: Verdict;
  reasons: string[];
  evidence: string[];
  /** ai = LLM 판단을 썼음, rule = 근거가 없어 규칙 판단으로 대체 */
  source: "ai" | "rule";
  /** 하한 때문에 LLM 판단보다 보수적으로 바뀌었는지 */
  floorApplied: boolean;
  /** 출발 전에 물어볼 질문 */
  checkBeforeGo: string[];
  confidence?: Confidence;
}

/** 규칙만으로 만든 판단(LLM 실패·근거 없음일 때). 장소 전체를 본 판단이 아니므로 필수 '모름'이 있으면 확인 필요 */
export function ruleJudgment(place: Place, cond: ResolvedConditions): Judgment {
  const floor = safetyFloor(place, cond);
  const strict = floor.unknown.length > 0 ? moreConservative(floor.verdict, "확인 필요") : floor.verdict;
  const unknownReason = floor.unknown.length > 0 && strict === "확인 필요" && floor.verdict !== "확인 필요"
    ? [`공식 정보가 없는 항목이 있어요: ${floor.unknown.map((k) => (k === "walk_distance" ? "걷는 거리" : CONDITION_LABELS[k])).join(", ")}`]
    : [];
  return {
    placeId: place.id,
    verdict: strict,
    reasons: [...floor.reasons, ...unknownReason].length > 0 ? [...floor.reasons, ...unknownReason] : ["꼭 필요한 조건을 공식 정보로 모두 확인했어요"],
    evidence: [],
    source: "rule",
    floorApplied: false,
    checkBeforeGo: floor.asks,
  };
}

/** LLM 판단 1개에 근거 검사와 안전 하한을 적용한다 */
export function applyGuards(raw: RawJudgment, place: Place, cond: ResolvedConditions, allowedEvidence: readonly string[]): Judgment {
  const allowed = new Set(allowedEvidence);
  const evidence = raw.evidence.filter((id) => allowed.has(id));
  if (raw.placeId !== place.id || evidence.length === 0) return ruleJudgment(place, cond);

  const floor = safetyFloor(place, cond);
  const verdict = moreConservative(raw.verdict, floor.verdict);
  const floorApplied = verdict !== raw.verdict;
  return {
    placeId: place.id,
    verdict,
    reasons: floorApplied ? [...floor.reasons, ...raw.reasons] : raw.reasons,
    evidence,
    source: "ai",
    floorApplied,
    checkBeforeGo: floor.asks,
  };
}

/** 같은 판단을 여러 번 돌린 결과를 합친다. 2:1이면 보수적인 쪽, 셋 다 다르면 확인 필요 */
export function combineSamples(verdicts: Verdict[]): { verdict: Verdict; confidence: Confidence } | null {
  if (verdicts.length === 0) return null;
  const distinct = [...new Set(verdicts)];
  const conservative = distinct.reduce(moreConservative);
  if (distinct.length === 1) return { verdict: distinct[0], confidence: verdicts.length >= 3 ? "높음" : "보통" };
  if (distinct.length === 2 && verdicts.length >= 3) return { verdict: conservative, confidence: "보통" };
  // 셋 다 다르면 LLM끼리 의견이 갈린 것 → 확인 필요(데이터상 '불가'는 안전 하한이 따로 부적합으로 만든다)
  if (distinct.length >= 3) return { verdict: "확인 필요", confidence: "낮음" };
  return { verdict: conservative, confidence: "낮음" };
}
