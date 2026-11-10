// ③ 계획: 가짜 LLM으로 "검사를 통과한 안만 나간다", "걸린 안만 다시 요청", "시각은 코드 값"을 확인한다.
import { describe, expect, it } from "vitest";
import { ruleJudgment, type Judgment } from "@/lib/ai/guards";
import { planOptions, type PlanArgs } from "@/lib/ai/plan";
import { makeTrip } from "@/lib/ai/trip";
import { filterCandidates } from "@/lib/engine/filter";
import { buildFrames } from "@/lib/engine/frames";
import { timelineOptions } from "@/lib/engine/timeline";
import { estimateLeg } from "@/lib/engine/travel";
import { createLlm, type LlmTransport } from "@/lib/llm";
import { input, scenarioPlaces } from "../engine/fixture";

const places = scenarioPlaces();
const byId = new Map(places.map((p) => [p.id, p]));
const inp = input({ travelers: ["wheelchair"] });
const frames = buildFrames(inp).frames;
const filtered = filterCandidates(places, inp, [frames[0].date], frames[0].start);
const judgments = new Map<string, Judgment>(filtered.candidates.map((c) => [c.place.id, { ...ruleJudgment(c.place, filtered.conditions), source: "ai" as const }]));
const args: PlanArgs = { input: inp, frames, candidates: filtered.candidates, judgments, placesById: byId, travel: estimateLeg, options: timelineOptions(inp) };

const option = (id: string, stops: [string, number][], extra: Record<string, unknown> = {}) => ({
  id,
  title: `${id}안: 시험`,
  summary: "요약",
  days: [{ date: "2026-11-21", stops: stops.map(([placeId, stayMin]) => ({ placeId, stayMin, why: "이유" })) }],
  cautions: [],
  checkBeforeGo: [],
  ...extra,
});

function scripted(responses: string[]) {
  const inputs: string[] = [];
  const transport: LlmTransport = async ({ input: i }) => {
    inputs.push(i);
    const r = responses.shift();
    if (!r) throw Object.assign(new Error("no more"), { status: 400 });
    return r;
  };
  return { llm: createLlm({ transport, sleep: async () => {} }), inputs };
}

describe("③ 계획", () => {
  it("검사를 통과하면 그대로 쓰고, 시각은 코드가 계산한다(제목의 'A안:'은 뗀다)", async () => {
    const { llm } = scripted([JSON.stringify({ options: [option("A", [["GN96", 50], ["GN91", 999]])] })]);
    const r = await planOptions(llm, args, ["여유"]);
    expect(r.options).toHaveLength(1);
    expect(r.options[0].title).toBe("시험");
    expect(r.options[0].draft.days[0].stops[1].stayMin).toBe(60); // 999분 → 범위(40~60)로 맞춤
    expect(r.options[0].check.timelines[0].items.some((i) => i.kind === "visit")).toBe(true);
  });

  it("위반이 있으면 그 안만 위반 내용을 붙여 다시 요청하고, 고치면 쓴다", async () => {
    const bad = option("A", [["GN96", 50], ["GN96", 50]]); // 중복
    const good = option("A", [["GN96", 50], ["GN91", 50]]);
    const { llm, inputs } = scripted([JSON.stringify({ options: [bad, option("B", [["GN97", 40]])] }), JSON.stringify({ options: [good] })]);
    const r = await planOptions(llm, args, ["여유", "취향"]);
    expect(r.options.map((o) => o.id).sort()).toEqual(["A", "B"]);
    expect(r.options.find((o) => o.id === "A")!.fixes).toBe(1);
    expect(inputs[1]).toContain("검사 결과를 고쳐라");
    expect(inputs[1]).not.toContain("- B안"); // 통과한 B안은 다시 요청하지 않는다
  });

  it("끝까지 위반이면 그 안은 빼고, 하나도 없으면 규칙 일정 1안", async () => {
    const bad = JSON.stringify({ options: [option("A", [["GN93", 50]])] }); // 휠체어 부적합(진입 불가) → 후보 아님
    const { llm } = scripted([bad, bad, bad]);
    const r = await planOptions(llm, args, ["여유"]);
    expect(r.options).toHaveLength(0);
    expect(r.dropped[0].id).toBe("A");
  });

  it("출발 전 확인은 안에 들어간 장소의 질문만, ② 판단의 질문도 함께", async () => {
    const opt = option("A", [["GN94", 40]], { checkBeforeGo: [{ placeId: "GN94", question: "데크 끝까지 가나요?" }, { placeId: "GN91", question: "안 들어간 곳 질문" }] });
    const { llm } = scripted([JSON.stringify({ options: [opt] })]);
    const r = await planOptions(llm, args, ["여유"]);
    const qs = r.options[0].checkBeforeGo.map((q) => q.question);
    expect(qs).toContain("데크 끝까지 가나요?");
    expect(qs).toContain("해변 데크까지 휠체어로 갈 수 있나요?"); // GN94 노면 '모름'의 질문
    expect(qs).not.toContain("안 들어간 곳 질문");
  });
});

describe("전체 흐름(makeTrip)", () => {
  it("LLM이 전부 실패하면 규칙 일정 1안으로 동작한다(시연이 멈추지 않음)", async () => {
    const llm = createLlm({ transport: async () => Promise.reject(Object.assign(new Error("down"), { status: 400 })), sleep: async () => {} });
    const r = await makeTrip(llm, inp, places, {}, estimateLeg);
    expect(r.usedFallback).toBe(true);
    expect(r.options).toHaveLength(1);
    expect(r.options[0].source).toBe("rule");
    expect(r.options[0].check.ok).toBe(true);
  });
});
