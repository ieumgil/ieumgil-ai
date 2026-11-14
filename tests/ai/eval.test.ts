// ② 판단 평가 지표: 3회 일치율·확신도·하한·근거 버림, 모델 간 일치율
import { describe, expect, it } from "vitest";
import { crossAgreement, summarize, type JudgeRun } from "@/lib/ai/eval";
import type { Verdict } from "@/lib/ai/guards";

const run: JudgeRun = {
  samples: new Map<string, Verdict[]>([
    ["A", ["적합", "적합", "적합"]],
    ["B", ["적합", "주의", "적합"]],
    ["C", ["적합", "주의", "확인 필요"]],
    ["D", ["주의", "주의"]], // 표본 2개 → 일치율 계산에서 뺀다
  ]),
  final: new Map([
    ["A", { verdict: "적합" as const, confidence: "높음" as const, source: "ai" as const }],
    ["B", { verdict: "주의" as const, confidence: "보통" as const, source: "ai" as const }],
    ["C", { verdict: "확인 필요" as const, confidence: "낮음" as const, source: "ai" as const }],
    ["D", { verdict: "주의" as const, confidence: "보통" as const, source: "ai" as const }],
    ["E", { verdict: "확인 필요" as const, confidence: "낮음" as const, source: "rule" as const }],
  ]),
  stats: { received: 12, dropped: 1, floored: 2 },
};

describe("판단 평가 지표", () => {
  it("3회 일치율은 표본 3개인 장소만, 셋 다 같음 / 2:1 / 모두 다름", () => {
    const s = summarize([run]);
    expect(s).toMatchObject({ places: 3, unanimous: 1, majority: 1, split: 1, unanimousPct: 33.3 });
  });

  it("확신도는 AI 판단만 세고, 최종 판단은 모두 센다. 버린 비율은 받은 판단 기준, 하한 비율은 남은 판단 기준", () => {
    const s = summarize([run]);
    expect(s.confidence).toEqual({ 높음: 1, 보통: 2, 낮음: 1 });
    expect(s.verdicts).toEqual({ 적합: 1, 주의: 2, "확인 필요": 2, 부적합: 0 });
    expect(s.droppedPct).toBe(8.3);
    expect(s.flooredPct).toBe(18.2);
  });

  it("모델 간 일치율과 정반대(적합 ↔ 부적합) 수", () => {
    const a = new Map<string, Verdict>([["A", "적합"], ["B", "주의"], ["C", "적합"], ["X", "적합"]]);
    const b = new Map<string, Verdict>([["A", "적합"], ["B", "확인 필요"], ["C", "부적합"]]);
    const c = crossAgreement(a, b);
    expect(c).toMatchObject({ both: 3, same: 1, samePct: 33.3, opposite: 1, aStricter: 0, bStricter: 2 });
    expect(c.table.주의["확인 필요"]).toBe(1);
  });
});
