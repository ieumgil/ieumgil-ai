// 항목별 기본 질문. AI가 '모름'에 질문을 빠뜨렸거나, 근거가 없어 코드가 '모름'으로 바꿀 때 쓴다.
// 전화로 그대로 물어볼 수 있는 쉬운 존댓말로 쓴다.
import type { AccessKey } from "../types";

export const DEFAULT_ASK: Record<AccessKey, string> = {
  step_free_entrance: "주출입구까지 계단이나 턱 없이 들어갈 수 있나요?",
  elevator: "층이 나뉜 곳이 있나요? 있다면 엘리베이터로 오갈 수 있나요?",
  slope: "입구와 관람로에 휠체어로 오르기 힘든 급한 경사가 있나요?",
  surface: "관람로 바닥이 포장길이나 데크인가요, 모래·자갈·흙길이 있나요?",
  accessible_toilet: "장애인 화장실이 있나요? 있다면 어디에 있나요?",
  diaper_nursing: "수유실이나 기저귀 교환대가 있나요?",
  disabled_parking: "장애인 전용 주차구역이 있나요? 몇 면인가요?",
  rest_area: "관람하는 길에 앉아서 쉴 벤치나 쉼터가 있나요?",
  rental_wheelchair: "휠체어를 빌릴 수 있나요?",
  rental_stroller: "유모차를 빌릴 수 있나요?",
};

export const DEFAULT_HOURS_ASK = "운영시간과 입장 마감 시각, 쉬는 날이 어떻게 되나요?";
