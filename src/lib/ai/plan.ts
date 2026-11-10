// ③ 계획(요청할 때): 성격이 다른 일정 2~3안을 한 번에 받는다(docs/ai-plan.md v3).
// LLM이 정하는 것: 장소 선택·날짜 배분·순서·머무는 시간·쉬는 곳·이유·주의·확인 질문. 시각은 쓰지 않는다.
// 코드가 하는 것: 체류를 범위 안으로 맞춤 → 시각 계산 → 검사(check.ts) → 걸린 안만 위반 내용을 돌려줘 다시 요청(최대 2회)
//                → 끝까지 못 통과한 안은 뺀다 → 하나도 없으면 규칙 일정 1안.

import { checkPlan, type CheckContext, type CheckResult } from "../engine/check";
import type { Candidate } from "../engine/filter";
import { opening } from "../engine/timeline";
import { toHHMM, type DayFrame, type PlanDraft, type TravelFn } from "../engine/types";
import type { LlmClient, JsonSchema } from "../llm";
import type { PlanInput } from "../plan/types";
import type { Place } from "../types";
import type { Judgment } from "./guards";

export type Strategy = "여유" | "취향" | "실내" | "확인 적게";

const STRATEGY_TEXT: Record<Strategy, string> = {
  여유: "여유롭게: 장소 수를 줄이고 쉬는 시간을 넉넉히, 이동이 짧게",
  취향: "좋아하는 곳 중심: 여행자가 고른 분야의 장소를 우선",
  실내: "비 와도 괜찮게: 전시·박물관 같은 실내 장소 위주",
  "확인 적게": "확인할 것이 적게: 판단이 '적합'인 장소 위주(출발 전 확인 질문이 적은 안)",
};

export interface PlanOption {
  id: string;
  strategy: Strategy | "규칙";
  title: string;
  summary: string;
  draft: PlanDraft;
  cautions: { placeId: string; text: string }[];
  checkBeforeGo: { placeId: string; question: string }[];
  check: CheckResult;
  /** ai = LLM이 짠 안(검사 통과), rule = 규칙 일정 */
  source: "ai" | "rule";
  /** 다시 요청한 횟수 */
  fixes: number;
  /** 검사에서 걸렸다가 고친 위반(화면 'AI 설계 과정') */
  fixedViolations: string[];
}

interface RawOption {
  id: string;
  title: string;
  summary: string;
  days: { date: string; stops: { placeId: string; stayMin: number; why: string; restAfter?: boolean }[] }[];
  cautions: { placeId: string; text: string }[];
  checkBeforeGo: { placeId: string; question: string }[];
}

export function pickStrategies(input: PlanInput, candidates: Candidate[], judgments: Map<string, Judgment>): Strategy[] {
  const out: Strategy[] = ["여유"];
  if (input.categories.length > 0) out.push("취향");
  const indoor = candidates.filter((c) => c.place.category === "전시·박물관" && judgments.get(c.place.id)?.verdict !== "부적합").length;
  if (indoor >= 3) out.push("실내");
  else out.push("확인 적게");
  return out.slice(0, 3);
}

function optionSchema(ids: string[], placeIds: string[], dates: string[], strict: boolean): JsonSchema {
  const pid = strict ? { type: "string", enum: placeIds } : { type: "string" };
  return {
    type: "object",
    properties: {
      options: {
        type: "array",
        ...(strict ? { minItems: 1, maxItems: ids.length } : {}),
        items: {
          type: "object",
          properties: {
            id: { type: "string", enum: ids },
            title: { type: "string" },
            summary: { type: "string" },
            days: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  date: { type: "string", enum: dates },
                  stops: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: { placeId: pid, stayMin: { type: "integer" }, why: { type: "string" }, restAfter: { type: "boolean" } },
                      required: ["placeId", "stayMin", "why"],
                    },
                  },
                },
                required: ["date", "stops"],
              },
            },
            cautions: { type: "array", items: { type: "object", properties: { placeId: pid, text: { type: "string" } }, required: ["placeId", "text"] } },
            checkBeforeGo: { type: "array", items: { type: "object", properties: { placeId: pid, question: { type: "string" } }, required: ["placeId", "question"] } },
          },
          required: ["id", "title", "summary", "days", "cautions", "checkBeforeGo"],
        },
      },
    },
    required: ["options"],
  };
}

