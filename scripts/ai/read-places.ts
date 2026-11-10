// ① 읽기: 관광공사 문장 → 접근성 10항목 값·운영시간·도착 후 동선 (docs/ai-plan.md v3)
// 사용: npx tsx scripts/ai/read-places.ts [--limit N] [--batch 4] [--read] [--force]
//  - 기본은 빠른 모델(GEMINI_MODEL_FAST, Flash-Lite: 무료 하루 약 500회). --read면 미리 읽기 모델(Flash, 하루 약 20회)
//  - 결과는 장소마다 data/ai/read/{id}.json에 저장(이미 있으면 건너뜀 → 끊겨도 이어서)
//  - 끝나면 merge-places.ts로 data/places.json을 만든다
//  - 무료 등급 한도 때문에 호출 사이에 간격을 둔다(READ_INTERVAL_MS, 기본 6초 ≈ 분당 10회)
//  - Gemini에는 근거 id enum을 뺀 가벼운 스키마를 보내고(enum이 많으면 400), 받은 답은 엄격한 스키마로 검사한다

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createLlm, geminiTransport, type JsonSchema } from "../../src/lib/llm";
import { ACCESS_KEYS } from "../../src/lib/types";
import { buildEvidence, type RawPlace } from "../tour/evidence";

try {
  process.loadEnvFile(".env.local");
} catch {
  // 환경변수로 이미 설정된 경우
}

const arg = (name: string) => process.argv.includes(`--${name}`);
const num = (name: string, d: number) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? Number(process.argv[i + 1]) : d;
};
const LIMIT = num("limit", Infinity);
const BATCH = num("batch", 4);
const INTERVAL = Number(process.env.READ_INTERVAL_MS ?? 6_000);
const TIER = arg("read") ? "read" : "fast";
const OUT = "data/ai/read";
mkdirSync(OUT, { recursive: true });

interface Base {
  id: string;
  tour_content_id: string;
  name_ko: string;
  category: string;
}
const base: Base[] = JSON.parse(readFileSync("data/build/places-base.json", "utf8"));
const rawOf = (contentId: string): RawPlace => JSON.parse(readFileSync(`data/raw/tour/places/${contentId}.json`, "utf8"));

const ACCESS_GUIDE = `항목 뜻과 판단 기준(원문 문단을 근거로만 판단한다):
- step_free_entrance(계단·단차 없는 진입): 접근로·출입통로에 "턱 없음", "경사로", "단차 없음" → 가능. 계단만 있음 → 불가. 일부 구간만 → 부분가능.
- elevator(층이 있는 시설의 엘리베이터): "엘리베이터 있음" → 가능. 근거 문단에 층이 없는 야외·단층 시설임이 드러나면 가능(note: "층이 없는 시설"). 층이 있는데 없다고 하면 불가. 근거가 없으면 모름.
- slope(급한 경사 없음): 경사로가 설치되어 있거나 "완만함" → 가능. "급경사", "오르막" → 부분가능 또는 불가.
- surface(포장·데크 노면): 포장·데크·평탄 → 가능. 모래·자갈·흙길이 일부 → 부분가능(어느 부분인지 note). 대부분 비포장 → 불가.
- accessible_toilet(장애인 화장실): "장애인 화장실 있음" → 가능. 관람 구역과 떨어진 곳에만 있으면 부분가능(note에 위치).
- diaper_nursing(수유실·기저귀 교환대): 수유실 또는 기저귀 교환대 있음 → 가능.
- disabled_parking(장애인 전용 주차구역): 장애인 주차장·주차구역 있음 → 가능.
- rest_area(벤치·쉼터): 벤치·쉼터·휴게 공간이 원문에 있으면 가능. 없으면 모름.
- rental_wheelchair(휠체어 대여): "대여 가능" → 가능, "없음/불가" → 불가.
- rental_stroller(유모차 대여): 유모차 대여 "가능" → 가능, "없음/불가" → 불가.`;

const SYSTEM = `너는 관광지 무장애 정보를 정리하는 도우미다. 한국관광공사 원문 문단만 근거로 쓰고, JSON으로만 답한다.
규칙:
1. 근거(evidence)는 그 장소에 붙은 문단 id만 쓴다. 원문에 없는 시설·시간·거리·개수를 만들지 않는다.
2. 원문으로 판단할 수 없으면 반드시 value "모름"과 ask(전화로 물어볼 짧은 존댓말 질문, "~나요?")를 쓴다. 추측해서 가능/불가로 채우지 않는다.
3. 부분가능이면 note에 어느 부분이 되고 안 되는지 쓴다.
4. 운영시간: 이용시간 문단을 HH:MM으로 정리한다. 하절기·동절기 구분이 없으면 summer와 winter에 같은 값을 넣는다. 매표·입장 마감이 있으면 last_entry. "상시개방", "연중 개방", "24시간"이면 always_open true. 쉬는 날 문단에서 요일은 closed_weekdays, 명절·특정일은 closed_dates. 시각을 알 수 없으면 known false와 ask.
5. on_site: 주차 → 접근로·출입구 → 화장실 순서로 도착 후 동선 한 문장(근거 문단 2개 이상일 때만). 근거가 부족하면 text를 빈 문자열, evidence를 빈 배열로 둔다.
${ACCESS_GUIDE}`;

