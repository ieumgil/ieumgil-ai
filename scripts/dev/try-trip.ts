// 전체 흐름을 실제 Gemini로 돌려 본다: 규칙 일정 vs AI 일정 2~3안 (이동시간은 직선거리 추정).
// 사용: npx tsx scripts/dev/try-trip.ts [wheelchair|elder|stroller ...] [--car --permit] [--nights 0|1|2] [--lodging 강릉]
//        [--cat 바다·해변,역사·문화] [--must GN12,GN03] [--pace slow|normal|busy]
// LLM 호출 약 5~8회(판단 3 + 계획 1~3 + 평가 1)
import evidence from "../../data/evidence.json";
import places from "../../data/places.json";
import { makeTrip } from "../../src/lib/ai/trip";
import { describeOption } from "../../src/lib/ai/review";
import { estimateLeg } from "../../src/lib/engine/travel";
import { createLlm, geminiTransport } from "../../src/lib/llm";
import { EMPTY_PLAN, type PlanInput, type TravelerType } from "../../src/lib/plan/types";
import type { Category, Place } from "../../src/lib/types";

try {
  process.loadEnvFile(".env.local");
} catch {
  // 환경변수로 이미 설정된 경우
}
const a = process.argv.slice(2);
const opt = (k: string) => (a.includes(`--${k}`) ? a[a.indexOf(`--${k}`) + 1] : undefined);
const travelers = a.filter((x) => ["wheelchair", "elder", "stroller"].includes(x)) as TravelerType[];
const nights = Number(opt("nights") ?? 0);
const input: PlanInput = {
  ...EMPTY_PLAN,
  startDate: "2026-11-21",
  endDate: ["2026-11-21", "2026-11-22", "2026-11-23"][nights],
  arrival: "gangneung-station",
  transport: a.includes("--car") ? "car" : "taxi",
  disabledPermit: a.includes("--permit"),
  travelers: travelers.length ? travelers : ["wheelchair"],
  lodging: nights ? ((opt("lodging") as PlanInput["lodging"]) ?? "강릉") : null,
  categories: (opt("cat")?.split(",") as Category[]) ?? ["바다·해변", "역사·문화"],
  mustVisit: opt("must")?.split(",") ?? [],
  pace: (opt("pace") as PlanInput["pace"]) ?? "normal",
};

async function main() {
  const llm = createLlm({ transport: geminiTransport(process.env.GEMINI_API_KEY!.trim()), models: { fast: process.env.GEMINI_MODEL_FAST?.trim() } });
  const ps = places as unknown as Place[];
  const byId = new Map(ps.map((p) => [p.id, p]));
  const r = await makeTrip(llm, input, ps, evidence, estimateLeg);

  console.log(`입력: ${input.travelers.join("+")} · ${input.transport}${input.disabledPermit ? "+표지" : ""} · ${nights}박 · 좋아하는 곳 ${input.categories.join(",")} · 꼭 ${input.mustVisit.join(",") || "없음"} · ${input.pace}`);
  console.log(`LLM 호출 ${r.calls}회 · ${Math.round(r.ms / 1000)}초 · 후보 ${r.llmCandidates.length}곳`);
  const counts: Record<string, number> = {};
  r.judge?.judgments.forEach((j) => (counts[`${j.verdict}${j.source === "rule" ? "(규칙)" : ""}`] = (counts[`${j.verdict}${j.source === "rule" ? "(규칙)" : ""}`] ?? 0) + 1));
  console.log("② 판단:", counts, `· 하한으로 내림 ${r.judge?.floorApplied ?? 0}곳`);
  for (const c of r.llmCandidates.slice(0, 8)) {
    const j = r.judge?.judgments.get(c.place.id);
    console.log(`  ${c.place.id} ${c.place.name_ko}: ${j?.verdict}(${j?.confidence ?? "-"}) ${j?.reasons.join(" ")}`);
  }
  if (r.plan?.dropped.length) console.log("뺀 안:", r.plan.dropped);

  console.log(`\n=== 규칙 일정 (검사 ${r.rule.check.ok ? "통과" : "위반"}) ===`);
  console.log(describeOption({ id: "R", title: "규칙", summary: "", draft: r.rule.draft, check: r.rule.check } as never, byId));
  for (const o of r.options) {
    const rev = r.reviews.find((x) => x.optionId === o.id);
    console.log(`\n=== ${o.id}안 [${o.strategy}] 고친 횟수 ${o.fixes}${rev ? ` · 평가 피로 ${rev.fatigue} 여유 ${rev.slack} 취향 ${rev.taste}: ${rev.comment}` : ""} ===`);
    console.log(describeOption(o, byId));
    o.draft.days.forEach((d) => d.stops.forEach((s) => console.log(`    · ${byId.get(s.placeId)!.name_ko} [${r.judge?.judgments.get(s.placeId)?.verdict}] ${s.why ?? ""}`)));
    if (o.checkBeforeGo.length) console.log("  출발 전 확인:", o.checkBeforeGo.map((c) => `${byId.get(c.placeId)?.name_ko}: ${c.question}`).join(" / "));
    if (o.fixedViolations.length) console.log("  고친 위반:", o.fixedViolations.join(" / "));
  }
}

main().catch((err) => {
  console.error(`✕ ${(err as Error).message}`);
  process.exit(1);
});
