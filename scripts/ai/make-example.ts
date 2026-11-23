// 시작 화면 '예시 루트 바로 보기'용 결과를 실제 Gemini로 한 번 만들어 저장한다(src/lib/trip/example-trip.json).
// 화면은 이 파일을 그대로 열어 AI를 부르지 않는다. 안이 3개 나올 때까지 최대 3번 시도한다.
// 사용: npx tsx scripts/ai/make-example.ts            → 휠체어 · 강릉 1박 2일(예시 루트, 안 비교)
//       npx tsx scripts/ai/make-example.ts elder      → 어르신 · 속초 당일(시작 화면 루트 카드 B, src/lib/trip/examples/elder.json)
//       npx tsx scripts/ai/make-example.ts stroller   → 유모차 · 동해 당일(시작 화면 루트 카드 C, src/lib/trip/examples/stroller.json)
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import evidence from "../../data/evidence.json";
import places from "../../data/places.json";
import { makeTrip } from "../../src/lib/ai/trip";
import { estimateLeg } from "../../src/lib/engine/travel";
import { getLlm } from "../../src/lib/llm";
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

// 시작 화면 루트 카드(11/23, 함께 가는 사람 × 도시): 카드마다 안 하나만 보여 준다
const PRESETS: Record<string, { input: PlanInput; out: string; createdAt: string }> = {
  elder: {
    input: {
      ...EMPTY_PLAN,
      startDate: "2026-12-19",
      endDate: "2026-12-19",
      arrival: "sokcho-bus",
      transport: "taxi",
      travelers: ["elder"],
      walkLimit: 300,
      categories: ["자연·산책", "바다·해변"],
      pace: "slow",
    },
    out: "src/lib/trip/examples/elder.json",
    createdAt: "example-route-elder",
  },
  stroller: {
    input: {
      ...EMPTY_PLAN,
      startDate: "2026-12-19",
      endDate: "2026-12-19",
      arrival: "donghae-station",
      transport: "car",
      travelers: ["stroller"],
      categories: ["바다·해변", "전망·체험"],
      pace: "normal",
    },
    out: "src/lib/trip/examples/stroller.json",
    createdAt: "example-route-stroller",
  },
};

async function main() {
  const preset = PRESETS[process.argv[2] ?? ""];
  const input = preset?.input ?? EXAMPLE_INPUT;
  const out = preset?.out ?? OUT;
  const llm = getLlm();
  const ps = places as unknown as Place[];
  let best: ReturnType<typeof toTripView> | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const t0 = Date.now();
    const r = await makeTrip(llm, input, ps, evidence, estimateLeg, (ev) => {
      if (ev.stage === "log") console.log(`  ${ev.text}`);
    });
    console.log(`시도 ${attempt}: 안 ${r.options.length}개 · AI ${r.calls}회 · ${Math.round((Date.now() - t0) / 1000)}초${r.usedFallback ? " · 규칙 일정" : ""}`);
    const view = toTripView(r, input, ps, evidence);
    if (!r.usedFallback && (!best || view.options.length > best.options.length)) best = view;
    if (best && best.options.length >= 3) break;
  }
  if (!best) throw new Error("AI 일정을 만들지 못했어요. 잠시 뒤 다시 실행해 주세요.");
  // 예시는 따로 보관(사용자 일정의 확정·바꾼 장소 기록과 섞이지 않게) — createdAt이 "example"로 시작
  best.createdAt = preset?.createdAt ?? "example-2026-12-19";
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(best, null, 1) + "\n");
  console.log(`✓ ${out}: 안 ${best.options.length}개 · ${best.options.map((o) => `${o.id} ${o.title}`).join(" / ")}`);
}

main().catch((err) => {
  console.error(`✕ ${(err as Error).message}`);
  process.exit(1);
});
