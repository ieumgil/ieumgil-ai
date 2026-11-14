// ② 판단 평가(실제 AI, CI 밖): 사람 정답 없이 자동으로 잰다(docs/ai-plan.md '평가').
// 여행자 유형·지역이 다른 6개 장면에서, 서비스와 같은 방식으로 후보(최대 20곳)를 골라 판단을 3번(온도 0.2·0.6·0.9) 받는다.
// 잰 것: 3회 일치율 · 확신도 분포 · 최종 판단 분포 · 안전 하한으로 내린 비율 · 근거가 맞지 않아 버린 비율,
//        그리고 같은 장면을 Gemini와 OpenAI로 각각 돌려 모델 간 일치율(정반대 '적합 ↔ 부적합' 수 포함).
// 결과: data/eval/judge-v1.json(장면·장소별 표본 판단) · data/eval/judge-v1.md(요약 표). 개인정보·키 없음.
// 사용: npx tsx scripts/ai/eval-judge.ts [--gemini|--openai]   (기본은 키가 있는 두 모델 모두)
//       npx tsx scripts/ai/eval-judge.ts --report   (AI를 부르지 않고 저장된 judge-v1.json으로 표만 다시 만든다)
import { readFileSync, writeFileSync } from "node:fs";
import evidence from "../../data/evidence.json";
import places from "../../data/places.json";
import { crossAgreement, summarize, VERDICT_ORDER, type CrossSummary, type JudgeRun, type JudgeSummary } from "../../src/lib/ai/eval";
import type { Verdict } from "../../src/lib/ai/guards";
import { judgePlaces } from "../../src/lib/ai/judge";
import { llmCandidateMax, selectForLlm } from "../../src/lib/ai/trip";
import { rulePlan } from "../../src/lib/engine/fallback";
import { estimateLeg } from "../../src/lib/engine/travel";
import { createLlm, DEFAULT_OPENAI_MODEL, DEFAULT_MODELS, geminiTransport, openaiTransport, type LlmClient } from "../../src/lib/llm";
import { EMPTY_PLAN, type PlanInput } from "../../src/lib/plan/types";
import type { Place } from "../../src/lib/types";

try {
  process.loadEnvFile(".env.local");
} catch {
  // 환경변수로 이미 설정된 경우
}

const PLACES = places as unknown as Place[];
const base = { ...EMPTY_PLAN, startDate: "2026-12-12", endDate: "2026-12-12", startTime: "10:00", endTime: "17:00" };

/** 장면: 유형·이동·지역·취향을 고루 */
const SCENES: { name: string; input: PlanInput }[] = [
  { name: "휠체어 · 택시 · 강릉 1박", input: { ...base, endDate: "2026-12-13", lodging: "강릉", arrival: "gangneung-station", transport: "taxi", travelers: ["wheelchair"], categories: ["바다·해변", "역사·문화"] } },
  { name: "휠체어 · 자가용(표지) · 강릉 당일", input: { ...base, arrival: "gangneung-station", transport: "car", disabledPermit: true, travelers: ["wheelchair"], categories: ["전시·박물관", "자연·산책"] } },
  { name: "어르신(300m) · 자가용 · 속초 1박", input: { ...base, endDate: "2026-12-13", lodging: "속초", arrival: "sokcho-bus", transport: "car", travelers: ["elder"], walkLimit: 300, categories: ["바다·해변", "시장·먹거리"] } },
  { name: "유모차 · 택시 · 강릉 당일", input: { ...base, arrival: "gangneung-station", transport: "taxi", travelers: ["stroller"], categories: ["전시·박물관", "전망·체험"] } },
  { name: "휠체어 + 어르신 · 자가용(표지) · 동해 당일", input: { ...base, arrival: "donghae-station", transport: "car", disabledPermit: true, travelers: ["wheelchair", "elder"], walkLimit: 300, categories: ["자연·산책", "역사·문화"] } },
  { name: "어르신 + 유모차 · 택시 · 강릉 1박", input: { ...base, endDate: "2026-12-13", lodging: "강릉", arrival: "gangneung-bus", transport: "taxi", travelers: ["elder", "stroller"], walkLimit: 500, categories: ["바다·해변", "시장·먹거리"] } },
];

