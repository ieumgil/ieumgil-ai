// 결과·확정 화면이 같이 쓰는 표시 값
import type { ChipStatus } from "@/components/ui/StatusChip";
import type { Verdict } from "../ai/guards";
import type { OptionView } from "./view";

/** 판단 → 상태 칩(색 + 기호 + 글자) */
export const VERDICT_CHIP: Record<Verdict, ChipStatus> = { 적합: "ok", 주의: "caution", "확인 필요": "caution", 부적합: "blocked" };

/** '확인 필요'의 이유: 공식 정보가 없는 항목(짧은 이름) */
export const UNKNOWN_LABEL: Record<string, string> = {
  step_free_entrance: "진입로",
  elevator: "엘리베이터",
  slope: "경사",
  surface: "노면",
  accessible_toilet: "장애인 화장실",
  diaper_nursing: "수유실",
  disabled_parking: "장애인 주차",
  rest_area: "쉴 곳",
  rental_wheelchair: "휠체어 대여",
  rental_stroller: "유모차 대여",
  walk_distance: "걷는 거리",
};

/** AI 점검 점수(1~5, 높을수록 좋음)를 말로 */
export function reviewWords(r: NonNullable<OptionView["review"]>): string {
  const body = r.fatigue >= 4 ? "몸 부담 적은 편" : r.fatigue === 3 ? "몸 부담 보통" : "몸 부담 큰 편";
  const time = r.slack >= 4 ? "시간 여유 있음" : r.slack === 3 ? "시간 적당" : "시간 빠듯";
  const taste = r.taste >= 4 ? "취향 잘 맞음" : r.taste === 3 ? "취향 보통" : "취향 덜 맞음";
  return `${body} · ${time} · ${taste}`;
}
