// 실제 Gemini로 일정을 한 번 만들어 결과 화면용 데이터(TripView)를 파일로 저장한다.
// 결과 화면 디자인·E2E 확인 때 LLM을 다시 부르지 않으려고 쓴다(카카오 결과 없음: 이동시간은 직선거리 추정).
// 사용: npx tsx scripts/ai/save-trip-view.ts [출력 파일]   (기본 e2e/fixtures/trip-view.json)
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
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
const out = process.argv[2] ?? "e2e/fixtures/trip-view.json";
const input: PlanInput = {
  ...EMPTY_PLAN,
  startDate: "2026-11-21",
  endDate: "2026-11-22",
  arrival: "gangneung-station",
  transport: "taxi",
  travelers: ["wheelchair"],
  lodging: "강릉",
  categories: ["바다·해변", "역사·문화"],
  mustVisit: ["GN12"],
  pace: "normal",
};

async function main() {
  const llm = createLlm({ transport: geminiTransport(process.env.GEMINI_API_KEY!.trim()), models: { fast: process.env.GEMINI_MODEL_FAST?.trim() } });
  const ps = places as unknown as Place[];
  const r = await makeTrip(llm, input, ps, evidence, estimateLeg, (ev) => console.log(ev.stage === "log" ? `  ${ev.text}` : ev.stage === "candidates" ? `  후보: ${ev.names.join(", ")}` : `단계: ${ev.stage}`));
  const view = toTripView(r, input, ps, evidence);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(view, null, 1) + "\n");
  console.log(`✓ ${out} · 안 ${view.options.length}개 · 호출 ${view.calls}회 · ${Math.round(view.ms / 1000)}초`);
}

main().catch((err) => {
  console.error(`✕ ${(err as Error).message}`);
  process.exit(1);
});
