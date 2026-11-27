// ② 판단 평가 지표(사람 정답 없이 자동으로 잰다, docs/ai-plan.md '평가'). scripts/ai/eval-judge.ts가 쓴다.
// - 3회 일치율: 같은 후보를 온도만 달리해 3번 판단했을 때 셋 다 같은 비율(근거 검사를 통과한 표본 3개인 장소만)
// - 확신도 분포(높음/보통/낮음), 최종 판단 분포, 안전 하한으로 내린 비율, 근거가 맞지 않아 버린 비율
// - 모델 간 일치율: 같은 장면·같은 장소에서 두 모델의 최종 판단이 같은 비율, '적합 ↔ 부적합'처럼 정반대로 갈린 수

import type { Confidence, Verdict } from "./guards";

export const VERDICT_ORDER: Verdict[] = ["적합", "주의", "확인 필요", "부적합"];

export interface JudgeRun {
  /** 장소 → 표본 판단(가드 뒤) */
  samples: Map<string, Verdict[]>;
  /** 장소 → 최종 판단·확신도·출처(ai = 표본이 하나라도 있음, rule = 3번 모두 실패해 규칙 판단) */
  final: Map<string, { verdict: Verdict; confidence: Confidence; source: "ai" | "rule" }>;
  stats: { received: number; dropped: number; floored: number };
}

export interface JudgeSummary {
  /** 표본이 3개인 장소 수 */
  places: number;
  unanimous: number;
  majority: number;
  split: number;
  /** 셋 다 같은 비율(%) */
  unanimousPct: number;
  confidence: Record<Confidence, number>;
  verdicts: Record<Verdict, number>;
  received: number;
  dropped: number;
  floored: number;
  droppedPct: number;
  flooredPct: number;
}

const pct = (n: number, d: number) => (d === 0 ? 0 : Math.round((n / d) * 1000) / 10);

export function summarize(runs: JudgeRun[]): JudgeSummary {
  let places = 0;
  let unanimous = 0;
  let majority = 0;
  let split = 0;
  const confidence: Record<Confidence, number> = { 높음: 0, 보통: 0, 낮음: 0 };
  const verdicts = Object.fromEntries(VERDICT_ORDER.map((v) => [v, 0])) as Record<Verdict, number>;
  let received = 0;
  let dropped = 0;
  let floored = 0;
  for (const r of runs) {
    for (const s of r.samples.values()) {
      if (s.length !== 3) continue;
      places++;
      const distinct = new Set(s).size;
      if (distinct === 1) unanimous++;
      else if (distinct === 2) majority++;
      else split++;
    }
    for (const f of r.final.values()) {
      verdicts[f.verdict]++;
      if (f.source === "ai") confidence[f.confidence]++;
    }
    received += r.stats.received;
    dropped += r.stats.dropped;
    floored += r.stats.floored;
  }
  return {
    places,
    unanimous,
    majority,
    split,
    unanimousPct: pct(unanimous, places),
    confidence,
    verdicts,
    received,
    dropped,
    floored,
    droppedPct: pct(dropped, received),
    flooredPct: pct(floored, received - dropped),
  };
}

export interface CrossSummary {
  /** 두 모델 모두 판단한 장소 수 */
  both: number;
  same: number;
  samePct: number;
  /** 한쪽 적합, 다른 쪽 부적합 */
  opposite: number;
  /** 갈린 곳 중 앞 모델이 더 보수적(적합 < 주의 < 확인 필요 < 부적합) / 뒤 모델이 더 보수적 */
  aStricter: number;
  bStricter: number;
  /** 행 = 앞 모델, 열 = 뒤 모델 */
  table: Record<Verdict, Record<Verdict, number>>;
}

export function crossAgreement(a: Map<string, Verdict>, b: Map<string, Verdict>): CrossSummary {
  const table = Object.fromEntries(VERDICT_ORDER.map((v) => [v, Object.fromEntries(VERDICT_ORDER.map((w) => [w, 0]))])) as CrossSummary["table"];
  let both = 0;
  let same = 0;
  let opposite = 0;
  let aStricter = 0;
  let bStricter = 0;
  const rank = (v: Verdict) => VERDICT_ORDER.indexOf(v);
  for (const [id, va] of a) {
    const vb = b.get(id);
    if (!vb) continue;
    both++;
    table[va][vb]++;
    if (va === vb) same++;
    if ((va === "적합" && vb === "부적합") || (va === "부적합" && vb === "적합")) opposite++;
    if (rank(va) > rank(vb)) aStricter++;
    if (rank(vb) > rank(va)) bStricter++;
  }
  return { both, same, samePct: pct(same, both), opposite, aStricter, bStricter, table };
}
