// llm.ts 토큰 수 모으기(지속 가능성 · 운영 비용 측정): 전송이 알려 준 토큰을 요청 하나 단위로 더해 결과에 붙인다.
// 다시 요청·다른 제공자에 함께 보낸 것까지 모두 더한다(둘 다 비용이 든다). 토큰을 알려 주지 않는 전송이면 usage가 없다.
import { describe, expect, it } from "vitest";
import { createLlm, openaiTransport, type LlmTransport } from "@/lib/llm";

const schema = {
  type: "object",
  properties: { value: { type: "string", enum: ["가능", "모름"] } },
  required: ["value"],
  additionalProperties: false,
};
const req = { task: "test", system: "s", input: "i", schema };
const noSleep = async () => {};

describe("llm usage", () => {
  it("전송이 알려 준 입력·출력·사고 토큰을 결과에 붙인다", async () => {
    const transport: LlmTransport = async ({ onUsage }) => {
      onUsage?.({ input: 100, output: 20, thinking: 5 });
      return '{"value":"가능"}';
    };
    const res = await createLlm({ transport, sleep: noSleep }).json(req);
    expect(res.usage).toEqual({ input: 100, output: 20, thinking: 5, calls: 1, byModel: { "gemini-3.5-flash-lite": { input: 100, output: 20, thinking: 5, calls: 1 } } });
  });

  it("형식 오류로 다시 요청하면 두 번 모두 더한다", async () => {
    const answers = ['{"value":"아마도"}', '{"value":"모름"}'];
    const transport: LlmTransport = async ({ onUsage }) => {
      onUsage?.({ input: 50, output: 10, thinking: 0 });
      return answers.shift()!;
    };
    const res = await createLlm({ transport, sleep: noSleep }).json(req);
    expect(res.ok).toBe(true);
    expect(res.usage).toMatchObject({ input: 100, output: 20, calls: 2 });
  });

  it("늦어서 다른 제공자에도 보냈으면 두 제공자 토큰을 모델별로 함께 센다", async () => {
    const slow: LlmTransport = async ({ onUsage, signal }) =>
      new Promise((resolve, reject) => {
        const t = setTimeout(() => {
          onUsage?.({ input: 70, output: 0, thinking: 0 });
          resolve('{"value":"가능"}');
        }, 200);
        signal?.addEventListener("abort", () => {
          clearTimeout(t);
          onUsage?.({ input: 70, output: 0, thinking: 0 }); // 끊겨도 입력은 이미 보냈다고 본다
          reject(Object.assign(new Error("취소"), { name: "AbortError" }));
        });
      });
    const fast: LlmTransport = async ({ onUsage }) => {
      onUsage?.({ input: 80, output: 15, thinking: 0 });
      return '{"value":"모름"}';
    };
    const llm = createLlm({
      providers: [
        { name: "a", transport: slow, models: { fast: "a-fast" } },
        { name: "b", transport: fast, models: { fast: "b-fast" } },
      ],
      hedgeMs: 10,
      sleep: noSleep,
    });
    const res = await llm.json(req);
    await new Promise((r) => setTimeout(r, 20));
    expect(res.ok && res.data).toEqual({ value: "모름" });
    expect(res.usage?.byModel["b-fast"]).toMatchObject({ input: 80, output: 15 });
    expect(res.usage?.input).toBeGreaterThanOrEqual(80);
  });

  it("토큰을 알려 주지 않는 전송이면 usage가 없다(기존 가짜 전송 그대로)", async () => {
    const transport: LlmTransport = async () => '{"value":"가능"}';
    const res = await createLlm({ transport, sleep: noSleep }).json(req);
    expect(res.usage).toBeUndefined();
  });

  it("OpenAI 응답의 usage(입력·출력·추론 토큰)를 읽어 알려 준다", async () => {
    const fakeFetch = (async () =>
      new Response(JSON.stringify({ output_text: '{"value":"가능"}', usage: { input_tokens: 321, output_tokens: 45, output_tokens_details: { reasoning_tokens: 0 } } }), { status: 200 })) as unknown as typeof fetch;
    const seen: unknown[] = [];
    await openaiTransport("k", fakeFetch)({ model: "m", system: "s", input: "i", schema, temperature: 0, timeoutMs: 1000, onUsage: (u) => seen.push(u) });
    expect(seen).toEqual([{ input: 321, output: 45, thinking: 0 }]);
  });
});
