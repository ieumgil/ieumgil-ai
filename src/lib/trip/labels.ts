// 결과·확정 화면이 같이 쓰는 표시 값
import type { ChipStatus } from "@/components/ui/StatusChip";
import type { Verdict } from "../ai/guards";
import type { OptionView } from "./view";

/** 판단 → 상태 칩(색 + 기호 + 글자) */
export const VERDICT_CHIP: Record<Verdict, ChipStatus> = { 적합: "ok", 주의: "caution", "확인 필요": "caution", 부적합: "blocked" };

/** 판정 칩 글자: 적합·주의여도 전화로 물어볼 것이 있으면 함께 적는다(판단 규칙 11/10: '모름'은 판단을 막지 않고 질문으로) */
export function verdictText(verdict: Verdict, needsCall: boolean): string {
  return needsCall && (verdict === "적합" || verdict === "주의") ? `${verdict} · 전화로 확인할 것 있음` : verdict;
}

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

/** 장소 이름을 짧게: 앞의 지역명·괄호·'·' 뒤를 뺀다("강릉 오죽헌·시립박물관" → "오죽헌") */
export function shortName(name: string): string {
  return name.replace(/^(강릉|속초|동해)\s+/, "").replace(/\(.*?\)/g, "").split("·")[0].trim();
}

/** 안 비교용 한 줄 요약: "강릉 · 오죽헌 → 대도호부 관아 → 안목해변 외 3곳" */
export function routeSummary(o: Pick<OptionView, "days">, trip: { places: Record<string, { name: string; region: string }> }): string {
  const ids = o.days.flatMap((d) => d.items.flatMap((i) => (i.kind === "visit" ? [i.placeId] : [])));
  const regions = [...new Set(ids.map((id) => trip.places[id]?.region).filter(Boolean))];
  const head = ids.slice(0, 3).map((id) => shortName(trip.places[id]?.name ?? id));
  const rest = ids.length - head.length;
  return `${regions.join("·")} · ${head.join(" → ")}${rest > 0 ? ` 외 ${rest}곳` : ""}`;
}
