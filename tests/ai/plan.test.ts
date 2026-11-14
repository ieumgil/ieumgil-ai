// ③ 계획: 가짜 LLM으로 "검사를 통과한 안만 나간다", "걸린 안만 다시 요청", "시각은 코드 값"을 확인한다.
import { describe, expect, it } from "vitest";
import { ruleJudgment, type Judgment } from "@/lib/ai/guards";
import { planOptions, type PlanArgs } from "@/lib/ai/plan";
import { llmCandidateMax, makeTrip } from "@/lib/ai/trip";
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

describe("시간 한도", () => {
  it("다시 짤 시간이 없으면(canRetry=false) 걸린 안을 다시 요청하지 않고 뺀다", async () => {
    const bad = option("A", [["GN96", 50], ["GN96", 50]]); // 중복
    const { llm, inputs } = scripted([JSON.stringify({ options: [bad, option("B", [["GN97", 40]])] })]);
    const r = await planOptions(llm, { ...args, canRetry: () => false }, ["여유", "취향"]);
    expect(inputs).toHaveLength(1);
    expect(r.options.map((o) => o.id)).toEqual(["B"]);
    expect(r.dropped.find((d) => d.id === "A")?.violations[0]).toContain("시간");
  });

  it("AI가 끝내 답하지 않아도 전체 한도 안에 규칙 일정으로 끝난다", async () => {
    const hang: LlmTransport = ({ signal }) =>
      new Promise((_, reject) => signal?.addEventListener("abort", () => reject(Object.assign(new Error("취소"), { name: "AbortError" }))));
    const llm = createLlm({ transport: hang, sleep: async () => {} });
    const t0 = Date.now();
    const r = await makeTrip(llm, inp, places, {}, estimateLeg, () => {}, { budgetMs: 300 });
    expect(Date.now() - t0).toBeLessThan(1_500);
    expect(r.usedFallback).toBe(true);
    expect(r.options[0].source).toBe("rule");
  });
});

describe("2박 3일은 1안(11/14)", () => {
  it("안을 하나만(좋아하는 곳 중심) 요청하고, 화면에 이유를 남긴다", async () => {
    const inp3 = input({ travelers: ["wheelchair"], endDate: "2026-11-23", lodging: "강릉" });
    const planInputs: string[] = [];
    // 가짜 LLM: 요청 스키마로 판단·계획·평가를 구분해 형식에 맞는 답을 준다
    const transport: LlmTransport = async ({ input: i, schema }) => {
      const props = (schema as { properties: Record<string, { items: { properties: Record<string, { enum?: string[]; items?: { properties: Record<string, { enum?: string[] }> } }> } }> }).properties;
      if (props.judgments) {
        const ids = props.judgments.items.properties.placeId.enum!;
        return JSON.stringify({ judgments: ids.map((placeId) => ({ placeId, verdict: "적합", reasons: ["이유"], evidence: [] })) });
      }
      if (props.options) {
        planInputs.push(i);
        const dates = props.options.items.properties.days.items!.properties.date.enum!;
        return JSON.stringify({ options: [{ id: "A", title: "시험", summary: "요약", days: dates.map((date) => ({ date, stops: [] })), cautions: [], checkBeforeGo: [] }] });
      }
      return JSON.stringify({ reviews: [{ optionId: "A", fatigue: 4, slack: 4, taste: 4, comment: "좋아요" }] });
    };
    const r = await makeTrip(createLlm({ transport, sleep: async () => {} }), inp3, places, {}, estimateLeg);
    expect(planInputs).toHaveLength(1);
    expect(planInputs[0]).toContain("- A안: 좋아하는 곳 중심");
    expect(planInputs[0]).not.toContain("- B안");
    expect(r.options).toHaveLength(1);
    expect(r.oneOption).toContain("2박 3일");
  });

  it("AI에 넘기는 후보는 2박 3일이면 30곳, 그보다 짧으면 20곳까지", () => {
    expect(llmCandidateMax(1)).toBe(20);
    expect(llmCandidateMax(2)).toBe(20);
    expect(llmCandidateMax(3)).toBe(30);
  });
});

