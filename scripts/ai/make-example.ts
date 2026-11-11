// 시작 화면 '예시 루트 바로 보기'용 결과를 실제 Gemini로 한 번 만들어 저장한다(src/lib/trip/example-trip.json).
// 화면은 이 파일을 그대로 열어 AI를 부르지 않는다. 안이 3개 나올 때까지 최대 3번 시도한다.
// 사용: npx tsx scripts/ai/make-example.ts
import { writeFileSync } from "node:fs";
import evidence from "../../data/evidence.json";
import places from "../../data/places.json";
import { makeTrip } from "../../src/lib/ai/trip";
import { estimateLeg } from "../../src/lib/engine/travel";
import { createLlm, geminiTransport } from "../../src/lib/llm";
import { EMPTY_PLAN, type PlanInput } from "../../src/lib/plan/types";
import { toTripView } from "../../src/lib/trip/view";
import type { Place } from "../../src/lib/types";

try {
  process.loadEnvFile(".env.local");
} catch {
  // 환경변수로 이미 설정된 경우
}

const OUT = "src/lib/trip/example-trip.json";
// 보여 주기 좋은 조건: 휠체어 · 자가용 + 장애인 표지 · 1박 2일(토~일) · 강릉 · 꼭 가고 싶은 곳 오죽헌
export const EXAMPLE_INPUT: PlanInput = {
  ...EMPTY_PLAN,
  startDate: "2026-12-19",
  endDate: "2026-12-20",
  arrival: "gangneung-station",
  transport: "car",
  disabledPermit: true,
  travelers: ["wheelchair"],
  lodging: "강릉",
  categories: ["바다·해변", "역사·문화", "전시·박물관"],
  pace: "normal",
  mustVisit: ["GN12"],
};

async function main() {
  const llm = createLlm({ transport: geminiTransport(process.env.GEMINI_API_KEY!.trim()), models: { fast: process.env.GEMINI_MODEL_FAST?.trim() } });
  const ps = places as unknown as Place[];
  let best: ReturnType<typeof toTripView> | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const t0 = Date.now();
    const r = await makeTrip(llm, EXAMPLE_INPUT, ps, evidence, estimateLeg, (ev) => {
      if (ev.stage === "log") console.log(`  ${ev.text}`);
    });
    console.log(`시도 ${attempt}: 안 ${r.options.length}개 · AI ${r.calls}회 · ${Math.round((Date.now() - t0) / 1000)}초${r.usedFallback ? " · 규칙 일정" : ""}`);
    const view = toTripView(r, EXAMPLE_INPUT, ps, evidence);
    if (!r.usedFallback && (!best || view.options.length > best.options.length)) best = view;
    if (best && best.options.length >= 3) break;
  }
  if (!best) throw new Error("AI 일정을 만들지 못했어요. 잠시 뒤 다시 실행해 주세요.");
  // 예시는 따로 보관(사용자 일정의 확정·바꾼 장소 기록과 섞이지 않게) — createdAt이 "example"로 시작
  best.createdAt = "example-2026-12-19";
  writeFileSync(OUT, JSON.stringify(best, null, 1) + "\n");
  console.log(`✓ ${OUT}: 안 ${best.options.length}개`);
}

main().catch((err) => {
  console.error(`✕ ${(err as Error).message}`);
  process.exit(1);
});
