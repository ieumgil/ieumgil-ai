// 날짜별 시작·끝(시각과 지점). 기획: 첫날은 도착 지점에서 시작 시각, 마지막 날은 떠나는 곳에서 마치는 시각,
// 1박 이상이면 첫날은 숙소 18:00 도착, 중간 날은 숙소 09:30~18:00, 둘째 날부터 숙소에서 출발.
// 2박 3일은 밤마다 숙소가 다를 수 있다: 2일째는 첫째 밤 숙소 → 둘째 밤 숙소(옮기는 날), 3일째는 둘째 밤 숙소에서 출발.

import { nightsBetween } from "../plan/dates";
import type { PlanInput } from "../plan/types";
import { ARRIVAL_COORDS, LODGING_COORDS } from "./travel";
import { toMin, type DayFrame, type Point } from "./types";

export const MID_DAY_START = "09:30";
export const MID_DAY_END = "18:00";

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export type FrameInput = Pick<PlanInput, "startDate" | "endDate" | "arrival" | "departure" | "startTime" | "endTime" | "lodging"> & Partial<Pick<PlanInput, "lodging2">>;

/** lodgingPoint: 숙소가 '미정'일 때 정한 가정 위치(없으면 도착 지점으로 임시) */
export function buildFrames(input: FrameInput, lodgingPoint?: Point): { frames: DayFrame[]; lodging?: Point; lodgingAssumed: boolean } {
  if (!input.startDate || !input.endDate || !input.arrival) throw new Error("날짜와 도착 지점이 필요해요");
  const nights = nightsBetween(input.startDate, input.endDate);
  const arrival = ARRIVAL_COORDS[input.arrival];
  const departure = input.departure === "same" ? arrival : ARRIVAL_COORDS[input.departure];

  if (nights === 0) {
    return { frames: [{ date: input.startDate, startMin: toMin(input.startTime), endMin: toMin(input.endTime), start: arrival, end: departure }], lodgingAssumed: false };
  }

  const lodgingAssumed = !input.lodging || input.lodging === "미정";
  const lodging = lodgingAssumed ? (lodgingPoint ?? { ...arrival, id: "lodging-assumed", name: "숙소(미정, 도착 지점 근처로 임시 가정)" }) : LODGING_COORDS[input.lodging as keyof typeof LODGING_COORDS];

  // 밤마다 숙소: 둘째 밤이 '같음'이면 첫째 밤 그대로, '미정'이면 첫째 밤 숙소 근처로 가정
  const second = input.lodging2 ?? "same";
  const night2: Point =
    second === "same" ? lodging : second === "미정" ? { ...lodging, id: "lodging2-assumed", name: "숙소(미정, 첫째 밤 숙소 근처로 가정)" } : LODGING_COORDS[second];
  const nightsAt = [lodging, night2];
  const at = (night: number) => nightsAt[Math.min(night, nightsAt.length - 1)];

  const frames: DayFrame[] = [];
  for (let i = 0; i <= nights; i++) {
    const date = addDays(input.startDate, i);
    const first = i === 0;
    const last = i === nights;
    frames.push({
      date,
      startMin: toMin(first ? input.startTime : MID_DAY_START),
      endMin: toMin(last ? input.endTime : MID_DAY_END),
      start: first ? arrival : at(i - 1),
      end: last ? departure : at(i),
    });
  }
  return { frames, lodging, lodgingAssumed };
}
