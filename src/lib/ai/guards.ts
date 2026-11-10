// LLM 판단에 코드가 강제하는 선(docs/ai-plan.md v3 원칙 1).
// - 안전 하한: 필수 '불가' → 부적합, '모름' → 확인 필요, '부분가능' → 최소 주의, 걸을 거리 초과 → 부적합·모름 → 확인 필요.
// - LLM은 하한보다 더 보수적으로만 바꿀 수 있다.
// - 근거 id가 비었거나 넘겨준 목록 밖이면 LLM 판단을 버리고 규칙 판단을 쓴다.

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
  /** '모름'인 필수 항목의 질문(출발 전 확인할 것) */
  asks: string[];
  /** 규칙으로 만든 이유 문장 */
  reasons: string[];
}

const WALK_ASK = "주차장에서 입구까지, 그리고 관람 동선은 각각 몇 m 정도인가요?";

/** 이 사람 조건으로 이 장소가 최소 어디까지 보수적이어야 하는지 */
export function safetyFloor(place: Place, cond: ResolvedConditions): Floor {
  const hits: { verdict: Verdict; key: Floor["keys"][number]; reason: string }[] = [];
  const asks: string[] = [];

  for (const key of cond.must) {
    const a = place.access[key];
    const label = CONDITION_LABELS[key];
    if (a.value === "불가") hits.push({ verdict: "부적합", key, reason: `${label}: 어려워요` });
    else if (a.value === "모름") {
      hits.push({ verdict: "확인 필요", key, reason: `${label}: 공식 정보가 없어요` });
      if (a.ask) asks.push(a.ask);
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
      hits.push({ verdict: "확인 필요", key: "walk_distance", reason: "걷는 거리: 공식 정보가 없어요" });
      asks.push(WALK_ASK);
    }
  }

  if (hits.length === 0) return { verdict: "적합", keys: [], asks, reasons: [] };
  const top = hits.reduce((v, h) => moreConservative(v, h.verdict), "적합" as Verdict);
  const atTop = hits.filter((h) => h.verdict === top);
  return { verdict: top, keys: atTop.map((h) => h.key), asks, reasons: atTop.map((h) => h.reason) };
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

/** 규칙만으로 만든 판단(LLM 실패·근거 없음일 때) */
export function ruleJudgment(place: Place, cond: ResolvedConditions): Judgment {
  const floor = safetyFloor(place, cond);
  return {
    placeId: place.id,
    verdict: floor.verdict,
    reasons: floor.reasons.length > 0 ? floor.reasons : ["꼭 필요한 조건을 공식 정보로 모두 확인했어요"],
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