export const PLAN_SYSTEM = `너는 관광약자 여행 일정을 짜는 도우미다. JSON으로만 답한다.
규칙:
1. 후보 목록의 장소 id만 쓴다. 같은 장소를 두 번 넣지 않는다. 판단이 '부적합'인 곳은 넣지 않는다.
2. 시각(몇 시 도착 등)은 쓰지 않는다. 장소·순서·날짜·머무는 시간(stayMin, 분)만 정한다. 시각은 프로그램이 계산한다.
3. stayMin은 그 장소의 권장 체류 범위 안에서 고른다.
4. 하루 장소 수는 일정 밀도를 따른다. 이동이 짧도록 가까운 곳끼리 묶고, 같은 분야만 이어지지 않게 섞는다.
5. '적합'·'주의' 장소를 먼저 쓰고, 모자라면 '확인 필요' 장소를 넣는다. '확인 필요'를 넣으면 checkBeforeGo에 물어볼 질문을 쓴다.
6. why는 이 여행자 기준으로 왜 골랐는지 쉬운 존댓말 한 문장. 판단 이유와 정리된 값에 없는 시설을 지어내지 않는다.
7. 안마다 정해 준 방향(전략)을 따르고, 안끼리 장소가 절반 넘게 겹치지 않게 한다.`;

function candidateLines(candidates: Candidate[], judgments: Map<string, Judgment>, frames: DayFrame[], travel: TravelFn): string {
  return candidates
    .map((c) => {
      const p = c.place;
      const j = judgments.get(p.id);
      const o = opening(p, frames[0].date);
      const hours = p.hours.always_open ? "상시 개방" : o.known ? `${toHHMM(o.open)}~${toHHMM(o.close)}(입장 마감 ${toHHMM(o.lastEntry)})` : "운영시간 모름";
      const closed = p.hours.closed_weekdays?.length ? ` · 휴무 ${p.hours.closed_weekdays.join("")}요일` : "";
      const fromStart = travel(frames[0].start, { id: p.id, name: p.name_ko, lat: p.lat, lng: p.lng }).minutes;
      return `- ${p.id} ${p.name_ko} | ${p.region} ${p.category} | 판단 ${j?.verdict ?? "?"}: ${j?.reasons[0] ?? ""} | 체류 ${p.stay_min}~${p.stay_max}분 | ${hours}${closed} | 여행 ${c.openDates.length === frames.length ? "모든 날" : c.openDates.join(",") + "만"} 염 | 출발점에서 약 ${fromStart}분`;
    })
    .join("\n");
}

function travelTable(candidates: Candidate[], travel: TravelFn): string {
  const pts = candidates.map((c) => ({ id: c.place.id, name: c.place.name_ko, lat: c.place.lat, lng: c.place.lng }));
  const head = `     ${pts.map((p) => p.id.padStart(5)).join("")}`;
  const rows = pts.map((a) => `${a.id.padEnd(5)}${pts.map((b) => String(travel(a, b).minutes).padStart(5)).join("")}`);
  return [head, ...rows].join("\n");
}

function frameLines(frames: DayFrame[], input: PlanInput): string {
  const per = { slow: "여유롭게(하루 2~3곳)", normal: "보통(하루 3~4곳)", busy: "많이(하루 4~5곳)" }[input.pace];
  return [
    `일정 밀도: ${per}`,
    ...frames.map((f, i) => `${i + 1}일째 ${f.date}: ${f.start.name}에서 ${toHHMM(f.startMin)} 출발 → ${f.end.name}에 ${toHHMM(f.endMin)}까지 도착`),
  ].join("\n");
}

export interface PlanArgs {
  input: PlanInput;
  frames: DayFrame[];
  candidates: Candidate[];
  judgments: Map<string, Judgment>;
  placesById: Map<string, Place>;
  travel: TravelFn;
  options: CheckContext["options"];
  /** 진행 기록 한 줄(화면 '만드는 중') */
  onLog?: (text: string, tone?: "info" | "ok" | "fix") => void;
}

