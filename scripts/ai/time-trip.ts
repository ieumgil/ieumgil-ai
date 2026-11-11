// 일정 만들기 시간 재기(실제 Gemini): AI 호출마다 시작·끝 시각, 시도 횟수, 실패 이유를 찍는다.
// "느려졌다"를 코드 탓인지 Gemini 응답 탓인지 가르는 데 쓴다.
// 사용: npx tsx scripts/ai/time-trip.ts [1박|2박|당일]
import evidence from "../../data/evidence.json";
import places from "../../data/places.json";
import { makeTrip } from "../../src/lib/ai/trip";
import { estimateLeg } from "../../src/lib/engine/travel";
import { createLlm, geminiTransport, type LlmClient, type LlmRequest } from "../../src/lib/llm";
import { EMPTY_PLAN, type PlanInput } from "../../src/lib/plan/types";
import type { Place } from "../../src/lib/types";

try {
  process.loadEnvFile(".env.local");
} catch {
  // 환경변수로 이미 설정된 경우
}
const length = process.argv[2] ?? "1박";
const endDate = { 당일: "2026-12-12", "1박": "2026-12-13", "2박": "2026-12-14" }[length] ?? "2026-12-13";
const input: PlanInput = { ...EMPTY_PLAN, startDate: "2026-12-12", endDate, arrival: "gangneung-station", transport: "car", travelers: ["wheelchair"], lodging: "강릉", categories: ["바다·해변", "전시·박물관", "역사·문화"], pace: "normal" };

async function main() {
  const base = createLlm({ transport: geminiTransport(process.env.GEMINI_API_KEY!.trim()), models: { fast: process.env.GEMINI_MODEL_FAST?.trim() } });
  const t0 = Date.now();
  const sec = (t: number) => ((t - t0) / 1000).toFixed(1);
  const llm: LlmClient = {
    async json<T>(req: LlmRequest) {
      const s = Date.now();
      const r = await base.json<T>(req);
      console.log(`  [${sec(s)}s → ${sec(Date.now())}s] ${req.task} ${r.ok ? "ok" : `실패 ${r.message.slice(0, 90)}`} · 시도 ${r.attempts}`);
      return r;
    },
  };
  const r = await makeTrip(llm, input, places as unknown as Place[], evidence, estimateLeg, (ev) => {
    if (ev.stage === "log") console.log(`    · ${ev.text}`);
  });
  console.log(`총 ${Math.round((Date.now() - t0) / 1000)}초 · 안 ${r.options.length}개 · AI ${r.calls}회 · ${length}`);
}

main().catch((err) => {
  console.error(`✕ ${(err as Error).message}`);
  process.exit(1);
});
