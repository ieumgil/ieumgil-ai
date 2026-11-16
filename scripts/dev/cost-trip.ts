// 운영 비용 재기(실제 AI): 조건 5가지로 일정을 한 번씩 만들고, 요청마다 AI 호출 수·입력/출력 토큰·걸린 시간을 모아
// data/eval/cost-v1.md 표로 쓴다. 서비스와 같은 설정(Gemini 먼저, 붐비거나 늦으면 OpenAI · 카카오 실제 이동시간으로 다시 검사).
// 사용: npx tsx scripts/dev/cost-trip.ts --rate 1337.7 --rate-note "2026-10-28 서울 외환시장 기준가"   (원/달러 환율과 출처, 표 아래에 적는다)
// 단가(100만 토큰당, 유료 등급): 아래 PRICE. 바꾸기 전에 공식 가격 페이지로 다시 확인할 것.
import { writeFileSync } from "node:fs";
import evidence from "../../data/evidence.json";
import places from "../../data/places.json";
import { makeTrip } from "../../src/lib/ai/trip";
import { estimateLeg } from "../../src/lib/engine/travel";
import { routeLegs } from "../../src/lib/kakao";
import { getLlm, type LlmClient, type LlmRequest, type LlmUsage } from "../../src/lib/llm";
import { EMPTY_PLAN, type PlanInput } from "../../src/lib/plan/types";
import type { Place } from "../../src/lib/types";

try {
  process.loadEnvFile(".env.local");
} catch {
  // 환경변수로 이미 설정된 경우
}

/** 100만 토큰당 USD(유료 등급). 출력에는 Gemini 사고 토큰도 포함해 계산한다 */
const PRICE: Record<string, { input: number; output: number; source: string }> = {
  "gemini-3.5-flash-lite": { input: 0.3, output: 2.5, source: "https://ai.google.dev/gemini-api/docs/pricing" },
  "gpt-6-luna": { input: 0.1, output: 0.5, source: "https://developers.openai.com/docs/models/gpt-6-luna" },
};
const rateArg = process.argv.indexOf("--rate");
const KRW = rateArg > 0 ? Number(process.argv[rateArg + 1]) : NaN;
const noteArg = process.argv.indexOf("--rate-note");
/** 환율 출처·기준일(예: "2026-10-28 서울 외환시장 기준가") */
const RATE_NOTE = noteArg > 0 ? process.argv[noteArg + 1] : "";
if (!Number.isFinite(KRW)) throw new Error("--rate 원/달러 환율을 주세요(예: --rate 1450)");

