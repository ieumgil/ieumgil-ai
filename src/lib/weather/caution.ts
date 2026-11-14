// 비·눈 주의(D-10): 그 시의 그날 강수확률이 60% 이상이면 바깥 장소 카드에만 한 줄. 코드 규칙이고 LLM이 쓰지 않는다(D-06).
// D-13: places.json·스키마를 바꾸지 않고 카테고리로 바깥 장소를 정한다. 관광공사 분류 '야외 시설'
// (scripts/tour/evidence.ts isOutdoorClass, 근거 class-1)과 같은지는 tests/weather/caution.test.ts 불변식이 매번 본다.
// 폭염·한파·강풍 주의는 이번 범위 밖이다(D-10 deferred). 화면이 앞에 기호 "!"를 붙이므로 문구에는 넣지 않는다.

import type { Category } from "../types";
import { precipWord } from "./labels";
import type { DayForecast } from "./types";

export const RAIN_POP_THRESHOLD = 60;

export const OUTDOOR_CATEGORIES = ["바다·해변", "자연·산책"] as const;

export function isOutdoorPlace(p: { category: Category }): boolean {
  return (OUTDOOR_CATEGORIES as readonly Category[]).includes(p.category);
}

/** 강수확률이 기준 이상이면 주의 문구, 아니면(값이 없어도) null */
export function rainCaution(day: DayForecast | undefined): string | null {
  if (!day || day.pop === null || day.pop < RAIN_POP_THRESHOLD) return null;
  return `${precipWord(day.precip)} 예보 — 데크·경사로가 미끄러울 수 있어요`;
}
