// 여러 제공자(Gemini 먼저, 붐비거나 늦으면 OpenAI)와 OpenAI 전송. 네트워크 없이 가짜 전송·가짜 fetch로 확인한다.
import { describe, expect, it } from "vitest";
import { createLlm, openaiTransport, stripNulls, toStrictSchema, type LlmTransport } from "@/lib/llm";

const schema = {
  type: "object",
  properties: { value: { type: "string", enum: ["가능", "모름"] } },
  required: ["value"],
  additionalProperties: false,
};
const req = { task: "test", system: "s", input: "i", schema };
const noSleep = async () => {};

function scripted(name: string, responses: (string | { status: number })[], log: string[]) {
  const transport: LlmTransport = async ({ model }) => {
    log.push(`${name}:${model}`);
    const next = responses.shift();
    if (next === undefined) throw new Error("응답 없음");
    if (typeof next === "string") return next;
    throw Object.assign(new Error(`HTTP ${next.status}`), { status: next.status });
  };
  return transport;
}

describe("제공자 순서 (Gemini 먼저 → OpenAI 예비)", () => {
  it("앞 제공자가 답하면 뒤 제공자는 부르지 않는다", async () => {
    const log: string[] = [];
    const llm = createLlm({
      providers: [
        { name: "gemini", transport: scripted("gemini", ['{"value":"가능"}'], log) },
        { name: "openai", transport: scripted("openai", [], log), models: { fast: "gpt-x" } },
      ],
      sleep: noSleep,
    });
    const res = await llm.json(req);
    expect(res).toMatchObject({ ok: true, model: "gemini-3.5-flash-lite" });
    expect(log).toEqual(["gemini:gemini-3.5-flash-lite"]);
  });

  it("앞 제공자가 503이면 기다리지 않고 바로 다음 제공자로", async () => {
    const log: string[] = [];
    const waits: number[] = [];
    const llm = createLlm({
      providers: [
        { name: "gemini", transport: scripted("gemini", [{ status: 503 }], log) },
        { name: "openai", transport: scripted("openai", ['{"value":"모름"}'], log), models: { fast: "gpt-x" } },
      ],
      sleep: async (ms) => void waits.push(ms),
    });
    const res = await llm.json(req);
    expect(res).toMatchObject({ ok: true, model: "gpt-x", data: { value: "모름" }, attempts: 2 });
    expect(log).toEqual(["gemini:gemini-3.5-flash-lite", "openai:gpt-x"]);
    expect(waits).toEqual([]);
  });

  it("마지막 제공자는 503이어도 기다렸다가 다시 시도한다", async () => {
    const log: string[] = [];
    const llm = createLlm({
      providers: [
        { name: "gemini", transport: scripted("gemini", [{ status: 503 }], log) },
        { name: "openai", transport: scripted("openai", [{ status: 429 }, '{"value":"가능"}'], log), models: { fast: "gpt-x" } },
      ],
      sleep: noSleep,
    });
    expect(await llm.json(req)).toMatchObject({ ok: true, model: "gpt-x" });
    expect(log).toEqual(["gemini:gemini-3.5-flash-lite", "openai:gpt-x", "openai:gpt-x"]);
  });

  it("401·400처럼 다시 해도 안 되는 오류도 다음 제공자로", async () => {
    const log: string[] = [];
    const llm = createLlm({
      providers: [
        { name: "gemini", transport: scripted("gemini", [{ status: 401 }], log) },
        { name: "openai", transport: scripted("openai", ['{"value":"가능"}'], log), models: { fast: "gpt-x" } },
      ],
      sleep: noSleep,
    });
    expect((await llm.json(req)).ok).toBe(true);
    expect(log).toEqual(["gemini:gemini-3.5-flash-lite", "openai:gpt-x"]);
  });

  it("두 번 다 형식이 틀리면 다음 제공자로", async () => {
    const log: string[] = [];
    const llm = createLlm({
      providers: [
        { name: "gemini", transport: scripted("gemini", ['{"value":"아마도"}', '{"value":"글쎄"}'], log) },
        { name: "openai", transport: scripted("openai", ['{"value":"가능"}'], log), models: { fast: "gpt-x" } },
      ],
      sleep: noSleep,
    });
    expect(await llm.json(req)).toMatchObject({ ok: true, model: "gpt-x" });
  });

  it("마지막 제공자까지 안 되면 실패(request)", async () => {
    const log: string[] = [];
    const llm = createLlm({ providers: [{ name: "openai", transport: scripted("openai", [{ status: 400 }], log), models: { fast: "gpt-x" } }], sleep: noSleep });
    expect(await llm.json(req)).toMatchObject({ ok: false, error: "request" });
  });
});

/** 정해 둔 시간 뒤에 답하는 가짜 전송(취소되면 AbortError) */
function delayed(name: string, ms: number, answer: string, log: string[], aborted: string[]): LlmTransport {
  return ({ signal }) =>
    new Promise((resolve, reject) => {
      log.push(name);
      const t = setTimeout(() => resolve(answer), ms);
      signal?.addEventListener("abort", () => {
        clearTimeout(t);
        aborted.push(name);
        reject(Object.assign(new Error("취소"), { name: "AbortError" }));
      });
    });
}

