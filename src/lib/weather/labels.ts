// 날씨 문구는 코드의 고정 문구만 쓴다(D-06: LLM이 쓰지 않는다). 하늘 상태는 기호(아이콘)와 글자를 함께 보여 준다(D-08, 색만으로 구분 금지).

import type { Region } from "../types";
import type { DayForecast, WeatherPayload } from "./types";

export const SKY_LABEL: Record<1 | 3 | 4, string> = { 1: "맑음", 3: "구름많음", 4: "흐림" };

/** 강수확률 앞에 붙는 낱말: 눈 → 눈, 비/눈 → 비·눈, 그 밖(비·소나기·종류 모름) → 비 */
export function precipWord(precip: DayForecast["precip"]): string {
  if (precip === "눈") return "눈";
  if (precip === "비/눈") return "비·눈";
  return "비";
}

/** approx(TMN·TMX 대신 TMP로 채운 값, 오늘은 남은 시각만의 값)이면 '약'을 붙여 확정 값처럼 보이지 않게 한다 */
function tempPart(tmin: number | null, tmax: number | null, approx = false): string | null {
  const mark = approx ? "약 " : "";
  if (tmin !== null && tmax !== null) return `${mark}${Math.round(tmin)}~${Math.round(tmax)}℃`;
  if (tmin !== null) return `최저 ${mark}${Math.round(tmin)}℃`;
  if (tmax !== null) return `최고 ${mark}${Math.round(tmax)}℃`;
  return null;
}

/** 예: "강릉 · 흐림 · 비 20% · 8~14℃", 대략 값이면 "… · 약 8~14℃" — 값이 없는 조각은 빠진다 */
export function weatherLine(region: Region, day: DayForecast): string {
  const parts: string[] = [region];
  if (day.sky !== null) parts.push(SKY_LABEL[day.sky]);
  if (day.pop !== null) parts.push(`${precipWord(day.precip)} ${day.pop}%`);
  const temp = tempPart(day.tmin, day.tmax, day.approxTemp === true);
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

/** 날짜 상태 문구(D-09): 날씨 줄 대신 보이는 고정 안내 */
export const PAST_TEXT = "지난 일정이라 예보를 보여 주지 않아요";
export const OUT_OF_RANGE_TEXT = "아직 예보 없음 · 출발 약 10일 전부터 나와요";
export const MISSING_TEXT = "예보 없음";

/** "M월 D일 H시"(앞자리 0 없이). 입력은 YYYYMMDD + HH */
function issuedAt(yyyymmdd: string, hh: string): string {
  return `${Number(yyyymmdd.slice(4, 6))}월 ${Number(yyyymmdd.slice(6, 8))}일 ${Number(hh)}시`;
}

/** 화면 아래 출처 한 줄(D-11). 단기·중기 중 늦은 발표 시각을 쓴다. 둘 다 없으면 null */
export function sourceLine(payload: WeatherPayload | null): string | null {
  if (!payload) return null;
  const { short, mid } = payload.asOf;
  const shortKey = short ? `${short.baseDate}${short.baseTime}` : null;
  if (!shortKey && !mid) return null;
  const kind = shortKey && mid ? "단기·중기예보" : shortKey ? "단기예보" : "중기예보";
  const latest = shortKey && mid ? (shortKey >= mid ? shortKey : mid) : (shortKey ?? mid!);
  return `날씨: 기상청 ${kind}(${issuedAt(latest.slice(0, 8), latest.slice(8, 10))} 발표). 예보는 바뀔 수 있어요.`;
}
