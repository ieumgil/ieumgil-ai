// 결과·확정 화면이 같이 쓰는 표시 값
import type { ChipStatus } from "@/components/ui/StatusChip";
import type { Verdict } from "../ai/guards";

/** 판단 → 상태 칩(색 + 기호 + 글자) */
export const VERDICT_CHIP: Record<Verdict, ChipStatus> = { 적합: "ok", 주의: "caution", "확인 필요": "caution", 부적합: "blocked" };
