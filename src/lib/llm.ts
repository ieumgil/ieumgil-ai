// LLM 호출은 이 파일 하나로 모은다(원칙: 제공자 교체 가능, docs/ai-plan.md v3).
// - 제공자는 차례로: Gemini(빠름) → OpenAI(예비). Gemini가 붐비면(503·429·시간 초과) 다시 기다리지 않고 바로 OpenAI로,
//   답이 늦으면(hedgeMs) OpenAI에도 같은 요청을 보내 먼저 온 답을 쓴다. 모두 안 되면 화면은 규칙 일정 1안.
// - 출력은 항상 JSON 스키마로 받고 ajv로 다시 검사한다(Gemini는 스키마 일부만 지킨다, OpenAI는 엄격 스키마로 보낸다).
// - 형식이 틀리면 오류 내용을 붙여 1회 다시 요청, 그래도 틀리면 버린다(ok: false).
// - 마지막 제공자만 429·5xx·시간 초과를 기다렸다가 다시 시도(지수 대기). 미리 읽기 모델이 끝내 실패하면 빠른 모델로 대체.
// - 400·401처럼 다시 해도 안 되는 오류는 그 제공자를 건너뛰고 다음 제공자로.
// - 서버·스크립트 전용. 브라우저 코드에서 import하지 않는다(키는 서버에서만).

import Ajv2020, { type ValidateFunction } from "ajv/dist/2020";

export type JsonSchema = Record<string, unknown>;
/** fast: 요청할 때(②③④), read: 미리 하는 ① 읽기 */
export type ModelTier = "fast" | "read";

export interface LlmRequest {
  /** 로그·평가용 이름(예: "judge", "read-places") */
  task: string;
  system: string;
  input: string;
  /** 모델에 보내는 스키마(Gemini는 enum이 많거나 중첩이 깊으면 400을 낸다 → 가볍게) */
  schema: JsonSchema;
  /** 받은 답을 검사할 스키마(없으면 schema). 근거 id enum처럼 엄격한 조건은 여기에 둔다 */
  check?: JsonSchema;
  tier?: ModelTier;
  temperature?: number;
  /** 이 시간(ms)이 지나도 답이 없으면 다음 제공자에도 같은 요청을 보낸다(없으면 클라이언트 기본값) */
  hedgeMs?: number;
  /** 함께 보낼 사진(미리 하는 스크립트 전용: 관광지 사진 분류). 요청할 때 흐름에서는 쓰지 않는다 */
  images?: LlmImage[];
}

export interface LlmImage {
  /** base64 */
  data: string;
  mimeType: string;
}

export type LlmError = "invalid" | "request" | "unavailable";

export type LlmResult<T> =
  | { ok: true; data: T; model: string; ms: number; attempts: number }
  | { ok: false; error: LlmError; message: string; model: string; ms: number; attempts: number };

export interface LlmClient {
  json<T>(req: LlmRequest): Promise<LlmResult<T>>;
}

/** 실제 전송. 응답 본문(JSON 문자열)을 돌려주고, 실패하면 status가 붙은 오류를 던진다 */
export type LlmTransport = (call: {
  model: string;
  system: string;
  input: string;
  schema: JsonSchema;
  temperature: number;
  timeoutMs: number;
  images?: LlmImage[];
  /** 다른 제공자의 답이 먼저 오면 취소 */
  signal?: AbortSignal;
}) => Promise<string>;

export interface LlmProvider {
  name: string;
  transport: LlmTransport;
  /** 없으면 Gemini 기본 모델 */
  models?: Partial<Record<ModelTier, string>>;
}

export interface LlmOptions {
  /** 제공자 하나만 쓸 때(테스트·스크립트). providers가 있으면 무시 */
  transport?: LlmTransport;
  models?: Partial<Record<ModelTier, string>>;
  /** 앞에서부터 차례로 시도 */
  providers?: LlmProvider[];
  /** 일시 오류일 때 모델마다 추가로 시도하는 횟수 */
  maxRetries?: number;
  timeoutMs?: number;
  baseDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
  /** 이 시간(ms)이 지나도 답이 없으면 다음 제공자에도 같은 요청(먼저 온 답을 쓴다). 없으면 기다린다 */
  hedgeMs?: number;
}

export const DEFAULT_MODELS: Record<ModelTier, string> = {
  fast: "gemini-3.5-flash-lite",
  read: "gemini-3.8-flash",
};

const ajv = new Ajv2020({ allErrors: true, strict: false });
const compiled = new WeakMap<JsonSchema, ValidateFunction>();
function validatorFor(schema: JsonSchema): ValidateFunction {
  let v = compiled.get(schema);
  if (!v) {
    v = ajv.compile(schema);
    compiled.set(schema, v);
  }
  return v;
}

