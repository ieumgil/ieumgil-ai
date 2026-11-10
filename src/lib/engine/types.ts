// 엔진 공통 타입. LLM(③ 계획)과 규칙 일정(fallback.ts)이 같은 PlanDraft를 내고, 코드가 시각을 계산·검사한다.

/** 일정 초안: 장소·순서·체류만. 시각은 없다(시각은 timeline.ts가 계산) */
export interface PlanStop {
  placeId: string;
  /** 머무는 시간(분). 장소 체류 범위 밖이면 코드가 범위 안으로 맞춘다 */
  stayMin: number;
  /** 이 장소 다음에 쉬는 시간을 둘지 */
  restAfter?: boolean;
}

export interface PlanDayDraft {
  date: string;
  stops: PlanStop[];
}

export interface PlanDraft {
  days: PlanDayDraft[];
}

/** 위치(장소 또는 출발·도착 지점) */
export interface Point {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

/** 하루의 시작·끝 조건 */
export interface DayFrame {
  date: string;
  /** 분(00:00부터). 예: 10:00 → 600 */
  startMin: number;
  endMin: number;
  start: Point;
  end: Point;
}

export interface Leg {
  minutes: number;
  km: number;
  /** true면 직선거리로 어림한 값(카카오 길찾기 결과가 아님) */
  estimated: boolean;
}

/** 두 지점 사이 이동(카카오 표 또는 추정). 결과는 저장하지 않는다(카카오 캐싱 금지) */
export type TravelFn = (from: Point, to: Point) => Leg;

export const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
export const toHHMM = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(Math.round(min % 60)).padStart(2, "0")}`;
