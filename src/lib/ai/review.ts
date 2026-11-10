// ③ 평가자: 완성된 안마다 피로도·시간 여유·취향 반영을 1~5점으로 본다(docs/ai-plan.md v3).
// 코드가 계산한 타임라인(시각·이동·쉬는 시간·화장실 정보)을 그대로 넘기고, 평가자는 점수와 한 줄 이유만 낸다.

import type { PlanOption } from "./plan";
import { toHHMM } from "../engine/types";
import type { LlmClient, JsonSchema } from "../llm";
import type { PlanInput } from "../plan/types";
import type { Place } from "../types";

export interface Review {
  optionId: string;
  fatigue: number;
  slack: number;
  taste: number;
  comment: string;
  /** 2점 이하가 있으면 고칠 방향 */
  improve?: string;
}

const REVIEW_SYSTEM = `너는 관광약자 여행 일정을 점검하는 평가자다. JSON으로만 답한다.
안마다 1~5점(5가 가장 좋음)으로 매긴다.
- fatigue(피로도): 이동·걷기·연속 관람이 이 여행자에게 무리 없는가. 쉬는 시간과 화장실이 있는 곳 사이 간격도 본다.
- slack(시간 여유): 마치는 시각과 운영시간에 쫓기지 않는가.
- taste(취향): 좋아하는 분야와 꼭 가고 싶은 곳이 반영됐는가.
comment는 쉬운 존댓말 한 문장. 2점 이하가 있으면 improve에 고칠 방향을 한 문장으로 쓴다. 일정에 없는 사실을 만들지 않는다.`;

function schema(ids: string[]): JsonSchema {
  const score = { type: "integer", minimum: 1, maximum: 5 };
  return {
    type: "object",
    properties: {
      reviews: {
        type: "array",
        items: {
          type: "object",
          properties: { optionId: { type: "string", enum: ids }, fatigue: score, slack: score, taste: score, comment: { type: "string" }, improve: { type: "string" } },
          required: ["optionId", "fatigue", "slack", "taste", "comment"],
        },
      },
    },
    required: ["reviews"],
  };
}

export function describeOption(o: PlanOption, placesById: Map<string, Place>): string {
  const lines = [`## ${o.id}안 "${o.title}" — ${o.summary}`];
  o.check.timelines.forEach((tl, i) => {
    lines.push(`${i + 1}일째 ${tl.date} (${o.check.fits[i]}, 이동 ${tl.travelMin}분)`);
    for (const it of tl.items) {
      if (it.kind === "visit") {
        const p = placesById.get(it.placeId)!;
        const toilet = p.access.accessible_toilet.value;
        lines.push(`  ${toHHMM(it.arriveMin)}~${toHHMM(it.departMin)} ${p.name_ko}(${p.category}, 장애인 화장실 ${toilet})`);
      } else if (it.kind === "lunch") lines.push(`  ${toHHMM(it.startMin)} 점심·휴식 60분`);
      else if (it.kind === "rest") lines.push(`  ${toHHMM(it.startMin)} 휴식`);
    }
  });
  return lines.join("\n");
}

export async function reviewOptions(llm: LlmClient, input: PlanInput, options: PlanOption[], placesById: Map<string, Place>): Promise<Review[]> {
  if (options.length === 0) return [];
  const who = input.travelers.join(", ");
  const res = await llm.json<{ reviews: Review[] }>({
    task: "review",
    system: REVIEW_SYSTEM,
    input: `여행자: ${who} · 좋아하는 분야: ${input.categories.join(", ") || "없음"}\n\n${options.map((o) => describeOption(o, placesById)).join("\n\n")}`,
    schema: schema(options.map((o) => o.id)),
    temperature: 0.2,
  });
  return res.ok ? res.data.reviews : [];
}