describe("카카오 실제 이동시간으로 다시 검사", () => {
  const down = createLlm({ transport: async () => Promise.reject(Object.assign(new Error("down"), { status: 400 })), sleep: async () => {} });

  it("날짜마다 출발 → 장소 → 도착 순서로 실제 이동시간을 묻고, 비슷하면 안을 그대로 둔다", async () => {
    const asked: { lat: number; lng: number }[][] = [];
    const logs: string[] = [];
    const r = await makeTrip(down, inp, places, {}, estimateLeg, (e) => void ("text" in e && logs.push(e.text)), {
      realLegs: async (days) => {
        asked.push(...days);
        return days.map((pts) => pts.slice(1).map((p, i) => estimateLeg(pts[i] as never, p as never))); // 추정과 같은 값
      },
    });
    const o = r.options[0];
    expect(asked).toHaveLength(o.draft.days.length);
    expect(asked[0][0]).toMatchObject({ lat: r.rule.frames[0].start.lat, lng: r.rule.frames[0].start.lng });
    expect(asked[0]).toHaveLength(o.draft.days[0].stops.length + 2);
    expect(logs.some((t) => t.includes("실제 차량 이동시간"))).toBe(true);
    expect(o.draft).toEqual(r.rule.draft);
  });

  it("실제 이동시간이 길어 넘치면 코드가 시간을 맞춘 안으로 바꾸고, 그 안은 실제 시간으로도 통과한다", async () => {
    const slow = (days: { lat: number; lng: number }[][]) => Promise.resolve(days.map((pts) => pts.slice(1).map(() => ({ minutes: 45, km: 20 }))));
    const longInp = input({ travelers: ["wheelchair"], pace: "busy" });
    const r = await makeTrip(down, longInp, places, {}, estimateLeg, () => {}, { realLegs: slow });
    const o = r.options[0];
    const before = r.rule.draft.days[0].stops.length;
    expect(o.draft.days[0].stops.length).toBeLessThanOrEqual(before);
    if (o.draft.days[0].stops.length < before || o.fixedViolations.length) expect(o.fixedViolations.join(" ")).toContain("실제 이동시간");
  });

  it("실제 이동시간을 못 받으면(null) 추정 그대로 두고 그렇다고 남긴다", async () => {
    const logs: string[] = [];
    const r = await makeTrip(down, inp, places, {}, estimateLeg, (e) => void ("text" in e && logs.push(e.text)), { realLegs: async (days) => days.map(() => null) });
    expect(r.options[0].draft).toEqual(r.rule.draft);
    expect(logs.some((t) => t.includes("받지 못해"))).toBe(true);
  });
});

describe("꼭 가고 싶은 곳", () => {
  it("안에서 빠지면 검사에 걸려 그 내용을 붙여 다시 요청하고, 넣어 오면 쓴다", async () => {
    const mustInp = input({ travelers: ["wheelchair"], mustVisit: ["GN97"] });
    const f2 = filterCandidates(places, mustInp, [frames[0].date], frames[0].start);
    const j2 = new Map<string, Judgment>(f2.candidates.map((c) => [c.place.id, { ...ruleJudgment(c.place, f2.conditions), source: "ai" as const }]));
    const a2: PlanArgs = { ...args, input: mustInp, candidates: f2.candidates, judgments: j2 };
    const without = option("A", [["GN96", 50]]);
    const withMust = option("A", [["GN96", 50], ["GN97", 40]]);
    const { llm, inputs } = scripted([JSON.stringify({ options: [without] }), JSON.stringify({ options: [withMust] })]);
    const r = await planOptions(llm, a2, ["여유"]);
    expect(inputs[0]).toContain("꼭 가고 싶은 곳: GN97");
    expect(inputs[1]).toContain("꼭 가고 싶은 곳");
    expect(inputs[1]).toContain("빠졌어요");
    expect(r.options[0].draft.days[0].stops.map((s) => s.placeId)).toContain("GN97");
  });

  it("안끼리 겹침을 셀 때 꼭 가고 싶은 곳은 빼서, 같은 곳을 넣었다고 안이 빠지지 않는다", async () => {
    const mustInp = input({ travelers: ["wheelchair"], mustVisit: ["GN97"] });
    const f2 = filterCandidates(places, mustInp, [frames[0].date], frames[0].start);
    const j2 = new Map<string, Judgment>(f2.candidates.map((c) => [c.place.id, { ...ruleJudgment(c.place, f2.conditions), source: "ai" as const }]));
    const both = JSON.stringify({ options: [option("A", [["GN97", 40], ["GN96", 50]]), option("B", [["GN97", 40], ["GN94", 40]])] });
    const { llm } = scripted([both]);
    const r = await planOptions(llm, { ...args, input: mustInp, candidates: f2.candidates, judgments: j2 }, ["여유", "취향"]);
    expect(r.options.map((o) => o.id)).toEqual(["A", "B"]);
  });

  it("끝까지 빠지면 그 안은 뺀다(꼭 가고 싶은 곳이 없는 안은 나가지 않는다)", async () => {
    const mustInp = input({ travelers: ["wheelchair"], mustVisit: ["GN97"] });
    const f2 = filterCandidates(places, mustInp, [frames[0].date], frames[0].start);
    const j2 = new Map<string, Judgment>(f2.candidates.map((c) => [c.place.id, { ...ruleJudgment(c.place, f2.conditions), source: "ai" as const }]));
    const without = JSON.stringify({ options: [option("A", [["GN96", 50]])] });
    const { llm } = scripted([without, without, without]);
    const r = await planOptions(llm, { ...args, input: mustInp, candidates: f2.candidates, judgments: j2 }, ["여유"]);
    expect(r.options).toHaveLength(0);
    expect(r.dropped[0].violations.join(" ")).toContain("꼭 가고 싶은 곳");
  });
});
