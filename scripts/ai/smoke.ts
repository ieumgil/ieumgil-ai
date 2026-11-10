// Gemini 연결 확인: 관광공사 무장애 문장 하나를 JSON 스키마로 읽혀 본다(모델마다 1회).
// 사용: npx tsx scripts/ai/smoke.ts
// 키: .env.local의 GEMINI_API_KEY. 모델: GEMINI_MODEL_FAST(요청할 때), GEMINI_MODEL_READ(미리 읽기).
import { GoogleGenAI } from "@google/genai";

try {
  process.loadEnvFile(".env.local");
} catch {
  // 환경변수로 이미 설정된 경우
}
const apiKey = process.env.GEMINI_API_KEY?.trim();
if (!apiKey) {
  console.error("✕ GEMINI_API_KEY가 비어 있어요. .env.local에 넣고 저장해 주세요.");
  process.exit(1);
}
const models = [process.env.GEMINI_MODEL_FAST ?? "gemini-3.5-flash-lite", process.env.GEMINI_MODEL_READ ?? "gemini-3.8-flash"];

// 국립산악박물관(속초) 실제 API 문장 일부
const input = `다음은 한국관광공사 무장애 여행정보 원문이다. 각 문장 앞의 [id]가 근거 id다.
[route-1] 출입구까지 경사로가 설치되어 있음
[exit-1] 주출입구는 턱이 없어 휠체어 접근 가능함(수동문,자동문)
[restroom-1] 장애인 화장실 있음(1층 안내데스크 오른쪽,남녀분리/주차장 내 야외화장실,남녀분리)
[parking-1] 장애인 주차장 있음(6대,장애인 표지판)_무장애 편의시설
(엘리베이터, 쉴 곳 정보는 없음)

항목별로 값을 정해라. 원문에 없으면 반드시 "모름"과 물어볼 질문(ask)을 쓴다. 지어내지 않는다.`;

const item = {
  type: "object",
  properties: {
    value: { type: "string", enum: ["가능", "부분가능", "불가", "모름"] },
    note: { type: "string" },
    evidence: { type: "array", items: { type: "string" } },
    ask: { type: "string" },
  },
  required: ["value", "evidence"],
};
const schema = {
  type: "object",
  properties: {
    step_free_entrance: item,
    accessible_toilet: item,
    disabled_parking: item,
    elevator: item,
    rest_area: item,
  },
  required: ["step_free_entrance", "accessible_toilet", "disabled_parking", "elevator", "rest_area"],
};

const client = new GoogleGenAI({ apiKey });

async function main() {
for (const model of models) {
  const t0 = Date.now();
  try {
    const res = await client.interactions.create({
      model,
      input,
      system_instruction: "너는 관광지 무장애 정보를 정리하는 도우미다. 주어진 원문만 근거로 쓰고, JSON으로만 답한다.",
      response_format: { type: "text", mime_type: "application/json", schema },
      generation_config: { temperature: 0.2 },
      store: false,
    });
    const text = res.output_text ?? "";
    const parsed = JSON.parse(text) as Record<string, { value: string; evidence: string[]; ask?: string; note?: string }>;
    console.log(`\n✓ ${model} · ${Date.now() - t0}ms`);
    for (const [k, v] of Object.entries(parsed)) {
      console.log(`  ${k}: ${v.value}${v.note ? ` (${v.note})` : ""} · 근거 ${v.evidence.join(",") || "없음"}${v.ask ? ` · 질문: ${v.ask}` : ""}`);
    }
    const usage = (res as unknown as { usage?: Record<string, unknown> }).usage;
    if (usage) console.log(`  토큰: ${JSON.stringify(usage).slice(0, 200)}`);
  } catch (err) {
    const e = err as { status?: number; message?: string };
    console.log(`\n✕ ${model} · ${Date.now() - t0}ms · ${e.status ?? ""} ${(e.message ?? String(err)).slice(0, 300)}`);
  }
}
}

main();