/** 위반 종류를 짧은 말로(진행 기록용) */
const VIOLATION_TEXT: Record<string, string> = {
  운영시간: "운영시간을 넘는 곳이 있어",
  하루범위: "마치는 시각을 넘어서",
  휴무: "쉬는 날인 곳이 있어",
  중복: "같은 곳이 두 번 들어가서",
  후보아님: "후보에 없는 곳이 있어",
  판단부적합: "조건에 맞지 않는 곳이 있어",
  체류범위: "머무는 시간이 맞지 않아",
  날짜: "날짜가 맞지 않아",
};

function toDraft(raw: RawOption, placesById: Map<string, Place>): PlanDraft {
  return {
    days: raw.days.map((d) => ({
      date: d.date,
      stops: d.stops.map((s) => {
        const p = placesById.get(s.placeId);
        // 체류를 장소 범위 안으로 맞춘다(ai-plan: 코드가 맞춤)
        const stayMin = p ? Math.min(p.stay_max, Math.max(p.stay_min, Math.round(s.stayMin))) : s.stayMin;
        return { placeId: s.placeId, stayMin, restAfter: s.restAfter, why: s.why };
      }),
    })),
  };
}

export interface PlanResult {
  options: PlanOption[];
  calls: number;
  failedCalls: number;
  /** 검사를 못 통과해 뺀 안 */
  dropped: { id: string; violations: string[] }[];
}

