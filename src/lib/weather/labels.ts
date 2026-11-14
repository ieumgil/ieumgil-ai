// 날씨 문구는 코드의 고정 문구만 쓴다(D-06: LLM이 쓰지 않는다). 하늘 상태는 기호(아이콘)와 글자를 함께 보여 준다(D-08, 색만으로 구분 금지).

import type { Region } from "../types";
import type { DayForecast } from "./types";

export const SKY_LABEL: Record<1 | 3 | 4, string> = { 1: "맑음", 3: "구름많음", 4: "흐림" };

/** 강수확률 앞에 붙는 낱말: 눈 → 눈, 비/눈 → 비·눈, 그 밖(비·소나기·종류 모름) → 비 */
export function precipWord(precip: DayForecast["precip"]): string {
  if (precip === "눈") return "눈";
  if (precip === "비/눈") return "비·눈";
  return "비";
}

function tempPart(tmin: number | null, tmax: number | null): string | null {
  if (tmin !== null && tmax !== null) return `${Math.round(tmin)}~${Math.round(tmax)}℃`;
  if (tmin !== null) return `최저 ${Math.round(tmin)}℃`;
  if (tmax !== null) return `최고 ${Math.round(tmax)}℃`;
  return null;
}

/** 예: "강릉 · 흐림 · 비 20% · 8~14℃" — 값이 없는 조각은 빠진다 */
export function weatherLine(region: Region, day: DayForecast): string {
  const parts: string[] = [region];
  if (day.sky !== null) parts.push(SKY_LABEL[day.sky]);
  if (day.pop !== null) parts.push(`${precipWord(day.precip)} ${day.pop}%`);
  const temp = tempPart(day.tmin, day.tmax);
  if (temp) parts.push(temp);
  return parts.join(" · ");
}

export type WeatherIconName = "snow" | "rain" | "sun" | "cloud-sun" | "cloud";

/** 줄 앞 아이콘: 눈·비가 하늘 상태보다 앞선다. 하늘 정보도 없으면 null */
export function weatherIcon(day: DayForecast): WeatherIconName | null {
  if (day.precip === "눈" || day.precip === "비/눈") return "snow";
  if (day.precip === "비") return "rain";
  if (day.sky === 1) return "sun";
  if (day.sky === 3) return "cloud-sun";
  if (day.sky === 4) return "cloud";
  return null;
}