const env = (k: string) => process.env[k]?.trim() || undefined;
const models: { name: string; model: string; llm: LlmClient }[] = [];
const gKey = env("GEMINI_API_KEY");
const oKey = env("OPENAI_API_KEY");
if (gKey && !process.argv.includes("--openai")) {
  const model = env("GEMINI_MODEL_FAST") ?? DEFAULT_MODELS.fast;
  models.push({ name: "Gemini", model, llm: createLlm({ transport: geminiTransport(gKey), models: { fast: model } }) });
}
if (oKey && !process.argv.includes("--gemini")) {
  const model = env("OPENAI_MODEL") ?? DEFAULT_OPENAI_MODEL;
  models.push({ name: "OpenAI", model, llm: createLlm({ transport: openaiTransport(oKey), models: { fast: model } }) });
}

type SceneResult = { scene: string; candidates: number; places: Record<string, { name: string; samples: Verdict[]; final: Verdict; confidence?: string; source: string }>; calls: number; failedCalls: number; ms: number };

async function runModel(m: (typeof models)[number]): Promise<{ runs: JudgeRun[]; scenes: SceneResult[] }> {
  const runs: JudgeRun[] = [];
  const scenes: SceneResult[] = [];
  for (const s of SCENES) {
    const rule = rulePlan(s.input, PLACES, estimateLeg);
    const candidates = selectForLlm(rule.filter.candidates, rule.frames, llmCandidateMax(rule.frames.length));
    const t0 = Date.now();
    const r = await judgePlaces(m.llm, { input: s.input, conditions: rule.filter.conditions, candidates, evidence });
    const ms = Date.now() - t0;
    const final = new Map([...r.judgments].map(([id, j]) => [id, { verdict: j.verdict, confidence: j.confidence ?? "낮음", source: j.source }] as const));
    runs.push({ samples: r.samples, final, stats: r.stats });
    scenes.push({
      scene: s.name,
      candidates: candidates.length,
      calls: r.calls,
      failedCalls: r.failedCalls,
      ms,
      places: Object.fromEntries(
        candidates.map((c) => {
          const j = r.judgments.get(c.place.id)!;
          return [c.place.id, { name: c.place.name_ko, samples: r.samples.get(c.place.id) ?? [], final: j.verdict, confidence: j.confidence, source: j.source }];
        }),
      ),
    });
    console.log(`  ${m.name} · ${s.name}: 후보 ${candidates.length}곳 · ${Math.round(ms / 1000)}초 · 실패 ${r.failedCalls}/${r.calls}`);
  }
  return { runs, scenes };
}

function table(s: JudgeSummary): string[] {
  return [
    `| 3회 모두 같은 판단 | **${s.unanimousPct}%** (${s.unanimous}/${s.places}곳) |`,
    `| 2번 같고 1번 다름 | ${s.majority}곳 |`,
    `| 3번 모두 다름(→ 확인 필요로) | ${s.split}곳 |`,
    `| 확신도 높음 · 보통 · 낮음 | ${s.confidence.높음} · ${s.confidence.보통} · ${s.confidence.낮음} |`,
    `| 최종 판단 ${VERDICT_ORDER.join(" · ")} | ${VERDICT_ORDER.map((v) => s.verdicts[v]).join(" · ")} |`,
    `| 근거가 원문에 없어 버린 판단 | ${s.droppedPct}% (${s.dropped}/${s.received}) |`,
    `| 안전 하한으로 더 보수적으로 바꾼 판단 | ${s.flooredPct}% (${s.floored}/${s.received - s.dropped}) |`,
  ];
}

type Out = Record<string, { model: string; summary: JudgeSummary; scenes: SceneResult[] }>;

/** 저장된 장면 결과 → 지표(다시 계산) */
function fromSaved(scenes: SceneResult[], stats: JudgeSummary): JudgeSummary {
  const runs: JudgeRun[] = scenes.map((sc) => ({
    samples: new Map(Object.entries(sc.places).map(([id, p]) => [id, p.samples])),
    final: new Map(Object.entries(sc.places).map(([id, p]) => [id, { verdict: p.final, confidence: (p.confidence ?? "낮음") as "높음", source: p.source as "ai" }])),
    stats: { received: 0, dropped: 0, floored: 0 },
  }));
  return { ...summarize(runs), received: stats.received, dropped: stats.dropped, floored: stats.floored, droppedPct: stats.droppedPct, flooredPct: stats.flooredPct };
}