const statusEnum = ["가능", "부분가능", "불가", "모름"];
const time = { type: "object", properties: { open: { type: "string" }, close: { type: "string" }, last_entry: { type: "string" } }, required: ["open", "close"] };

/** strict=false: 모델에 보낼 가벼운 스키마(근거는 그냥 문자열), strict=true: 받은 답 검사용(근거 id enum) */
function batchSchema(placeIds: string[], evidenceIds: string[], strict: boolean): JsonSchema {
  // 모델에 보내는 스키마에는 enum·길이 제한을 넣지 않는다(중첩 배열 길이 제한이 있으면 400 "too many states")
  const ev = strict ? { type: "array", items: { type: "string", enum: evidenceIds }, maxItems: 6 } : { type: "array", items: { type: "string" } };
  const count = strict ? { minItems: placeIds.length, maxItems: placeIds.length } : {};
  const item = {
    type: "object",
    properties: { value: { type: "string", enum: statusEnum }, note: { type: "string" }, ask: { type: "string" }, evidence: ev },
    required: ["value", "evidence"],
  };
  return {
    type: "object",
    properties: {
      places: {
        type: "array",
        ...count,
        items: {
          type: "object",
          properties: {
            placeId: { type: "string", enum: placeIds },
            access: { type: "object", properties: Object.fromEntries(ACCESS_KEYS.map((k) => [k, item])), required: [...ACCESS_KEYS] },
            hours: {
              type: "object",
              properties: {
                known: { type: "boolean" },
                always_open: { type: "boolean" },
                summer: time,
                winter: time,
                closed_weekdays: { type: "array", items: { type: "string", enum: ["일", "월", "화", "수", "목", "금", "토"] } },
                closed_dates: { type: "array", items: { type: "string" } },
                note: { type: "string" },
                ask: { type: "string" },
                evidence: ev,
              },
              required: ["known", "evidence"],
            },
            on_site: { type: "object", properties: { text: { type: "string" }, evidence: ev }, required: ["text", "evidence"] },
          },
          required: ["placeId", "access", "hours", "on_site"],
        },
      },
    },
    required: ["places"],
  };
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("GEMINI_API_KEY가 없어요.");
  const llm = createLlm({
    transport: geminiTransport(apiKey),
    models: { fast: process.env.GEMINI_MODEL_FAST?.trim(), read: process.env.GEMINI_MODEL_READ?.trim() },
    timeoutMs: 120_000,
    baseDelayMs: 10_000,
  });

  const todo = base.filter((b) => arg("force") || !existsSync(`${OUT}/${b.id}.json`)).slice(0, LIMIT);
  console.log(`읽을 장소 ${todo.length}곳 · 묶음 ${BATCH}곳 · 모델 ${TIER}`);

  for (let i = 0; i < todo.length; i += BATCH) {
    const group = todo.slice(i, i + BATCH);
    const docs = group.map((b) => ({ b, ev: buildEvidence(rawOf(b.tour_content_id)) }));
    const input = docs
      .map(({ b, ev }) => [`## ${b.id} ${b.name_ko} (분류: ${b.category})`, ...ev.map((e) => `[${e.id}] (${e.label}) ${e.text}`)].join("\n"))
      .join("\n\n");
    const placeIds = group.map((g) => g.id);
    const evidenceIds = [...new Set(docs.flatMap((d) => d.ev.map((e) => e.id)))];

    const t0 = Date.now();
    const res = await llm.json<{ places: { placeId: string }[] }>({
      task: "read-places",
      system: SYSTEM,
      input: `아래 ${group.length}곳을 각각 정리하라. 근거 id는 그 장소 문단의 id만 쓴다.\n\n${input}`,
      schema: batchSchema(placeIds, evidenceIds, false),
      check: batchSchema(placeIds, evidenceIds, true),
      tier: TIER,
      temperature: 0.1,
    });
    if (!res.ok) {
      console.log(`  ✕ ${group.map((g) => g.id).join(",")} · ${res.error} · ${res.message}`);
    } else {
      const readAt = new Date().toISOString();
      for (const r of res.data.places) {
        writeFileSync(`${OUT}/${r.placeId}.json`, JSON.stringify({ model: res.model, readAt, attempts: res.attempts, result: r }, null, 2) + "\n");
      }
      const missing = group.filter((g) => !res.data.places.some((p) => p.placeId === g.id)).map((g) => g.id);
      console.log(`  ✓ ${i + group.length}/${todo.length} · ${res.model} · ${Math.round((Date.now() - t0) / 1000)}초${missing.length ? ` · 빠짐 ${missing.join(",")}` : ""}`);
    }
    if (i + BATCH < todo.length) await new Promise((r) => setTimeout(r, INTERVAL));
  }
}

main().catch((err) => {
  console.error(`✕ ${(err as Error).message}`);
  process.exit(1);
});
