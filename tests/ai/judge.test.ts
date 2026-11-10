// ② 판단: 가짜 LLM으로 3회 합치기·근거 검사·하한·실패 시 규칙 판단을 확인한다.
import { describe, expect, it } from "vitest";
import { judgePlaces, type EvidenceIndex } from "@/lib/ai/judge";
import { filterCandidates } from "@/lib/engine/filter";
import { ARRIVAL_COORDS } from "@/lib/engine/travel";
import { createLlm } from "@/lib/llm";
import { input, makePlace } from "../engine/fixture";

const places = [
  makePlace("GN91", { set: { elevator: { value: "모름", ask: "엘리베이터가 있나요?" } } }),
  makePlace("GN92", { set: { surface: { value: "부분가능", note: "데크까지만" } } }),
];
const evidence: EvidenceIndex = {
  GN91: [{ id: "route-1", label: "접근로", text: "출입구까지 경사로" }],
  GN92: [{ id: "route-1", label: "접근로", text: "데크 산책로" }],
};
const inp = input({ travelers: ["wheelchair"] });
const filtered = filterCandidates(places, inp, ["2026-11-21"], ARRIVAL_COORDS["gangneung-station"]);

const answer = (gn91: string, gn92: string, ev91 = ["route-1"]) =>
  JSON.stringify({
    judgments: [
      { placeId: "GN91", verdict: gn91, reasons: ["경사로로 들어갈 수 있어요"], evidence: ev91 },
      { placeId: "GN92", verdict: gn92, reasons: ["데크까지 갈 수 있어요"], evidence: ["route-1"] },
    ],
  });

function llmWith(responses: (string | Error)[]) {
  return createLlm({
    transport: async () => {
      const r = responses.shift();
      if (r instanceof Error || r === undefined) throw Object.assign(new Error("fail"), { status: 400 });
      return r;
    },
    sleep: async () => {},
  });
}
const run = (responses: (string | Error)[]) =>
  judgePlaces(llmWith(responses), { input: inp, conditions: filtered.conditions, candidates: filtered.candidates, evidence });

describe("② 판단", () => {
  it("3번 모두 같으면 확신 높음, '모름' 항목은 질문으로 붙는다", async () => {
    const r = await run([answer("적합", "주의"), answer("적합", "주의"), answer("적합", "주의")]);
    expect(r.judgments.get("GN91")).toMatchObject({ verdict: "적합", confidence: "높음", source: "ai", checkBeforeGo: ["엘리베이터가 있나요?"] });
  });

  it("LLM이 적합이라 해도 필수 '부분가능'이면 주의로 내린다", async () => {
    const r = await run([answer("적합", "적합"), answer("적합", "적합"), answer("적합", "적합")]);
    expect(r.judgments.get("GN92")).toMatchObject({ verdict: "주의" });
    expect(r.floorApplied).toBe(1);
  });

  it("근거가 맞지 않는 판단은 버리고 나머지로 합친다", async () => {
    const r = await run([answer("적합", "주의", ["made-up-1"]), answer("주의", "주의"), answer("적합", "주의")]);
    expect(r.judgments.get("GN91")).toMatchObject({ verdict: "주의", confidence: "낮음" }); // 남은 2개가 다름 → 보수적
  });

  it("3번 모두 실패하면 규칙 판단(엄격): 필수 '모름'이 있으면 확인 필요", async () => {
    const r = await run([new Error(), new Error(), new Error()]);
    expect(r.failedCalls).toBe(3);
    expect(r.judgments.get("GN91")).toMatchObject({ verdict: "확인 필요", source: "rule" });
  });
});