async function main() {
  let out: Out = {};
  let date = new Date().toISOString().slice(0, 10);
  if (process.argv.includes("--report")) {
    const saved = JSON.parse(readFileSync("data/eval/judge-v1.json", "utf8")) as { date: string; results: Out };
    date = saved.date;
    for (const [name, r] of Object.entries(saved.results)) out[name] = { ...r, summary: fromSaved(r.scenes, r.summary) };
  } else {
    if (!models.length) throw new Error("GEMINI_API_KEY 또는 OPENAI_API_KEY가 필요해요(.env.local)");
    out = {};
    for (const m of models) {
      console.log(`▶ ${m.name}(${m.model})`);
      const { runs, scenes } = await runModel(m);
      out[m.name] = { model: m.model, summary: summarize(runs), scenes };
    }
  }

  let cross: CrossSummary | undefined;
  if (out.Gemini && out.OpenAI) {
    const flat = (name: string) => new Map(out[name].scenes.flatMap((sc) => Object.entries(sc.places).filter(([, p]) => p.source === "ai").map(([id, p]) => [`${sc.scene}|${id}`, p.final] as const)));
    cross = crossAgreement(flat("Gemini"), flat("OpenAI"));
  }

  writeFileSync("data/eval/judge-v1.json", JSON.stringify({ date, scenes: SCENES.map((s) => s.name), results: out, cross }, null, 2) + "\n");

  const md = [
    "# ② AI 판단 평가 (judge-v1)",
    "",
    `측정일 ${date} · \`npx tsx scripts/ai/eval-judge.ts\` · 원자료 [judge-v1.json](judge-v1.json)`,
    "",
    "사람이 정답을 다는 평가가 아니라, 자동으로 잴 수 있는 **일관성과 안전 규칙 준수**를 잽니다.",
    `여행자 유형·지역이 다른 ${SCENES.length}개 장면에서 서비스와 같은 방식으로 후보를 골라, 같은 후보를 온도만 달리해 3번 판단했습니다.`,
    "",
    ...SCENES.map((s, i) => `${i + 1}. ${s.name}`),
    "",
    ...Object.entries(out).flatMap(([name, r]) => [`## ${name} (\`${r.model}\`)`, "", "| 지표 | 값 |", "| --- | --- |", ...table(r.summary), ""]),
    ...(cross
      ? [
          "## 모델 간 일치(같은 장면·같은 장소의 최종 판단)",
          "",
          `- 두 모델 모두 AI로 판단한 ${cross.both}곳 중 **${cross.samePct}%**(${cross.same}곳)가 같은 판단`,
          `- 정반대로 갈린 곳(한쪽 적합, 다른 쪽 부적합): **${cross.opposite}곳**`,
          `- 갈린 ${cross.both - cross.same}곳 중 OpenAI가 더 보수적 ${cross.bStricter}곳 · Gemini가 더 보수적 ${cross.aStricter}곳(보수적: 적합 < 주의 < 확인 필요 < 부적합)`,
          "- 갈려도 서비스는 안전하다: 판단마다 코드의 안전 하한을 거치고, '확인 필요'는 질문 + 공식 전화로 사용자가 확인한다.",
          "",
          `| Gemini ↓ / OpenAI → | ${VERDICT_ORDER.join(" | ")} |`,
          `| --- | ${VERDICT_ORDER.map(() => "---:").join(" | ")} |`,
          ...VERDICT_ORDER.map((v) => `| ${v} | ${VERDICT_ORDER.map((w) => cross!.table[v][w]).join(" | ")} |`),
          "",
        ]
      : []),
    "## 읽는 법",
    "",
    "- **3회 일치율**: 같은 질문에 같은 답을 하는가(자기 일관성). 서비스는 3번이 갈리면 더 보수적인 쪽을, 셋 다 다르면 '확인 필요'를 씁니다.",
    "- **근거가 원문에 없어 버린 판단**: 관광공사 문단에 없는 근거를 댄 판단은 코드가 버립니다(지어낸 판단이 화면에 나가지 않음).",
    "- **안전 하한**: 꼭 필요한 조건이 원문상 '불가'·'부분가능'이면 AI가 적합이라 해도 코드가 부적합·주의로 내립니다(AI는 더 보수적으로만 바꿀 수 있음).",
    "- 판단이 맞았는지(정확도)는 사람이 현장·전화로 확인해야 알 수 있어 재지 않았습니다. 대신 모르는 항목은 '확인 필요' + 질문 + 공식 전화로 사용자에게 넘깁니다.",
    "",
  ].join("\n");
  writeFileSync("data/eval/judge-v1.md", md);
  console.log("\n" + md);
}

main().catch((err) => {
  console.error(`✕ ${(err as Error).message}`);
  process.exit(1);
});