describe("늦으면 다음 제공자에도 보내기", () => {
  it("앞 제공자가 hedgeMs 넘게 답이 없으면 다음 제공자에도 보내고, 먼저 온 답을 쓰고 늦은 쪽은 취소", async () => {
    const log: string[] = [];
    const aborted: string[] = [];
    const llm = createLlm({
      providers: [
        { name: "gemini", transport: delayed("gemini", 300, '{"value":"가능"}', log, aborted) },
        { name: "openai", transport: delayed("openai", 20, '{"value":"모름"}', log, aborted), models: { fast: "gpt-x" } },
      ],
      hedgeMs: 30,
      sleep: noSleep,
    });
    const res = await llm.json(req);
    expect(res).toMatchObject({ ok: true, model: "gpt-x", data: { value: "모름" } });
    expect(log).toEqual(["gemini", "openai"]);
    expect(aborted).toEqual(["gemini"]);
  });

  it("늦었어도 앞 제공자가 먼저 답하면 그 답을 쓰고 뒤 제공자는 취소", async () => {
    const log: string[] = [];
    const aborted: string[] = [];
    const llm = createLlm({
      providers: [
        { name: "gemini", transport: delayed("gemini", 60, '{"value":"가능"}', log, aborted) },
        { name: "openai", transport: delayed("openai", 500, '{"value":"모름"}', log, aborted), models: { fast: "gpt-x" } },
      ],
      hedgeMs: 20,
      sleep: noSleep,
    });
    const res = await llm.json(req);
    expect(res).toMatchObject({ ok: true, model: "gemini-3.5-flash-lite", data: { value: "가능" } });
    expect(aborted).toEqual(["openai"]);
  });

  it("hedgeMs 안에 답하면 다음 제공자는 부르지 않는다", async () => {
    const log: string[] = [];
    const aborted: string[] = [];
    const llm = createLlm({
      providers: [
        { name: "gemini", transport: delayed("gemini", 5, '{"value":"가능"}', log, aborted) },
        { name: "openai", transport: delayed("openai", 5, '{"value":"모름"}', log, aborted), models: { fast: "gpt-x" } },
      ],
      hedgeMs: 200,
      sleep: noSleep,
    });
    expect(await llm.json(req)).toMatchObject({ ok: true, model: "gemini-3.5-flash-lite" });
    expect(log).toEqual(["gemini"]);
  });
});

describe("OpenAI 엄격 스키마", () => {
  const loose = {
    type: "object",
    properties: {
      name: { type: "string", minLength: 1 },
      memo: { type: "string" },
      items: { type: "array", items: { type: "object", properties: { id: { type: "string", enum: ["a", "b"] }, note: { type: "string" } }, required: ["id"] }, maxItems: 3 },
    },
    required: ["name", "items"],
  };

  it("모든 객체에 additionalProperties: false, 모든 속성을 required로, 선택 속성은 null 허용", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 깊은 구조를 바로 들여다보는 검사
    const s = toStrictSchema(loose) as any;
    expect(s.additionalProperties).toBe(false);
    expect(s.required).toEqual(["name", "memo", "items"]);
    expect(s.properties.memo).toEqual({ anyOf: [{ type: "string" }, { type: "null" }] });
    expect(s.properties.name).toEqual({ type: "string" }); // 지원하지 않는 minLength는 뺀다
    expect(s.properties.items.maxItems).toBe(3); // 배열 개수 제한은 지원
    const item = s.properties.items.items;
    expect(item.additionalProperties).toBe(false);
    expect(item.required).toEqual(["id", "note"]);
    expect(item.properties.id).toEqual({ type: "string", enum: ["a", "b"] });
    expect(loose.properties.memo).toEqual({ type: "string" }); // 원본은 그대로
  });

  it("받은 답의 null은 빼서 원래 스키마로 검사할 수 있게 한다", () => {
    expect(stripNulls({ name: "x", memo: null, items: [{ id: "a", note: null }] })).toEqual({ name: "x", items: [{ id: "a" }] });
  });
});

describe("openaiTransport", () => {
  it("Responses API에 JSON 스키마(엄격)·저장 안 함으로 보내고 output_text를 돌려준다(null 제거)", async () => {
    const sent: { url: string; init: RequestInit }[] = [];
    const fakeFetch = (async (url: string, init: RequestInit) => {
      sent.push({ url, init });
      return new Response(JSON.stringify({ status: "completed", output_text: '{"value":"가능","memo":null}' }), { status: 200 });
    }) as unknown as typeof fetch;
    const t = openaiTransport("sk-test", fakeFetch);
    const text = await t({ model: "gpt-x", system: "시스템", input: "입력", schema, temperature: 0.2, timeoutMs: 1000 });
    expect(JSON.parse(text)).toEqual({ value: "가능" });
    expect(sent[0].url).toBe("https://api.openai.com/v1/responses");
    expect((sent[0].init.headers as Record<string, string>).Authorization).toBe("Bearer sk-test");
    const body = JSON.parse(sent[0].init.body as string);
    expect(body).toMatchObject({ model: "gpt-x", instructions: "시스템", input: "입력", store: false, temperature: 0.2 });
    expect(body.text.format).toMatchObject({ type: "json_schema", strict: true, schema: { additionalProperties: false } });
  });

  it("HTTP 오류는 status를 붙여 던진다(재시도·제공자 넘기기 판단용)", async () => {
    const fakeFetch = (async () => new Response('{"error":{"message":"busy"}}', { status: 503 })) as unknown as typeof fetch;
    await expect(openaiTransport("k", fakeFetch)({ model: "m", system: "s", input: "i", schema, temperature: 0, timeoutMs: 1000 })).rejects.toMatchObject({ status: 503 });
  });

  it("output_text가 없으면 output 안의 글을 모은다", async () => {
    const fakeFetch = (async () =>
      new Response(JSON.stringify({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: '{"value":"모름"}' }] }] }), { status: 200 })) as unknown as typeof fetch;
    expect(await openaiTransport("k", fakeFetch)({ model: "m", system: "s", input: "i", schema, temperature: 0, timeoutMs: 1000 })).toBe('{"value":"모름"}');
  });
});
