// 유형별 조건 계산 (docs/planning.md '사용자 유형과 필수 조건' 표).
// 필수(must): 하나라도 어기면 후보에서 빠진다 / 선호(prefer): 점수에만 반영 / 주의(caution): 남기되 경고 문구.
// 여러 유형을 고르면 항목마다 가장 엄격한 등급을 쓴다(must > prefer > caution).

import type { AccessKey } from "../types";
import type { PlanInput, TravelerType } from "../plan/types";

export type ConditionLevel = "must" | "prefer" | "caution";

export type ConditionInput = Pick<
  PlanInput,
  "travelers" | "transport" | "disabledPermit" | "conditionOverrides" | "walkLimit"
>;

export const CONDITION_LABELS: Record<AccessKey, string> = {
  step_free_entrance: "계단·단차 없는 진입",
  elevator: "엘리베이터 (층이 있는 곳)",
  slope: "급한 경사 없음",
  surface: "포장길·데크 노면",
  accessible_toilet: "장애인 화장실",
  diaper_nursing: "수유실·기저귀 교환대",
  disabled_parking: "장애인 전용 주차구역",
  rest_area: "쉴 곳 (벤치·쉼터)",
  rental_wheelchair: "휠체어 대여",
  rental_stroller: "유모차 대여",
};

export const TRAVELER_LABELS: Record<TravelerType, string> = {
  wheelchair: "휠체어",
  elder: "어르신",
  stroller: "유모차",
};

// 장애인 전용 주차는 표지 차량일 때만 따로 처리한다.
type BaseKey = Exclude<AccessKey, "disabled_parking">;

const TABLE: Record<TravelerType, Partial<Record<BaseKey, ConditionLevel>>> = {
  wheelchair: {
    step_free_entrance: "must",
    elevator: "must",
    slope: "must",
    surface: "must",
    accessible_toilet: "must",
    rental_wheelchair: "prefer",
  },
  stroller: {
    step_free_entrance: "caution",
    elevator: "must",
    slope: "prefer",
    surface: "prefer",
    diaper_nursing: "prefer",
    rest_area: "prefer",
    rental_stroller: "prefer",
  },
  elder: {
    step_free_entrance: "caution",
    elevator: "prefer",
    slope: "caution",
    surface: "caution",
    accessible_toilet: "prefer",
    rest_area: "prefer",
    rental_wheelchair: "prefer",
  },
};

const RANK: Record<ConditionLevel, number> = { must: 3, prefer: 2, caution: 1 };

/** 화면 표시 순서 */
const ORDER: AccessKey[] = [
  "step_free_entrance",
  "elevator",
  "slope",
  "surface",
  "accessible_toilet",
  "disabled_parking",
  "diaper_nursing",
  "rest_area",
  "rental_wheelchair",
  "rental_stroller",
];

interface DefaultCondition {
  key: AccessKey;
  level: ConditionLevel;
  /** 이 등급을 만든 유형(화면 표시용) */
  who: string;
}

/** 유형·이동수단만으로 정해지는 기본 조건(사용자 조정 전) */
function defaults(input: ConditionInput): DefaultCondition[] {
  const found = new Map<AccessKey, { level: ConditionLevel; who: TravelerType[] }>();
  for (const t of input.travelers) {
    for (const [key, level] of Object.entries(TABLE[t]) as [BaseKey, ConditionLevel][]) {
      const cur = found.get(key);
      if (!cur || RANK[level] > RANK[cur.level]) found.set(key, { level, who: [t] });
      else if (cur.level === level) cur.who.push(t);
    }
  }

  const result: DefaultCondition[] = [...found].map(([key, v]) => ({
    key,
    level: v.level,
    who: v.who.map((t) => TRAVELER_LABELS[t]).join("·"),
  }));

  // 장애인 전용 주차: 자가용 + 표지 차량이고, 휠체어 또는 (장애 등록) 어르신일 때만 필수. 유모차는 대상이 아니다.
  const parkingEligible = input.travelers.some((t) => t === "wheelchair" || t === "elder");
  if (input.transport === "car" && input.disabledPermit && parkingEligible) {
    result.push({ key: "disabled_parking", level: "must", who: "표지 차량" });
  }

  return result.sort((a, b) => ORDER.indexOf(a.key) - ORDER.indexOf(b.key));
}

export interface ResolvedConditions {
  must: AccessKey[];
  prefer: AccessKey[];
  caution: AccessKey[];
  /** 주차장→입구, 관람 동선과 비교할 거리(m). null = 확인 안 함 */
  walkLimitM: number | null;
}

/** 엔진이 쓰는 최종 조건. 사용자가 끈 필수는 선호로, 끈 선호는 빠진다. */
export function resolveConditions(input: ConditionInput): ResolvedConditions {
  const out: ResolvedConditions = { must: [], prefer: [], caution: [], walkLimitM: null };
  for (const c of defaults(input)) {
    const on = input.conditionOverrides[c.key] ?? true;
    if (c.level === "must") (on ? out.must : out.prefer).push(c.key);
    else if (c.level === "prefer") {
      if (on) out.prefer.push(c.key);
    } else out.caution.push(c.key);
  }
  if (input.travelers.includes("elder")) out.walkLimitM = input.walkLimit;
  return out;
}

export interface ConditionRow {
  key: AccessKey;
  label: string;
  who: string;
  on: boolean;
}

/** 3단계 화면용 목록. 주의 항목은 화면에 묻지 않고 결과 카드에서 경고로만 보여준다. */
export function conditionRows(input: ConditionInput): {
  must: ConditionRow[];
  prefer: ConditionRow[];
  showWalkLimit: boolean;
} {
  const rows = defaults(input).map((c) => ({
    level: c.level,
    row: { key: c.key, label: CONDITION_LABELS[c.key], who: c.who, on: input.conditionOverrides[c.key] ?? true },
  }));
  return {
    must: rows.filter((r) => r.level === "must").map((r) => r.row),
    prefer: rows.filter((r) => r.level === "prefer").map((r) => r.row),
    showWalkLimit: input.travelers.includes("elder"),
  };
}
