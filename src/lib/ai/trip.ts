// 요청 하나의 전체 흐름(나중에 /api/plan이 이 함수를 부른다). docs/ai-plan.md v3 '일정 흐름'.
// 1) 규칙 일정(LLM 없이): 날짜 틀·후보·대체 일정 2) LLM에 넘길 후보 최대 20곳 고르기(날마다 출발점 근처 고루)
// 3) ② 판단 4) ③ 일정 2~3안 + 검사·수정 5) 평가자 6) 안이 하나도 없으면 규칙 일정 1안
// 전체 시간 한도(기본 90초, 배포 서버는 120초에 끊는다): 판단은 한도의 절반까지, 남은 시간이 모자라면
// 덜 중요한 단계부터 건너뛴다(평가 후 다시 짜기 → 평가 → 걸린 안 다시 짜기). 검사를 통과한 안만 나가는 건 그대로.

import { rulePlan, type RulePlan } from "../engine/fallback";
import type { Candidate } from "../engine/filter";
import { haversineKm } from "../engine/travel";
import { timelineOptions } from "../engine/timeline";
import type { DayFrame, TravelFn } from "../engine/types";
import type { LlmClient } from "../llm";
import type { PlanInput } from "../plan/types";
import type { Place } from "../types";
import { judgePlaces, type EvidenceIndex, type JudgeResult } from "./judge";
import { pickStrategies, planOptions, type PlanOption, type PlanResult, type Strategy } from "./plan";
import { reviewOptions, type Review } from "./review";

export interface TripResult {
  rule: RulePlan;
  llmCandidates: Candidate[];
  judge?: JudgeResult;
  plan?: PlanResult;
  reviews: Review[];
  /** 화면에 보여줄 안(검사 통과). AI 안이 없으면 규칙 일정 1안 */
  options: PlanOption[];
  usedFallback: boolean;
  calls: number;
  ms: number;
}

/** 날마다 그날 출발점·도착점(숙소를 옮기는 날은 둘이 다르다)에서 가까운 후보를 고루 뽑아 최대 max곳 */
const nearKm = (f: DayFrame, c: Candidate) => Math.min(haversineKm(f.start, c.place), haversineKm(f.end, c.place));

export function selectForLlm(candidates: Candidate[], frames: DayFrame[], max = 20): Candidate[] {
  const picked = new Map<string, Candidate>();
  candidates.filter((c) => c.mustVisit).forEach((c) => picked.set(c.place.id, c));
  const perDay = Math.ceil((max - picked.size) / frames.length);
  for (const f of frames) {
    const near = candidates
      .filter((c) => !picked.has(c.place.id) && c.openDates.includes(f.date))
      .sort((a, b) => b.score - b.tier * 6 - nearKm(f, b) / 2 - (a.score - a.tier * 6 - nearKm(f, a) / 2));
    near.slice(0, perDay).forEach((c) => picked.set(c.place.id, c));
  }
  return [...picked.values()].slice(0, Math.max(max, picked.size));
}

export function ruleOption(rule: RulePlan): PlanOption {
  return {
    id: "R",
    strategy: "규칙",
    title: "기본 일정",
    summary: "AI 설계를 불러오지 못해 규칙으로 만든 일정이에요.",
    draft: rule.draft,
    cautions: [],
    checkBeforeGo: [],
    check: rule.check,
    source: "rule",
    fixes: 0,
    fixedViolations: [],
  };
}

/** 진행 단계(화면 '만드는 중'에 보여준다) */
export type TripStage = "rule" | "judge" | "plan" | "review" | "done";
export type LogTone = "info" | "ok" | "fix";
/** 진행 알림: 단계 시작, 진행 기록 한 줄, 판단할 후보 이름 */
export type TripEvent = { stage: TripStage } | { stage: "log"; text: string; tone: LogTone } | { stage: "candidates"; names: string[] };

/** 일정 만들기 전체 시간 한도(배포 서버 maxDuration 120초보다 넉넉히 짧게) */
export const TRIP_BUDGET_MS = 90_000;
/** 한도에 대한 비율: 판단은 절반까지 · 걸린 안 다시 짜기는 남은 시간이 25% 넘을 때 · 평가는 12% · 평가 후 다시 짜기는 40% */
const SHARE = { judge: 0.5, fix: 0.25, review: 0.12, redo: 0.4 };