function statusOf(err: unknown): number | undefined {
  const e = err as { status?: unknown; statusCode?: unknown; name?: unknown };
  const s = e?.status ?? e?.statusCode;
  if (typeof s === "number") return s;
  if (e?.name === "AbortError" || e?.name === "TimeoutError") return 408;
  return undefined;
}
const retryable = (status: number | undefined) => status === undefined || status === 408 || status === 429 || status >= 500;

const withDefaults = (models?: Partial<Record<ModelTier, string>>): Record<ModelTier, string> => ({
  ...DEFAULT_MODELS,
  ...Object.fromEntries(Object.entries(models ?? {}).filter(([, v]) => v)),
});

export function createLlm(opts: LlmOptions): LlmClient {
  const providers = opts.providers?.length
    ? opts.providers
    : opts.transport
      ? [{ name: "default", transport: opts.transport, models: opts.models }]
      : [];
  if (!providers.length) throw new Error("LLM 제공자가 없어요");
  const maxRetries = opts.maxRetries ?? 2;
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const baseDelay = opts.baseDelayMs ?? 1_000;
  const sleep = opts.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));

  return {
    async json<T>(req: LlmRequest): Promise<LlmResult<T>> {
      const t0 = Date.now();
      const validate = validatorFor(req.check ?? req.schema);
      // 시도할 차례: 제공자마다 (read면 읽기 모델 → 빠른 모델), 같은 모델이 겹치면 한 번만
      const steps = providers.flatMap((p, provider) => {
        const m = withDefaults(p.models);
        const tiers = req.tier === "read" ? [...new Set([m.read, m.fast])] : [m.fast];
        return tiers.map((model) => ({ model, transport: p.transport, provider }));
      });
      const hedgeMs = req.hedgeMs ?? opts.hedgeMs;
      let attempts = 0;

      /** 한 차례(모델 하나)만 시도. 뒤에 다른 제공자가 있으면 일시 오류도 다시 기다리지 않고 바로 넘긴다 */
      async function runStep(i: number, signal: AbortSignal): Promise<LlmResult<T>> {
        const { model, transport, provider } = steps[i];
        const hasNext = steps.slice(i + 1).some((x) => x.provider !== provider);
        let input = req.input;
        let formatRetried = false;
        let message = "";
        for (let retry = 0; retry <= maxRetries; ) {
          if (signal.aborted) break;
          attempts++;
          let text: string;
          try {
            text = await transport({ model, system: req.system, input, schema: req.schema, temperature: req.temperature ?? 0.2, timeoutMs, images: req.images, signal });
          } catch (err) {
            const status = statusOf(err);
            message = `${model}: ${status ?? ""} ${(err as Error).message ?? String(err)}`.slice(0, 300);
            if (!retryable(status)) return { ok: false, error: "request", message, model, ms: Date.now() - t0, attempts };
            if (hasNext) break; // 붐빔·시간 초과 → 기다리지 않고 다음 제공자로
            if (retry < maxRetries) await sleep(baseDelay * 2 ** retry);
            retry++;
            continue;
          }

          let data: unknown;
          let problem = "";
          try {
            data = JSON.parse(text);
            if (!validate(data)) problem = ajv.errorsText(validate.errors, { separator: "; " });
          } catch {
            problem = "JSON이 아님";
          }
          if (!problem) return { ok: true, data: data as T, model, ms: Date.now() - t0, attempts };

          message = `${model}: 형식 오류 ${problem}`.slice(0, 300);
          if (formatRetried) return { ok: false, error: "invalid", message, model, ms: Date.now() - t0, attempts };
          formatRetried = true;
          input = `${req.input}\n\n[이전 답의 형식 오류] ${problem}\n주어진 JSON 스키마에 정확히 맞춰 다시 답하라.`;
        }
        return { ok: false, error: "unavailable", message: message || `${model}: 취소`, model, ms: Date.now() - t0, attempts };
      }

      /**
       * i번째부터 차례로. hedgeMs가 지나도 답이 없으면 기다리던 요청은 두고 다음 차례에도 같은 요청을 보내
       * 먼저 온 성공 답을 쓴다(늦은 쪽은 취소). 실패하면 바로 다음 차례로.
       */
      async function from(i: number, outer: AbortSignal): Promise<LlmResult<T>> {
        const ctrl = new AbortController();
        const onOuter = () => ctrl.abort();
        outer.addEventListener("abort", onOuter, { once: true });
        try {
          const first = runStep(i, ctrl.signal);
          if (i === steps.length - 1) return await first;
          const SLOW = Symbol("slow");
          let timer: ReturnType<typeof setTimeout> | undefined;
          const slow = hedgeMs ? new Promise<typeof SLOW>((r) => (timer = setTimeout(() => r(SLOW), hedgeMs))) : new Promise<never>(() => {});
          const r = await Promise.race([first, slow]);
          clearTimeout(timer);
          if (r !== SLOW) return r.ok ? r : await from(i + 1, outer);

          // 늦다 → 다음 차례도 함께. 먼저 성공한 쪽을 쓰고 다른 쪽은 취소
          const nextCtrl = new AbortController();
          outer.addEventListener("abort", () => nextCtrl.abort(), { once: true });
          const second = from(i + 1, nextCtrl.signal);
          const w = await firstOk([first, second]);
          if (w.index === 0) nextCtrl.abort();
          else ctrl.abort();
          return w.result;
        } finally {
          outer.removeEventListener("abort", onOuter);
        }
      }

      const res = await from(0, new AbortController().signal);
      return { ...res, attempts };
    },
  };
}

