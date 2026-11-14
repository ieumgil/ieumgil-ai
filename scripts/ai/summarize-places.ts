// 관광지 한 줄 소개 만들기(미리, 실제 AI): 관광공사 개요·소개 문단을 AI가 읽어 "어떤 곳인지" 한 문장 + 볼 거리 0~3개로 정리한다.
// ① 읽기와 같은 원칙: 근거 id는 그 장소 소개 문단만, 원문에 없는 볼 거리는 코드가 버린다(src/lib/places/summary.ts).
// 결과: data/ai/summary.json(등급 ai). 둘러보기 화면이 쓴다. 검사를 못 통과한 곳은 화면이 개요 첫 문장을 쓴다.
// 사용: npx tsx scripts/ai/summarize-places.ts [--force]   (이미 있는 곳은 건너뜀, --force는 모두 다시)
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import evidence from "../../data/evidence.json";
import places from "../../data/places.json";
import { getLlm, type JsonSchema } from "../../src/lib/llm";
import { checkSummary, isIntroParagraph, type PlaceSummary } from "../../src/lib/places/summary";
import type { Place } from "../../src/lib/types";

try {
  process.loadEnvFile(".env.local");
} catch {
  // 환경변수로 이미 설정된 경우
}

const OUT = "data/ai/summary.json";
const BATCH = 8;
const PLACES = places as unknown as Place[];
const EV = evidence as Record<string, { id: string; label: string; text: string }[]>;

const SYSTEM = `너는 관광약자 가족에게 영동(강릉·속초·동해) 관광지를 소개하는 도우미다. JSON으로만 답한다.
장소마다 관광공사 소개 문단을 읽고:
- summary: 이곳이 어떤 곳인지 쉬운 존댓말 한 문장(40자 안팎, "~예요/~이에요"로 끝냄). 장소 이름은 쓰지 않는다.
- highlights: 가서 볼 거리·할 거리 0~3개. 원문에 나온 낱말 그대로 짧게(예: "율곡기념관", "해돋이", "출렁다리").
- evidence: 근거로 쓴 문단 id(그 장소의 문단만).
규칙: 문단에 없는 시설·체험·사실을 만들지 않는다. 접근성(휠체어 등)은 쓰지 않는다(따로 보여 준다). 모든 장소에 답한다.
꾸미는 말(아름다운, 유서 깊은, 아늑한, 맛있는, 특별한, 다양한, 신비로운, 탁 트인 등)은 쓰지 않는다. summary는 원문에 나온 낱말로 "무엇이 있는 어떤 곳"인지만 쓴다
(예: "율곡 이이가 태어난 조선 초기 집과 향토 유물 박물관이에요").`;

function schema(ids: string[], strict: boolean): JsonSchema {
  return {
    type: "object",
    properties: {
      summaries: {
        type: "array",
        ...(strict ? { minItems: ids.length, maxItems: ids.length } : {}),
        items: {
          type: "object",
          properties: {
            placeId: { type: "string", enum: ids },
            summary: { type: "string" },
            highlights: { type: "array", items: { type: "string" } },
            evidence: { type: "array", items: { type: "string" } },
          },
          required: ["placeId", "summary", "highlights", "evidence"],
        },
      },
    },
    required: ["summaries"],
  };
}

const intro = (id: string) => (EV[id] ?? []).filter((e) => isIntroParagraph(e.id));

async function main() {
  const saved: { places: Record<string, PlaceSummary & { grade: "ai" }> } = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : { places: {} };
  const force = process.argv.includes("--force");
  const todo = PLACES.filter((p) => intro(p.id).length > 0 && (force || !saved.places[p.id]));
  console.log(`요약할 곳 ${todo.length}곳(전체 ${PLACES.length}곳)`);
  const llm = getLlm();
  let ok = 0;
  let rejected = 0;
  for (let i = 0; i < todo.length; i += BATCH) {
    const batch = todo.slice(i, i + BATCH);
    const ids = batch.map((p) => p.id);
    const input = batch
      .map((p) => [`## ${p.id} ${p.name_ko} (${p.region} · ${p.category})`, ...intro(p.id).map((e) => `[${e.id}] ${e.text}`)].join("\n"))
      .join("\n\n");
    const res = await llm.json<{ summaries: (PlaceSummary & { placeId: string })[] }>({
      task: "summarize-places",
      system: SYSTEM,
      input,
      schema: schema(ids, false),
      check: schema(ids, true),
      temperature: 0.2,
    });
    if (!res.ok) {
      console.log(`  ✕ ${ids.join(",")}: ${res.message.slice(0, 80)}`);
      continue;
    }
    for (const s of res.data.summaries) {
      const checked = checkSummary(s, EV[s.placeId] ?? []);
      if (!checked) {
        rejected++;
        console.log(`  · ${s.placeId} 버림(근거·길이·원문 검사): ${s.summary}`);
        continue;
      }
      saved.places[s.placeId] = { ...checked, grade: "ai" };
      ok++;
    }
    console.log(`  ${Math.min(i + BATCH, todo.length)}/${todo.length} · ${res.model} · ${Math.round(res.ms / 1000)}초`);
    writeFileSync(OUT, JSON.stringify({ note: "관광지 한 줄 소개(AI 정리, 등급 ai). 근거는 data/docs/places/{id}.md의 개요·소개 문단", places: saved.places }, null, 2) + "\n");
  }
  console.log(`끝: 저장 ${ok}곳 · 검사에서 버림 ${rejected}곳 · 전체 ${Object.keys(saved.places).length}/${PLACES.length}곳`);
}

main().catch((err) => {
  console.error(`✕ ${(err as Error).message}`);
  process.exit(1);
});