export async function makeTrip(
  llm: LlmClient,
  input: PlanInput,
  places: Place[],
  evidence: EvidenceIndex,
  travel: TravelFn,
  onEvent: (ev: TripEvent) => void = () => {},
  opts: { budgetMs?: number } = {},
): Promise<TripResult> {
  const t0 = Date.now();
  const budget = opts.budgetMs ?? TRIP_BUDGET_MS;
  const deadline = t0 + budget;
  const left = () => deadline - Date.now();
  /** 이 시각까지만 기다리는 LLM */
  const until = (end: number): LlmClient => ({ json: (req) => llm.json({ ...req, deadline: Math.min(req.deadline ?? Infinity, end) }) });
  const log = (text: string, tone: LogTone = "info") => onEvent({ stage: "log", text, tone });
  onEvent({ stage: "rule" });
  const rule = rulePlan(input, places, travel);
  const llmCandidates = selectForLlm(rule.filter.candidates, rule.frames, 20);
  const placesById = new Map(places.map((p) => [p.id, p]));
  let calls = 0;
  log(`조건에 맞는 곳 ${rule.filter.candidates.length}곳을 찾았어요${rule.filter.excluded.length ? ` (어려운 곳 ${rule.filter.excluded.length}곳 제외)` : ""}`, "ok");
  log(`그중 동선이 좋은 ${llmCandidates.length}곳을 AI에게 넘겨요`);
  onEvent({ stage: "candidates", names: llmCandidates.map((c) => c.place.name_ko) });

  onEvent({ stage: "judge" });
  const judge = await judgePlaces(
    until(t0 + budget * SHARE.judge),
    { input, conditions: rule.filter.conditions, candidates: llmCandidates, evidence },
    { onSample: (done, total, ok) => log(ok ? `장소 판단 ${done}/${total}번째 끝` : `장소 판단 ${done}/${total}번째는 응답이 오지 않았어요`, ok ? "ok" : "fix") },
  );
  calls += judge.calls;
  if (judge.failedCalls === judge.calls) {
    log("AI 판단을 받지 못해 규칙으로 일정을 만들어요", "fix");
    return { rule, llmCandidates, judge, reviews: [], options: [ruleOption(rule)], usedFallback: true, calls, ms: Date.now() - t0 };
  }
  const counts = new Map<string, number>();
  judge.judgments.forEach((j) => counts.set(j.verdict, (counts.get(j.verdict) ?? 0) + 1));
  log(["적합", "주의", "확인 필요", "부적합"].filter((v) => counts.get(v)).map((v) => `${v} ${counts.get(v)}`).join(" · "), "ok");

  onEvent({ stage: "plan" });
  const strategies = pickStrategies(input, llmCandidates, judge.judgments);
  const canRetry = () => left() > budget * SHARE.fix;
  const plan = await planOptions(
    until(deadline),
    { input, frames: rule.frames, candidates: llmCandidates, judgments: judge.judgments, placesById, travel, options: timelineOptions(input), onLog: log, canRetry },
    strategies,
  );
  calls += plan.calls;

  onEvent({ stage: "review" });
  let reviews: Review[] = [];
  if (plan.options.length && left() > budget * SHARE.review) {
    reviews = await reviewOptions(until(deadline), input, plan.options, placesById);
    calls += 1;
  } else if (plan.options.length) log("시간이 부족해 일정 점검은 건너뛰었어요", "fix");
  for (const r of reviews) log(`${r.optionId}안 점검: 피로도 ${r.fatigue} · 시간 여유 ${r.slack} · 취향 ${r.taste}`, Math.min(r.fatigue, r.slack, r.taste) <= 2 ? "fix" : "ok");

  // 평가 점수 중 2점 이하가 있는 안은 개선 방향을 붙여 1회만 다시 만든다(통과하고 점수가 나아지면 바꾼다)
  const weak = reviews.filter((r) => Math.min(r.fatigue, r.slack, r.taste) <= 2 && plan.options.some((o) => o.id === r.optionId));
  if (weak.length && left() <= budget * SHARE.redo) log("시간이 부족해 점검 의견으로 다시 다듬는 건 건너뛰었어요", "fix");
  else if (weak.length) {
    const hints = Object.fromEntries(weak.map((r) => [r.optionId, r.improve ?? r.comment]));
    const ids = weak.map((r) => r.optionId);
    const strategies2 = ids.map((id) => plan.options.find((o) => o.id === id)!.strategy as Strategy);
    log(`${ids.join("·")}안을 점검 의견대로 한 번 더 다듬어요`, "fix");
    const args = { input, frames: rule.frames, candidates: llmCandidates, judgments: judge.judgments, placesById, travel, options: timelineOptions(input), onLog: log, canRetry };
    const redo = await planOptions(until(deadline), args, strategies2, 1, hints, ids);
    calls += redo.calls;
    if (redo.options.length && left() > budget * SHARE.review) {
      const again = await reviewOptions(until(deadline), input, redo.options, placesById);
      calls += 1;
      const total = (r?: Review) => (r ? r.fatigue + r.slack + r.taste : 0);
      for (const o of redo.options) {
        const i = plan.options.findIndex((x) => x.id === o.id);
        const before = reviews.find((r) => r.optionId === o.id);
        const after = again.find((r) => r.optionId === o.id);
        if (i >= 0 && total(after) > total(before)) {
          plan.options[i] = { ...o, fixes: plan.options[i].fixes + o.fixes + 1, fixedViolations: [...plan.options[i].fixedViolations, `평가자 의견 반영: ${hints[o.id]}`] };
          reviews = [...reviews.filter((r) => r.optionId !== o.id), after!];
        }
      }
    }
  }

  const options = plan.options.length ? plan.options : [ruleOption(rule)];
  return { rule, llmCandidates, judge, plan, reviews, options, usedFallback: plan.options.length === 0, calls, ms: Date.now() - t0 };
}