// scripts/ai/make-example.ts의 EXAMPLE_INPUT과 같은 값(그 파일은 불러오면 예시를 다시 만들어서 복사해 둔다)
const EXAMPLE_INPUT: PlanInput = {
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
const base = { ...EMPTY_PLAN, arrival: "gangneung-station" as const, startDate: "2026-12-12" };
const CASES: { name: string; input: PlanInput }[] = [
  { name: "① 휠체어 · 택시 · 1박 2일", input: { ...base, endDate: "2026-12-13", transport: "taxi", travelers: ["wheelchair"], lodging: "강릉", categories: ["바다·해변", "역사·문화"] } },
  { name: "② 어르신(300m) · 자가용 · 당일", input: { ...base, endDate: "2026-12-12", transport: "car", travelers: ["elder"], walkLimit: 300, categories: ["자연·산책", "시장·먹거리"] } },
  { name: "③ 유모차 · 택시 · 1박 2일", input: { ...base, endDate: "2026-12-13", transport: "taxi", travelers: ["stroller"], lodging: "속초", categories: ["바다·해변", "전시·박물관"] } },
  { name: "④ 휠체어 + 어르신 · 자가용 · 2박 3일", input: { ...base, endDate: "2026-12-14", transport: "car", disabledPermit: true, travelers: ["wheelchair", "elder"], lodging: "강릉", categories: ["역사·문화", "전망·체험"] } },
  { name: "⑤ 예시 루트와 같은 조건", input: EXAMPLE_INPUT },
];

const add = (sum: LlmUsage, u: LlmUsage) => {
  sum.input += u.input;
  sum.output += u.output;
  sum.thinking += u.thinking;
  sum.calls += u.calls;
  for (const [m, t] of Object.entries(u.byModel)) {
    const s = (sum.byModel[m] ??= { input: 0, output: 0, thinking: 0, calls: 0 });
    s.input += t.input;
    s.output += t.output;
    s.thinking += t.thinking;
    s.calls += t.calls;
  }
};
const usd = (u: LlmUsage) =>
  Object.entries(u.byModel).reduce((s, [m, t]) => {
    const p = PRICE[m];
    if (!p) throw new Error(`${m} 단가가 없어요(PRICE에 넣기)`);
    return s + (t.input * p.input + (t.output + t.thinking) * p.output) / 1e6;
  }, 0);
const n = (x: number) => x.toLocaleString("en-US");

async function main() {
  const llm0 = getLlm();
  const realLegs = (days: { lat: number; lng: number }[][]) => Promise.all(days.map((pts) => routeLegs(pts)));
  const rows: { name: string; options: number; calls: number; sent: number; usage: LlmUsage; sec: number }[] = [];

  for (const c of CASES) {
    const usage: LlmUsage = { input: 0, output: 0, thinking: 0, calls: 0, byModel: {} };
    let sent = 0;
    const llm: LlmClient = {
      async json<T>(req: LlmRequest) {
        const r = await llm0.json<T>(req);
        sent++;
        if (r.usage) add(usage, r.usage);
        return r;
      },
    };
    const t0 = Date.now();
    const r = await makeTrip(llm, c.input, places as unknown as Place[], evidence, estimateLeg, () => {}, { realLegs });
    const sec = (Date.now() - t0) / 1000;
    rows.push({ name: c.name, options: r.options.length, calls: r.calls, sent, usage, sec });
    console.log(`${c.name}: 안 ${r.options.length}개 · AI ${r.calls}회(전송 ${usage.calls}) · 입력 ${n(usage.input)} · 출력 ${n(usage.output + usage.thinking)} · ${sec.toFixed(0)}초 · $${usd(usage).toFixed(4)}`);
  }

  const total: LlmUsage = { input: 0, output: 0, thinking: 0, calls: 0, byModel: {} };
  rows.forEach((r) => add(total, r.usage));
  const avgUsd = usd(total) / rows.length;
  const day = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
  const models = Object.entries(total.byModel).map(([m, t]) => `${m} ${t.calls}회`).join(" · ");

  const md = [
    "# 일정 만들기 한 번의 AI 비용 (cost-v1)",
    "",
    `잰 날: ${day} · 스크립트: [\`scripts/dev/cost-trip.ts\`](../../scripts/dev/cost-trip.ts) · 서비스와 같은 설정(Gemini 먼저, 늦으면 OpenAI · 카카오 실제 이동시간으로 다시 검사) · 조건마다 1회`,
    "",
    "| 조건 | 안 | AI 호출 | 입력 토큰 | 출력 토큰(사고 포함) | 걸린 시간 | 비용(USD) | 비용(원) |",
    "| --- | :---: | :---: | ---: | ---: | ---: | ---: | ---: |",
    ...rows.map((r) => `| ${r.name} | ${r.options} | ${r.calls} | ${n(r.usage.input)} | ${n(r.usage.output + r.usage.thinking)} | ${r.sec.toFixed(0)}초 | $${usd(r.usage).toFixed(4)} | ${(usd(r.usage) * KRW).toFixed(1)}원 |`),
    `| **평균** | | ${(rows.reduce((s, r) => s + r.calls, 0) / rows.length).toFixed(1)} | ${n(Math.round(total.input / rows.length))} | ${n(Math.round((total.output + total.thinking) / rows.length))} | ${(rows.reduce((s, r) => s + r.sec, 0) / rows.length).toFixed(0)}초 | $${avgUsd.toFixed(4)} | ${(avgUsd * KRW).toFixed(1)}원 |`,
    "",
    `- 쓴 모델: ${models}. 'AI 호출'은 일정 흐름이 부른 횟수, 토큰은 다시 요청·함께 보낸 다른 제공자까지 모두 더한 값입니다.`,
    `- 단가(100만 토큰당, 유료 등급): ${Object.entries(PRICE).map(([m, p]) => `[${m}](${p.source}) 입력 $${p.input} · 출력 $${p.output}`).join(" · ")}. Gemini는 사고 토큰도 출력 단가로 셉니다.`,
    `- 환율: 1달러 = ${n(KRW)}원${RATE_NOTE ? `(${RATE_NOTE})` : ""}.`,
    `- 하루 100건 × 30일 = 3,000건이면 약 $${(avgUsd * 3000).toFixed(2)} ≈ ${n(Math.round(avgUsd * 3000 * KRW))}원/월(평균 × 3,000, 추정).`,
    "- 위 값은 유료 등급 단가로 계산한 것입니다. Gemini를 무료 등급으로 쓰면 그 몫은 0원이고, OpenAI 예비 호출(무료 등급 없음)만 과금됩니다.",
    "- ① 읽기(152곳)·관광지 한 줄 소개는 미리 한 번만 하는 일이라 요청 비용에 들어가지 않습니다(당시 토큰 기록은 남기지 않음).",
    "",
  ].join("\n");
  writeFileSync("data/eval/cost-v1.md", md, "utf8");
  console.log(`\n→ data/eval/cost-v1.md · 평균 $${avgUsd.toFixed(4)} ≈ ${(avgUsd * KRW).toFixed(1)}원`);
}

main().catch((err) => {
  console.error(`✕ ${(err as Error).message}`);
  process.exit(1);
});
