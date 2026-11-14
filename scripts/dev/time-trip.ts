// 일정 만들기 시간 재기(실제 AI): AI 호출마다 시작·끝 시각, 쓴 모델, 시도 횟수, 실패 이유를 찍는다.
// "느려졌다"를 코드 탓인지 AI 응답 탓인지 가르는 데 쓴다. 서비스와 같은 설정(Gemini 먼저, 붐비거나 늦으면 OpenAI).
// 사용: npx tsx scripts/dev/time-trip.ts [1박|2박|당일] [--gemini|--openai] [--busy]   (한 제공자만, --busy: 일정 많이)
import evidence from "../../data/evidence.json";
import places from "../../data/places.json";
import { makeTrip } from "../../src/lib/ai/trip";
import { estimateLeg } from "../../src/lib/engine/travel";
import { routeLegs } from "../../src/lib/kakao";
import { getLlm, type LlmClient, type LlmRequest } from "../../src/lib/llm";
import { EMPTY_PLAN, type PlanInput } from "../../src/lib/plan/types";
import type { Place } from "../../src/lib/types";

try {
  process.loadEnvFile(".env.local");
} catch {
  // 환경변수로 이미 설정된 경우
}
if (process.argv.includes("--gemini")) delete process.env.OPENAI_API_KEY;
if (process.argv.includes("--openai")) delete process.env.GEMINI_API_KEY;
const length = process.argv.slice(2).find((a) => !a.startsWith("--") && !/^[A-Z]{2}\d/.test(a)) ?? "1박";
// --must GN09,GN67 : 꼭 가고 싶은 곳(둘러보기 화면에서 담은 것과 같음) — 안마다 들어갔는지 찍는다
const mustArg = process.argv.indexOf("--must");
const mustVisit = mustArg > 0 ? process.argv[mustArg + 1].split(",") : [];
const endDate = { 당일: "2026-12-12", "1박": "2026-12-13", "2박": "2026-12-14" }[length] ?? "2026-12-13";
const input: PlanInput = { ...EMPTY_PLAN, startDate: "2026-12-12", endDate, arrival: "gangneung-station", transport: "car", travelers: ["wheelchair"], lodging: "강릉", categories: ["바다·해변", "전시·박물관", "역사·문화"], pace: process.argv.includes("--busy") ? "busy" : "normal", mustVisit };

async function main() {
  const base = getLlm();
  const t0 = Date.now();
  const sec = (t: number) => ((t - t0) / 1000).toFixed(1);
  const llm: LlmClient = {
    async json<T>(req: LlmRequest) {
      const s = Date.now();
      const r = await base.json<T>(req);
      console.log(`  [${sec(s)}s → ${sec(Date.now())}s] ${req.task} ${r.model} ${r.ok ? "ok" : `실패 ${r.message.slice(0, 90)}`} · 시도 ${r.attempts}`);
      return r;
    },
  };
  // 서비스와 같이 카카오 실제 이동시간으로 다시 검사(--no-kakao면 빼고)
  const realLegs = process.argv.includes("--no-kakao") ? undefined : (days: { lat: number; lng: number }[][]) => Promise.all(days.map((pts) => routeLegs(pts)));
  const r = await makeTrip(llm, input, places as unknown as Place[], evidence, estimateLeg, (ev) => {
    if (ev.stage === "log") console.log(`    · ${ev.text}`);
  }, { realLegs });
  console.log(`총 ${Math.round((Date.now() - t0) / 1000)}초 · 안 ${r.options.length}개 · AI ${r.calls}회 · ${length}`);
  if (mustVisit.length) {
    const name = (id: string) => (places as unknown as Place[]).find((p) => p.id === id)?.name_ko ?? id;
    for (const o of r.options) {
      const ids = new Set(o.draft.days.flatMap((d) => d.stops.map((s) => s.placeId)));
      console.log(`  ${o.id}안 "${o.title}": ${mustVisit.map((m) => `${name(m)} ${ids.has(m) ? "✓ 들어감" : "✕ 빠짐"}`).join(" · ")}`);
    }
  }
}

main().catch((err) => {
  console.error(`✕ ${(err as Error).message}`);
  process.exit(1);
});
