// ② 판단(요청할 때): "이 사람이 여기서 관광할 수 있나"를 LLM이 장소 전체 근거로 판단한다(docs/ai-plan.md v3).
// - 후보(최대 20곳)를 한 호출에 묶어 3번 돌린다(온도를 조금씩 다르게) → 자기 일관성으로 확신도.
// - 판단마다 코드 가드(applyGuards): 근거 id가 그 장소 문단에 없으면 버림, 안전 하한보다 낙관적이면 내림.
// - 3번 모두 실패한 장소는 규칙 판단(엄격)으로 대체한다.

import type { Candidate } from "../engine/filter";
import type { ResolvedConditions } from "../engine/conditions";
import { CONDITION_LABELS } from "../engine/conditions";
import type { LlmClient } from "../llm";
import type { PlanInput } from "../plan/types";
import { ACCESS_KEYS } from "../types";
import { applyGuards, combineSamples, moreConservative, ruleJudgment, type Judgment, type RawJudgment, type Verdict } from "./guards";
import { judgeSchema } from "./schemas";

export interface EvidenceItem {
  id: string;
  label: string;
  text: string;
}
export type EvidenceIndex = Record<string, EvidenceItem[]>;

const TRAVELER_TEXT = { wheelchair: "휠체어 이용자", elder: "보행이 불편한 어르신", stroller: "유모차 동반" } as const;

export const JUDGE_SYSTEM = `너는 관광약자(휠체어 이용자, 보행이 불편한 어르신, 유모차 동반 가족)의 여행을 돕는 도우미다.
질문은 하나다: "이 사람이 이 관광지에서 관광할 수 있나?" 장소 전체 근거를 보고 판단한다. JSON으로만 답한다.

판단 값:
- 적합: 근거로 보아 이 사람이 관광할 수 있다(일부 정보가 없어도 핵심이 확인되면 적합).
- 주의: 관광할 수 있지만 조심할 점이 있다(일부 구간만 가능, 화장실이 멀다, 오르막 등). 이유에 무엇을 조심할지 쓴다.
- 확인 필요: 이 사람에게 결정적인 정보가 없어 판단할 수 없다(예: 휠체어인데 들어갈 수 있는지 모름).
- 부적합: 근거로 보아 이 사람에게 어렵다.

규칙:
1. 근거(evidence)는 그 장소의 문단 id만 쓴다. 문단에 없는 시설·시간·거리를 만들지 않는다.
2. 정보가 없는 항목을 '없다'로 단정하지 않는다. 모르는 것은 모르는 것이다.
3. reasons는 1~3개, 이 사람 기준으로 쉬운 존댓말 한 문장씩("~해요", "~어요"). 장소 이름은 반복하지 않는다.
4. 장소마다 하나씩, 받은 장소를 모두 판단한다.`;

function profileText(input: PlanInput, cond: ResolvedConditions): string {
  const who = input.travelers.map((t) => TRAVELER_TEXT[t]).join(" + ");
  const must = cond.must.map((k) => CONDITION_LABELS[k]).join(", ") || "없음";
  const caution = cond.caution.map((k) => CONDITION_LABELS[k]).join(", ") || "없음";
  const walk = cond.walkLimitM !== null ? `한 번에 걸을 수 있는 거리 약 ${cond.walkLimitM}m` : "";
  const car = input.transport === "car" ? `자가용${input.disabledPermit ? "(장애인 사용 자동차 표지 있음)" : ""}` : "택시";
  return [`여행자: ${who}`, `이동: ${car}`, `꼭 필요한 조건: ${must}`, `주의해서 볼 것: ${caution}`, walk].filter(Boolean).join("\n");
}

function placeBlock(c: Candidate, evidence: EvidenceItem[]): string {
  const p = c.place;
  const summary = ACCESS_KEYS.map((k) => {
    const a = p.access[k];
    return `${CONDITION_LABELS[k]}=${a.value}${a.note ? `(${a.note})` : ""}`;
  }).join(" · ");
  const lines = evidence.map((e) => `[${e.id}] (${e.label}) ${e.text}`);
  return [`## ${p.id} ${p.name_ko} (${p.category})`, `정리된 값: ${summary}`, ...lines].join("\n");
}

export interface JudgeResult {
  judgments: Map<string, Judgment>;
  /** LLM 호출 수와 실패 수(평가·화면 '설계 과정'용) */
  calls: number;
  failedCalls: number;
  /** 하한 때문에 LLM 판단보다 보수적으로 바뀐 장소 수 */
  floorApplied: number;
}

export async function judgePlaces(
  llm: LlmClient,
  args: { input: PlanInput; conditions: ResolvedConditions; candidates: Candidate[]; evidence: EvidenceIndex },
  opts: { samples?: number; onSample?: (done: number, total: number, ok: boolean) => void } = {},
): Promise<JudgeResult> {
  const { input, conditions, candidates, evidence } = args;
  const samples = opts.samples ?? 3;
  let done = 0;
  const placeIds = candidates.map((c) => c.place.id);
  const allEvidence = [...new Set(candidates.flatMap((c) => (evidence[c.place.id] ?? []).map((e) => e.id)))];
  const prompt = [
    "[여행자 조건]",
    profileText(input, conditions),
    "",
    `[후보 ${candidates.length}곳] 각 장소의 문단 id만 근거로 쓴다.`,
    ...candidates.map((c) => placeBlock(c, evidence[c.place.id] ?? [])),
  ].join("\n\n");

  const temps = [0.2, 0.6, 0.9].slice(0, samples);
  const results = await Promise.all(
    temps.map((temperature) =>
      llm.json<{ judgments: RawJudgment[] }>({
        task: "judge",
        system: JUDGE_SYSTEM,
        input: prompt,
        schema: judgeSchema(placeIds, allEvidence, false),
        check: judgeSchema(placeIds, allEvidence, true),
        temperature,
      }).then((r) => {
        opts.onSample?.(++done, temps.length, r.ok);
        return r;
      }),
    ),
  );

  const perPlace = new Map<string, Judgment[]>();
  for (const r of results) {
    if (!r.ok) continue;
    for (const raw of r.data.judgments) {
      const c = candidates.find((x) => x.place.id === raw.placeId);
      if (!c) continue;
      const g = applyGuards(raw, c.place, conditions, (evidence[c.place.id] ?? []).map((e) => e.id));
      if (g.source !== "ai") continue; // 근거가 맞지 않은 판단은 버린다
      perPlace.set(c.place.id, [...(perPlace.get(c.place.id) ?? []), g]);
    }
  }

  const judgments = new Map<string, Judgment>();
  let floorApplied = 0;
  for (const c of candidates) {
    const got = perPlace.get(c.place.id) ?? [];
    const combined = combineSamples(got.map((g) => g.verdict));
    if (!combined) {
      judgments.set(c.place.id, ruleJudgment(c.place, conditions));
      continue;
    }
    const verdict: Verdict = moreConservative(combined.verdict, c.floor.verdict);
    const pick = got.find((g) => g.verdict === verdict) ?? got[0];
    if (got.some((g) => g.floorApplied)) floorApplied++;
    judgments.set(c.place.id, {
      ...pick,
      verdict,
      evidence: [...new Set(got.flatMap((g) => g.evidence))],
      confidence: combined.confidence,
      checkBeforeGo: c.floor.asks,
    });
  }
  return { judgments, calls: results.length, failedCalls: results.filter((r) => !r.ok).length, floorApplied };
}
