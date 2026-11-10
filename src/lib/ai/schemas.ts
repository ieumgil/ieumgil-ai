// LLM 출력 JSON 스키마. 같은 객체를 Gemini(response_format.schema)와 ajv(llm.ts 재검사)에 함께 쓴다.
// Gemini는 스키마 일부만 지킨다: enum·required·minItems·maxItems는 지키고 minLength 등은 무시 → 앱에서 다시 검사.
// 근거 id는 호출마다 넘겨준 목록으로 enum을 고정해, 문장 전체나 지어낸 id를 돌려주지 못하게 한다.

import type { JsonSchema } from "../llm";
import { VERDICTS } from "./guards";

/** 넘겨준 근거 id만 고를 수 있는 배열. 목록이 비면 빈 배열만 허용 */
export function evidenceArray(ids: readonly string[], maxItems = 5): JsonSchema {
  if (ids.length === 0) return { type: "array", items: { type: "string" }, maxItems: 0 };
  return { type: "array", items: { type: "string", enum: [...new Set(ids)] }, maxItems };
}

/**
 * ② 판단: 후보 여러 곳을 한 호출에 묶는다.
 * strict=true(기본): 받은 답 검사용(근거 id enum, 개수 제한). strict=false: 모델에 보낼 가벼운 스키마
 * (근거 enum·중첩 배열 길이 제한을 넣으면 Gemini가 400 "too many states"를 낸다 — ① 읽기에서 확인)
 */
export function judgeSchema(placeIds: readonly string[], evidenceIds: readonly string[], strict = true): JsonSchema {
  return {
    type: "object",
    properties: {
      judgments: {
        type: "array",
        ...(strict ? { minItems: placeIds.length, maxItems: placeIds.length } : {}),
        items: {
          type: "object",
          properties: {
            placeId: { type: "string", enum: [...placeIds] },
            verdict: { type: "string", enum: [...VERDICTS] },
            reasons: strict ? { type: "array", items: { type: "string" }, minItems: 1, maxItems: 3 } : { type: "array", items: { type: "string" } },
            evidence: strict ? evidenceArray(evidenceIds) : { type: "array", items: { type: "string" } },
          },
          required: ["placeId", "verdict", "reasons", "evidence"],
          additionalProperties: false,
        },
      },
    },
    required: ["judgments"],
    additionalProperties: false,
  };
}
