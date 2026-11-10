// 일정 검사(코드). LLM이 어떤 안을 내도 이 검사를 통과한 안만 화면에 나간다.
// 위반(violations)은 안을 고쳐야 하는 것, 경고(warnings)는 안에 남기되 화면에 표시할 것.

import type { Verdict } from "../ai/guards";
import type { Place } from "../types";
import { closedOn } from "./closed";
import { computeDay, opening, type DayTimeline, type TimelineOptions } from "./timeline";
import { toHHMM, type DayFrame, type PlanDraft, type TravelFn } from "./types";

export type ViolationKind = "후보아님" | "판단부적합" | "중복" | "휴무" | "운영시간" | "체류범위" | "하루범위" | "날짜";
export type WarningKind = "확인 필요" | "운영시간 모름" | "휴무일 확인" | "추정 이동시간";

export interface Violation {
  day: number;
  placeId?: string;
  kind: ViolationKind;
  message: string;
}
export interface PlanWarning {
  day: number;
  placeId?: string;
  kind: WarningKind;
  message: string;
}

/** 날짜마다 여유 / 빠듯 / 부족(체류 최소~최대 범위로 계산) */
export type DayFit = "여유" | "빠듯" | "부족";

export interface CheckResult {
  ok: boolean;
  violations: Violation[];
  warnings: PlanWarning[];
  timelines: DayTimeline[];
  fits: DayFit[];
}

export interface CheckContext {
  frames: DayFrame[];
  placesById: Map<string, Place>;
  travel: TravelFn;
  options: TimelineOptions;
  /** ② 판단(안전 하한 적용 후). 없으면 판단 검사를 건너뛴다 */
  verdicts?: Map<string, Verdict>;
  /** 후보로 넘긴 장소 id. 있으면 그 밖의 장소는 위반 */
  candidateIds?: Set<string>;
}

export function checkPlan(draft: PlanDraft, ctx: CheckContext): CheckResult {
  const violations: Violation[] = [];
  const warnings: PlanWarning[] = [];
  const timelines: DayTimeline[] = [];
  const fits: DayFit[] = [];
  const seen = new Map<string, number>();

  if (draft.days.length !== ctx.frames.length || draft.days.some((d, i) => d.date !== ctx.frames[i].date)) {
    violations.push({ day: 0, kind: "날짜", message: `날짜가 여행 날짜(${ctx.frames.map((f) => f.date).join(", ")})와 달라요` });
    return { ok: false, violations, warnings, timelines, fits };
  }

  draft.days.forEach((day, di) => {
    const frame = ctx.frames[di];
    const n = di + 1;
    for (const stop of day.stops) {
      const place = ctx.placesById.get(stop.placeId);
      if (!place || (ctx.candidateIds && !ctx.candidateIds.has(stop.placeId))) {
        violations.push({ day: n, placeId: stop.placeId, kind: "후보아님", message: `${stop.placeId}는 후보 장소가 아니에요` });
        continue;
      }
      if (seen.has(place.id)) {
        violations.push({ day: n, placeId: place.id, kind: "중복", message: `${place.name_ko}가 ${seen.get(place.id)}일째에도 있어요` });
      }
      seen.set(place.id, n);
      const v = ctx.verdicts?.get(place.id);
      if (v === "부적합") violations.push({ day: n, placeId: place.id, kind: "판단부적합", message: `${place.name_ko}는 조건에 맞지 않아요(부적합)` });
      if (v === "확인 필요") warnings.push({ day: n, placeId: place.id, kind: "확인 필요", message: `${place.name_ko}: 출발 전에 전화로 확인할 것이 있어요` });
      const closed = closedOn(place.hours, frame.date);
      if (closed.closed) violations.push({ day: n, placeId: place.id, kind: "휴무", message: `${place.name_ko}는 ${frame.date}에 쉬어요(${closed.reason})` });
      if (closed.unknown.length) warnings.push({ day: n, placeId: place.id, kind: "휴무일 확인", message: `${place.name_ko}: 휴무일 확인 필요(${closed.unknown.join(", ")})` });
      if (stop.stayMin < place.stay_min || stop.stayMin > place.stay_max) {
        violations.push({ day: n, placeId: place.id, kind: "체류범위", message: `${place.name_ko} 체류 ${stop.stayMin}분은 권장 범위(${place.stay_min}~${place.stay_max}분) 밖이에요` });
      }
    }

    const known = day.stops.filter((s) => ctx.placesById.has(s.placeId));
    const tl = computeDay(frame, { ...day, stops: known }, ctx.placesById, ctx.travel, ctx.options);
    timelines.push(tl);
    if (tl.estimatedTravel) warnings.push({ day: n, kind: "추정 이동시간", message: "이동 시간은 직선거리로 어림한 추정치예요" });

    for (const item of tl.items) {
      if (item.kind !== "visit") continue;
      const place = ctx.placesById.get(item.placeId)!;
      const o = opening(place, frame.date);
      if (!o.known) {
        warnings.push({ day: n, placeId: place.id, kind: "운영시간 모름", message: `${place.name_ko}: 운영시간 확인 필요` });
        continue;
      }
      if (item.arriveMin > o.lastEntry) {
        violations.push({ day: n, placeId: place.id, kind: "운영시간", message: `${place.name_ko}에 ${toHHMM(item.arriveMin)} 도착 예정이라 입장 마감(${toHHMM(o.lastEntry)})을 넘어요` });
      } else if (item.departMin > o.close) {
        violations.push({ day: n, placeId: place.id, kind: "운영시간", message: `${place.name_ko}는 ${toHHMM(o.close)}에 닫는데 ${toHHMM(item.departMin)}까지 머무는 일정이에요` });
      }
    }
    if (tl.endMin > frame.endMin) {
      violations.push({ day: n, kind: "하루범위", message: `${n}일째가 ${toHHMM(tl.endMin)}에 끝나 마치는 시각(${toHHMM(frame.endMin)})을 넘어요` });
    }

    // 여유/빠듯/부족: 체류 최소·최대로 다시 계산
    const at = (pick: "stay_min" | "stay_max") =>
      computeDay(frame, { ...day, stops: known.map((s) => ({ ...s, stayMin: ctx.placesById.get(s.placeId)![pick] })) }, ctx.placesById, ctx.travel, ctx.options).endMin;
    const minEnd = at("stay_min");
    const maxEnd = at("stay_max");
    fits.push(maxEnd <= frame.endMin ? "여유" : minEnd <= frame.endMin ? "빠듯" : "부족");
  });

  return { ok: violations.length === 0, violations, warnings, timelines, fits };
}
