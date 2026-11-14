// 시간만 조금 넘친 안을 코드가 살린다(AI를 다시 부르지 않음).
// 1) 걸린 날의 체류를 장소별 권장 최소로 줄인다 2) 그래도 넘치면 걸린 장소(운영시간) 또는 그날 뒤쪽 장소를 하나씩 뺀다(최대 maxDrops곳).
// 꼭 가고 싶은 곳(keep)은 빼지 않는다. 시간 말고 다른 위반(중복·부적합·휴무 등)이 있으면 고치지 않는다(null → AI에 다시 요청).
// 고친 안도 같은 검사(checkPlan)를 통과해야 쓴다.

import { checkPlan, type CheckContext, type CheckResult, type ViolationKind } from "./check";
import type { PlanDraft } from "./types";

export interface Repaired {
  draft: PlanDraft;
  check: CheckResult;
  /** 고친 내용(화면 'AI 설계 과정'·진행 기록) */
  notes: string[];
}

const TIMING: ReadonlySet<ViolationKind> = new Set(["운영시간", "하루범위"]);
const onlyTiming = (c: CheckResult) => c.violations.every((v) => TIMING.has(v.kind));

export function repairTiming(draft: PlanDraft, ctx: CheckContext, keep: ReadonlySet<string>, maxDrops = 2): Repaired | null {
  let cur = draft;
  let check = checkPlan(cur, ctx);
  if (check.ok) return { draft: cur, check, notes: [] };
  if (!onlyTiming(check)) return null;
  const notes: string[] = [];

  // 1) 걸린 날의 체류를 권장 최소로
  const days = new Set(check.violations.map((v) => v.day - 1));
  cur = {
    days: cur.days.map((d, i) =>
      days.has(i) ? { ...d, stops: d.stops.map((s) => ({ ...s, stayMin: ctx.placesById.get(s.placeId)?.stay_min ?? s.stayMin })) } : d,
    ),
  };
  check = checkPlan(cur, ctx);
  notes.push(`${[...days].map((i) => i + 1).join("·")}일째 머무는 시간을 줄여 시간을 맞췄어요`);

  // 2) 그래도 넘치면 한 곳씩 뺀다
  for (let n = 0; !check.ok && n < maxDrops; n++) {
    if (!onlyTiming(check)) return null;
    const v = check.violations[0];
    const di = v.day - 1;
    const stops = cur.days[di].stops;
    let idx = v.kind === "운영시간" && v.placeId && !keep.has(v.placeId) ? stops.findIndex((s) => s.placeId === v.placeId) : -1;
    if (idx < 0) idx = stops.findLastIndex((s) => !keep.has(s.placeId));
    if (idx < 0 || stops.length <= 1) return null;
    const name = ctx.placesById.get(stops[idx].placeId)?.name_ko ?? stops[idx].placeId;
    cur = { days: cur.days.map((d, i) => (i === di ? { ...d, stops: d.stops.filter((_, k) => k !== idx) } : d)) };
    notes.push(`${v.day}일째에서 '${name}' 빼고 시간을 맞췄어요`);
    check = checkPlan(cur, ctx);
  }
  return check.ok ? { draft: cur, check, notes } : null;
}
