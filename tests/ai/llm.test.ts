// llm.ts: 재시도·예비 모델·형식 검사. 네트워크 없이 가짜 전송(transport)으로 확인한다.
import { describe, expect, it } from "vitest";
import { createLlm, type LlmTransport } from "@/lib/llm";

const schema = {
  type: "object",
  properties: { value: { type: "string", enum: ["가능", "모름"] } },
  required: ["value"],
  additionalProperties: false,
};
const req = { task: "test", system: "s", input: "i", schema };
const noSleep = async () => {};

function scripted(responses: (string | { status: number })[]) {
  const calls: { model: string; input: string }[] = [];
  const transport: LlmTransport = async ({ model, input }) => {
    calls.push({ model, input });
    const next = responses.shift();
    if (next === undefined) throw new Error("응답 없음");
    if (typeof next === "string") return next;
    throw Object.assign(new Error(`HTTP ${next.status}`), { status: next.status });
  };
  return { transport, calls };
}

describe("llm.json", () => {
  it("스키마에 맞는 JSON이면 그대로 돌려준다", async () => {
    const { transport, calls } = scripted(['{"value":"가능"}']);
    const llm = createLlm({ transport, sleep: noSleep });
    const res = await llm.json(req);
    expect(res).toMatchObject({ ok: true, data: { value: "가능" }, attempts: 1 });
    expect(calls[0].model).toBe("gemini-3.5-flash-lite");
  });

  it("형식이 틀리면 1회 다시 요청하고, 오류 내용을 함께 보낸다", async () => {
    const { transport, calls } = scripted(['{"value":"아마도"}', '{"value":"모름"}']);
    const res = await createLlm({ transport, sleep: noSleep }).json(req);
    expect(res).toMatchObject({ ok: true, data: { value: "모름" }, attempts: 2 });
    expect(calls[1].input).toContain("형식");
  });

  it("두 번 다 형식이 틀리면 버린다(ok: false)", async () => {
    const { transport } = scripted(["이건 JSON이 아님", '{"value":"아마도"}']);
    const res = await createLlm({ transport, sleep: noSleep }).json(req);
    expect(res).toMatchObject({ ok: false, error: "invalid" });
  });

  it("429·503은 기다렸다가 다시 시도한다", async () => {
    const waits: number[] = [];
    const { transport } = scripted([{ status: 503 }, { status: 429 }, '{"value":"가능"}']);
    const res = await createLlm({ transport, sleep: async (ms) => void waits.push(ms) }).json(req);
    expect(res.ok).toBe(true);
    expect(waits.length).toBe(2);
    expect(waits[1]).toBeGreaterThan(waits[0]);
  });

  it("미리 읽기 모델이 계속 실패하면 빠른 모델로 대체한다", async () => {
    const { transport, calls } = scripted([{ status: 503 }, { status: 503 }, { status: 503 }, '{"value":"가능"}']);
    const res = await createLlm({ transport, sleep: noSleep, maxRetries: 2 }).json({ ...req, tier: "read" });
    expect(res).toMatchObject({ ok: true, model: "gemini-3.5-flash-lite" });
    expect(calls.map((c) => c.model)).toEqual(["gemini-3.8-flash", "gemini-3.8-flash", "gemini-3.8-flash", "gemini-3.5-flash-lite"]);
  });

  it("400처럼 다시 해도 안 되는 오류는 바로 실패한다", async () => {
    const { transport, calls } = scripted([{ status: 400 }]);
    const res = await createLlm({ transport, sleep: noSleep }).json(req);
    expect(res).toMatchObject({ ok: false, error: "request" });
    expect(calls.length).toBe(1);
  });

  it("검사용 스키마(check)가 있으면 그걸로 검사한다(모델에는 가벼운 스키마만 보냄)", async () => {
    const loose = { type: "object", properties: { value: { type: "string" } }, required: ["value"] };
    const sent: unknown[] = [];
    const responses = ['{"value":"아마도"}', '{"value":"모름"}'];
    const llm = createLlm({
      transport: async ({ schema: s }) => {
        sent.push(s);
        return responses.shift() ?? "";
      },
      sleep: noSleep,
    });
    const res = await llm.json({ ...req, schema: loose, check: schema });
    expect(res).toMatchObject({ ok: true, data: { value: "모름" }, attempts: 2 });
    expect(sent[0]).toBe(loose);
  });

  it("모델 이름은 환경변수로 바꿀 수 있다", async () => {
    const { transport, calls } = scripted(['{"value":"가능"}']);
    await createLlm({ transport, sleep: noSleep, models: { fast: "my-fast" } }).json(req);
    expect(calls[0].model).toBe("my-fast");
  });
});
