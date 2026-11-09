// 단계별로 꼭 채워야 하는 값을 다 채웠는지.
import { nightsBetween } from "./dates";
import type { PlanInput } from "./types";

export const STEPS = [
  { href: "/plan/when", name: "언제, 어디서" },
  { href: "/plan/who", name: "누구와" },
  { href: "/plan/conditions", name: "꼭 필요한 조건" },
  { href: "/plan/taste", name: "좋아하는 곳" },
] as const;

export function nightsOf(p: PlanInput): number | null {
  return p.startDate && p.endDate ? nightsBetween(p.startDate, p.endDate) : null;
}

/** 1단계에서 아직 안 채운 항목. 다음 버튼에 그대로 보여줄 문장이다. */
export function missingWhen(p: PlanInput): string[] {
  const nights = nightsOf(p);
  const missing: string[] = [];
  if (nights === null) missing.push("날짜를 골라 주세요");
  if (!p.arrival) missing.push("도착 지점을 골라 주세요");
  if (!p.transport) missing.push("이동수단을 골라 주세요");
  if (nights !== null && nights > 0 && !p.lodging) missing.push("숙소 지역을 골라 주세요");
  return missing;
}

export const whenDone = (p: PlanInput) => missingWhen(p).length === 0;
export const whoDone = (p: PlanInput) => p.travelers.length > 0;
export const tasteDone = (p: PlanInput) => p.categories.length > 0;

/** 아직 덜 채운 가장 앞 단계(없으면 null) */
export function firstIncompleteStep(p: PlanInput, upTo: number): (typeof STEPS)[number] | null {
  const checks = [whenDone, whoDone, () => true, tasteDone];
  for (let i = 0; i < upTo; i++) if (!checks[i](p)) return STEPS[i];
  return null;
}
