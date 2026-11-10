// LLM 호출은 이 파일 하나로 모은다(원칙: 제공자 교체 가능, docs/ai-plan.md v3).
// - 출력은 항상 JSON 스키마로 받고 ajv로 다시 검사한다(Gemini는 스키마 일부만 지킨다).
// - 형식이 틀리면 오류 내용을 붙여 1회 다시 요청, 그래도 틀리면 버린다(ok: false).
// - 429·5xx·시간 초과는 기다렸다가 다시 시도(지수 대기), 미리 읽기 모델이 끝내 실패하면 빠른 모델로 대체.
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
  schema: JsonSchema;
  tier?: ModelTier;
  temperature?: number;
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
}) => Promise<string>;

export interface LlmOptions {
  transport: LlmTransport;
  models?: Partial<Record<ModelTier, string>>;
  /** 일시 오류일 때 모델마다 추가로 시도하는 횟수 */
  maxRetries?: number;
  timeoutMs?: number;
  baseDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
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

export function createLlm(opts: LlmOptions): LlmClient {
  const models = { ...DEFAULT_MODELS, ...Object.fromEntries(Object.entries(opts.models ?? {}).filter(([, v]) => v)) };
  const maxRetries = opts.maxRetries ?? 2;
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const baseDelay = opts.baseDelayMs ?? 1_000;
  const sleep = opts.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));

  return {
    async json<T>(req: LlmRequest): Promise<LlmResult<T>> {
      const t0 = Date.now();
      const validate = validatorFor(req.schema);
      const chain = req.tier === "read" ? [models.read, models.fast] : [models.fast];
      let attempts = 0;
      let lastMessage = "";

      for (const model of chain) {
        let input = req.input;
        let formatRetried = false;
        for (let retry = 0; retry <= maxRetries; ) {
          attempts++;
          let text: string;
          try {
            text = await opts.transport({ model, system: req.system, input, schema: req.schema, temperature: req.temperature ?? 0.2, timeoutMs });
          } catch (err) {
            const status = statusOf(err);
            lastMessage = `${model}: ${status ?? ""} ${(err as Error).message ?? String(err)}`.slice(0, 300);
            if (!retryable(status)) return { ok: false, error: "request", message: lastMessage, model, ms: Date.now() - t0, attempts };
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

          lastMessage = `${model}: 형식 오류 ${problem}`.slice(0, 300);
          if (formatRetried) return { ok: false, error: "invalid", message: lastMessage, model, ms: Date.now() - t0, attempts };
          formatRetried = true;
          input = `${req.input}\n\n[이전 답의 형식 오류] ${problem}\n주어진 JSON 스키마에 정확히 맞춰 다시 답하라.`;
        }
      }
      return { ok: false, error: "unavailable", message: lastMessage, model: chain[chain.length - 1], ms: Date.now() - t0, attempts };
    },
  };
}

/** Gemini(@google/genai) 전송. SDK는 이 함수 안에서만 불러온다 */
export function geminiTransport(apiKey: string): LlmTransport {
  let clientPromise: Promise<import("@google/genai").GoogleGenAI> | undefined;
  return async ({ model, system, input, schema, temperature, timeoutMs }) => {
    clientPromise ??= import("@google/genai").then(({ GoogleGenAI }) => new GoogleGenAI({ apiKey }));
    const client = await clientPromise;
    const res = await client.interactions.create(
      {
        model,
        input,
        system_instruction: system,
        response_format: { type: "text", mime_type: "application/json", schema },
        generation_config: { temperature },
        store: false,
      },
      { timeout_ms: timeoutMs, signal: AbortSignal.timeout(timeoutMs) },
    );
    return res.output_text ?? "";
  };
}

let shared: LlmClient | undefined;
/** 환경변수(GEMINI_API_KEY, GEMINI_MODEL_FAST/READ)로 만든 공용 클라이언트 */
export function getLlm(): LlmClient {
  if (shared) return shared;
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("GEMINI_API_KEY가 없어요(.env.local 또는 배포 환경변수).");
  shared = createLlm({
    transport: geminiTransport(apiKey),
    models: { fast: process.env.GEMINI_MODEL_FAST?.trim(), read: process.env.GEMINI_MODEL_READ?.trim() },
  });
  return shared;
}