/** 먼저 성공한 결과와 그 순번(모두 실패면 마지막에 끝난 실패) */
function firstOk<R extends { ok: boolean }>(ps: Promise<R>[]): Promise<{ result: R; index: number }> {
  return new Promise((resolve) => {
    let left = ps.length;
    ps.forEach((p, index) =>
      p.then((result) => {
        left--;
        if (result.ok || left === 0) resolve({ result, index });
      }),
    );
  });
}

/** 시간 제한 + (있으면) 다른 제공자가 먼저 답해서 취소 */
const withTimeout = (ms: number, signal?: AbortSignal) => (signal ? AbortSignal.any([AbortSignal.timeout(ms), signal]) : AbortSignal.timeout(ms));

/** Gemini(@google/genai) 전송. SDK는 이 함수 안에서만 불러온다 */
export function geminiTransport(apiKey: string): LlmTransport {
  let clientPromise: Promise<import("@google/genai").GoogleGenAI> | undefined;
  // 사진 입력은 v1beta에서만 받는다(분류 스크립트 전용) → 사진이 있을 때만 베타 클라이언트
  let betaPromise: Promise<import("@google/genai").GoogleGenAI> | undefined;
  return async ({ model, system, input, schema, temperature, timeoutMs, images, signal }) => {
    const client = images?.length
      ? await (betaPromise ??= import("@google/genai").then(({ GoogleGenAI }) => new GoogleGenAI({ apiKey, apiVersion: "v1beta" })))
      : await (clientPromise ??= import("@google/genai").then(({ GoogleGenAI }) => new GoogleGenAI({ apiKey })));
    const res = await client.interactions.create(
      {
        model,
        // 사진이 있으면 글 + 사진 묶음으로(사진은 낮은 해상도로 충분: 분류만 한다)
        input: images?.length
          ? [{ type: "text" as const, text: input }, ...images.map((im) => ({ type: "image" as const, data: im.data, mime_type: im.mimeType, resolution: "low" }))]
          : input,
        system_instruction: system,
        response_format: { type: "text", mime_type: "application/json", schema },
        generation_config: { temperature },
        store: false,
      },
      { timeout_ms: timeoutMs, signal: withTimeout(timeoutMs, signal) },
    );
    return res.output_text ?? "";
  };
}

/** OpenAI 기본 모델(빠르고 싸다: 100만 토큰당 입력 $0.10 · 출력 $0.50) */
export const DEFAULT_OPENAI_MODEL = "gpt-6-luna";

/** OpenAI 엄격 모드에서 쓸 수 없는 검사어(받은 답은 원래 스키마로 ajv가 다시 검사한다) */
const UNSUPPORTED = new Set(["minLength", "maxLength", "minProperties", "maxProperties", "uniqueItems", "allOf", "not", "if", "then", "else", "default", "examples"]);

/**
 * OpenAI 엄격 스키마로 바꾼다: 모든 객체에 additionalProperties: false, 모든 속성을 required로,
 * 원래 선택이던 속성은 null도 받게(받은 뒤 stripNulls로 뺀다). 원본은 바꾸지 않는다.
 */
export function toStrictSchema(schema: JsonSchema): JsonSchema {
  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk);
    if (!node || typeof node !== "object") return node;
    const src = node as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(src)) {
      if (UNSUPPORTED.has(k)) continue;
      if (k === "properties" || k === "required" || k === "additionalProperties") continue;
      out[k] = k === "enum" || k === "const" ? v : walk(v);
    }
    if (src.type === "object" || src.properties) {
      const props = (src.properties ?? {}) as Record<string, unknown>;
      const required = new Set((src.required as string[] | undefined) ?? []);
      out.properties = Object.fromEntries(
        Object.entries(props).map(([name, sub]) => [name, required.has(name) ? walk(sub) : { anyOf: [walk(sub), { type: "null" }] }]),
      );
      out.required = Object.keys(props);
      out.additionalProperties = false;
    }
    return out;
  };
  return walk(schema) as JsonSchema;
}

