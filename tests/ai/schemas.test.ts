// schemas.ts + llm.ts: 근거 id enum으로 지어낸 근거·문장 전체를 막는다.
import { describe, expect, it } from "vitest";
import { judgeSchema } from "@/lib/ai/schemas";
import { createLlm } from "@/lib/llm";

const schema = judgeSchema(["GN91", "GN92"], ["route-1", "restroom-1"]);
const answer = (evidence: string[], placeId = "GN91") =>
  JSON.stringify({
    judgments: [
      { placeId, verdict: "적합", reasons: ["경사로가 있어요"], evidence },
      { placeId: "GN92", verdict: "주의", reasons: ["화장실이 멀어요"], evidence: ["restroom-1"] },
    ],
  });

async function run(...responses: string[]) {
  const llm = createLlm({ transport: async () => responses.shift() ?? "", sleep: async () => {} });
  return llm.json({ task: "judge", system: "", input: "", schema });
}

describe("판단 스키마", () => {
  it("넘겨준 근거 id만 받는다", async () => {
    expect((await run(answer(["route-1"]))).ok).toBe(true);
  });

  it("문장 전체를 근거로 내면(스모크 테스트에서 실제로 나온 형태) 형식 오류로 다시 요청한다", async () => {
    const res = await run(answer(["[route-1] 출입구까지 경사로가 설치되어 있음"]), answer(["route-1"]));
    expect(res).toMatchObject({ ok: true, attempts: 2 });
  });

  it("후보에 없는 장소 id는 거부한다", async () => {
    const res = await run(answer(["route-1"], "GN99"), answer(["route-1"], "GN99"));
    expect(res).toMatchObject({ ok: false, error: "invalid" });
  });

  it("장소 수와 판단 수가 다르면 거부한다", async () => {
    const one = JSON.stringify({ judgments: [{ placeId: "GN91", verdict: "적합", reasons: ["x"], evidence: ["route-1"] }] });
    expect((await run(one, one)).ok).toBe(false);
  });
});