/** hints: 안 id별 추가 지시(평가자의 개선 방향 등), ids: 안 이름(기본 A, B, C) */
export async function planOptions(
  llm: LlmClient,
  args: PlanArgs,
  strategies: Strategy[],
  maxFixes = 2,
  hints: Record<string, string> = {},
  ids: string[] = strategies.map((_, i) => String.fromCharCode(65 + i)),
): Promise<PlanResult> {
  const { input, frames, candidates, judgments, placesById, travel } = args;
  const usable = candidates.filter((c) => judgments.get(c.place.id)?.verdict !== "부적합");
  const placeIds = usable.map((c) => c.place.id);
  const dates = frames.map((f) => f.date);
  const ctx: CheckContext = {
    frames,
    placesById,
    travel,
    options: args.options,
    candidateIds: new Set(placeIds),
    verdicts: new Map([...judgments].map(([k, v]) => [k, v.verdict])),
  };
  const categories = input.categories.join(", ") || "고르지 않음";
  const base = [
    "[여행]",
    frameLines(frames, input),
    `좋아하는 분야: ${categories}`,
    `꼭 가고 싶은 곳: ${input.mustVisit.filter((id) => placeIds.includes(id)).join(", ") || "없음"}`,
    "",
    "[후보 장소]",
    candidateLines(usable, judgments, frames, travel),
    "",
    "[장소 사이 차량 이동시간(분, 추정)]",
    travelTable(usable, travel),
  ].join("\n");

  let calls = 0;
  let failedCalls = 0;
  const ask = async (want: { id: string; strategy: Strategy; fix?: string }[]) => {
    calls++;
    const lines = want.map((w) => {
      const hint = hints[w.id] ? `\n  [평가자 의견을 반영하라] ${hints[w.id]}` : "";
      const fix = w.fix ? `\n  [이전 ${w.id}안의 검사 결과를 고쳐라] ${w.fix}` : "";
      return `- ${w.id}안: ${STRATEGY_TEXT[w.strategy]}${hint}${fix}`;
    });
    const wantIds = want.map((w) => w.id);
    const res = await llm.json<{ options: RawOption[] }>({
      task: "plan",
      system: PLAN_SYSTEM,
      input: `${base}\n\n[만들 안]\n${lines.join("\n")}`,
      schema: optionSchema(wantIds, placeIds, dates, false),
      check: optionSchema(wantIds, placeIds, dates, true),
      temperature: 0.5,
    });
    if (!res.ok) failedCalls++;
    return res.ok ? res.data.options : [];
  };

  const final: PlanOption[] = [];
  const dropped: PlanResult["dropped"] = [];
  let pending = ids.map((id, i) => ({ id, strategy: strategies[i], fix: undefined as string | undefined, fixes: 0, fixed: [] as string[] }));

  const log = args.onLog ?? (() => {});
  for (let round = 0; round <= maxFixes && pending.length > 0; round++) {
    log(round === 0 ? `${pending.map((p) => p.id).join("·")}안을 짜고 있어요` : `${pending.map((p) => p.id).join("·")}안을 다시 짜고 있어요`);
    const got = await ask(pending);
    const next: typeof pending = [];
    for (const want of pending) {
      const raw = got.find((o) => o.id === want.id);
      if (!raw) {
        if (round === maxFixes) {
          dropped.push({ id: want.id, violations: ["안을 받지 못했어요"] });
          log(`${want.id}안은 받지 못해 뺐어요`, "fix");
        } else next.push({ ...want, fixes: want.fixes + 1 });
        continue;
      }
      const draft = toDraft(raw, placesById);
      const check = checkPlan(draft, ctx);
      if (!check.ok) {
        const why = VIOLATION_TEXT[check.violations[0].kind] ?? "검사에 걸려";
        log(round === maxFixes ? `${want.id}안은 끝까지 ${why} 뺐어요` : `${want.id}안: ${why} 고치는 중`, "fix");
      } else {
        const n = draft.days.reduce((a, d) => a + d.stops.length, 0);
        log(`${want.id}안 "${raw.title.replace(/^[A-Z]안\s*[:：.]\s*/, "")}" 검사 통과 · ${n}곳`, "ok");
      }
      if (check.ok) {
        // 안에 실제로 들어간 장소의 주의·질문만 남기고, ② 판단의 '모름' 질문을 더한다
        const inPlan = new Set(draft.days.flatMap((d) => d.stops.map((s) => s.placeId)));
        const questions = [
          ...raw.checkBeforeGo.filter((c) => inPlan.has(c.placeId)),
          ...[...inPlan].flatMap((id) => (judgments.get(id)?.checkBeforeGo ?? []).map((question) => ({ placeId: id, question }))),
        ];
        final.push({
          id: want.id,
          strategy: want.strategy,
          title: raw.title.replace(/^[A-Z]안\s*[:：.]\s*/, ""),
          summary: raw.summary,
          draft,
          cautions: raw.cautions.filter((c) => inPlan.has(c.placeId)),
          checkBeforeGo: questions.filter((q, i) => questions.findIndex((x) => x.placeId === q.placeId && x.question === q.question) === i),
          check,
          source: "ai",
          fixes: want.fixes,
          fixedViolations: want.fixed,
        });
      } else if (round === maxFixes) {
        dropped.push({ id: want.id, violations: check.violations.map((v) => v.message) });
      } else {
        const msgs = check.violations.map((v) => `${v.day}일째: ${v.message}`);
        next.push({ ...want, fix: msgs.join(" / "), fixes: want.fixes + 1, fixed: [...want.fixed, ...msgs] });
      }
    }
    pending = next;
  }

  // 안끼리 장소가 절반 넘게 겹치면 뒤의 안을 뺀다(평가자 단계에서 다시 만들 수 있게 표시)
  const deduped: PlanOption[] = [];
  for (const o of final) {
    const ids = new Set(o.draft.days.flatMap((d) => d.stops.map((s) => s.placeId)));
    const overlap = deduped.some((d) => {
      const other = d.draft.days.flatMap((x) => x.stops.map((s) => s.placeId));
      const same = other.filter((x) => ids.has(x)).length;
      return same > Math.min(ids.size, other.length) / 2;
    });
    if (overlap) {
      dropped.push({ id: o.id, violations: ["다른 안과 장소가 절반 넘게 겹쳐요"] });
      log(`${o.id}안은 다른 안과 장소가 많이 겹쳐서 뺐어요`, "fix");
    }
    else deduped.push(o);
  }
  return { options: deduped, calls, failedCalls, dropped };
}