/** 객체 안의 null 값을 뺀다(엄격 스키마에서 '없음'을 null로 받기 때문) */
export function stripNulls(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripNulls);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== null)
      .map(([k, v]) => [k, stripNulls(v)]),
  );
}

/**
 * OpenAI Responses API 전송(패키지 없이 fetch). 엄격 JSON 스키마로 받고, 대화는 저장하지 않는다(store: false).
 * 보내는 것은 시스템 지시·입력 조건·장소 정보뿐(개인정보 없음).
 */
export function openaiTransport(apiKey: string, fetchImpl: typeof fetch = fetch): LlmTransport {
  const strictCache = new WeakMap<JsonSchema, JsonSchema>();
  return async ({ model, system, input, schema, temperature, timeoutMs, images, signal }) => {
    let strict = strictCache.get(schema);
    if (!strict) {
      strict = toStrictSchema(schema);
      strictCache.set(schema, strict);
    }
    const content = images?.length
      ? [{ role: "user", content: [{ type: "input_text", text: input }, ...images.map((im) => ({ type: "input_image", image_url: `data:${im.mimeType};base64,${im.data}`, detail: "low" }))] }]
      : input;
    const res = await fetchImpl("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        instructions: system,
        input: content,
        text: { format: { type: "json_schema", name: "result", schema: strict, strict: true } },
        // 생각(추론) 단계 없이 바로 답하게: 빠르고, 이 단계에서만 temperature를 받는다
        reasoning: { effort: "none" },
        temperature,
        store: false,
      }),
      signal: withTimeout(timeoutMs, signal),
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => "")).slice(0, 200);
      throw Object.assign(new Error(`OpenAI HTTP ${res.status} ${detail}`), { status: res.status });
    }
    const body = (await res.json()) as { output_text?: string; output?: { type?: string; content?: { type?: string; text?: string }[] }[] };
    const text =
      body.output_text ??
      (body.output ?? [])
        .flatMap((o) => (o.type === "message" ? (o.content ?? []) : []))
        .filter((c) => c.type === "output_text")
        .map((c) => c.text ?? "")
        .join("");
    try {
      return JSON.stringify(stripNulls(JSON.parse(text)));
    } catch {
      return text; // JSON이 아니면 그대로(형식 오류로 다시 요청)
    }
  };
}

let shared: LlmClient | undefined;
/** 일정 만들기에서 이 시간이 지나도 답이 없으면 다음 제공자에도 같은 요청(평소 Gemini는 한 번에 1~9초) */
export const DEFAULT_HEDGE_MS = 15_000;
/**
 * 환경변수로 만든 공용 클라이언트. 제공자 순서는 Gemini(빠름) → OpenAI(붐빌 때 받쳐 줌).
 * - Gemini가 503·429·시간 초과면 다시 기다리지 않고 바로 OpenAI로, 15초(AI_HEDGE_MS) 넘게 답이 없으면 OpenAI에도 보내 먼저 온 답을 쓴다.
 * - 키가 있는 제공자만 쓴다. 순서를 바꾸려면 AI_ORDER=openai,gemini. 둘 다 없으면 오류.
 */
export function getLlm(): LlmClient {
  if (shared) return shared;
  const env = (k: string) => process.env[k]?.trim() || undefined;
  const make: Record<string, () => LlmProvider | undefined> = {
    gemini: () => {
      const key = env("GEMINI_API_KEY");
      return key ? { name: "gemini", transport: geminiTransport(key), models: { fast: env("GEMINI_MODEL_FAST"), read: env("GEMINI_MODEL_READ") } } : undefined;
    },
    openai: () => {
      const key = env("OPENAI_API_KEY");
      const model = env("OPENAI_MODEL") ?? DEFAULT_OPENAI_MODEL;
      return key ? { name: "openai", transport: openaiTransport(key), models: { fast: model, read: env("OPENAI_MODEL_READ") ?? model } } : undefined;
    },
  };
  const order = (env("AI_ORDER") ?? "gemini,openai").split(",").map((x) => x.trim().toLowerCase());
  const providers = order.map((name) => make[name]?.()).filter((p): p is LlmProvider => !!p);
  if (!providers.length) throw new Error("GEMINI_API_KEY 또는 OPENAI_API_KEY가 없어요(.env.local 또는 배포 환경변수).");
  shared = createLlm({ providers, hedgeMs: Number(env("AI_HEDGE_MS")) || DEFAULT_HEDGE_MS });
  return shared;
}
