// 입력 4단계에서 받는 값. 개인정보(이름·연락처)는 없다.
import type { Category, Region } from "../types";

export type TravelerType = "wheelchair" | "elder" | "stroller";
export type Transport = "car" | "taxi";
export type Pace = "slow" | "normal" | "busy";
export type LodgingRegion = Region | "미정";
/** 한 번에 걸을 수 있는 거리(m). null = 제한 없음 */
export type WalkLimit = 100 | 300 | 500 | null;

export const ARRIVAL_POINTS = [
  { id: "gangneung-station", label: "강릉역" },
  { id: "gangneung-bus", label: "강릉 고속버스터미널" },
  { id: "sokcho-bus", label: "속초 고속버스터미널" },
  { id: "donghae-station", label: "동해역" },
] as const;
export type ArrivalId = (typeof ARRIVAL_POINTS)[number]["id"];

export interface PlanInput {
  /** yyyy-mm-dd */
  startDate: string | null;
  /** yyyy-mm-dd, 당일이면 startDate와 같다 */
  endDate: string | null;
  arrival: ArrivalId | null;
  /** 마지막 날 떠나는 곳. "same"이면 도착 지점과 같음 */
  departure: ArrivalId | "same";
  transport: Transport | null;
  /** 장애인 사용 자동차 표지(자가용일 때만 의미 있음) */
  disabledPermit: boolean;
  /** 첫날 시작 시각 HH:MM */
  startTime: string;
  /** 마지막 날 마치는 시각 HH:MM */
  endTime: string;
  /** 1박 이상일 때만: 첫째 밤 숙소 지역 */
  lodging: LodgingRegion | null;
  /** 2박 3일일 때만: 둘째 밤 숙소 지역. "same"이면 첫째 밤과 같음 */
  lodging2: LodgingRegion | "same";
  travelers: TravelerType[];
  /** 사용자가 기본값에서 바꾼 조건 켜짐/꺼짐 */
  conditionOverrides: Partial<Record<string, boolean>>;
  walkLimit: WalkLimit;
  categories: Category[];
  pace: Pace;
  /** 꼭 가고 싶은 곳(장소 id) */
  mustVisit: string[];
}

export const EMPTY_PLAN: PlanInput = {
  startDate: null,
  endDate: null,
  arrival: null,
  departure: "same",
  transport: null,
  disabledPermit: false,
  startTime: "10:00",
  endTime: "17:00",
  lodging: null,
  lodging2: "same",
  travelers: [],
  conditionOverrides: {},
  walkLimit: 300,
  categories: [],
  pace: "normal",
  mustVisit: [],
};
