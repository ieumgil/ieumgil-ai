// 관광지 사진 분류(미리 한 번): 관광공사 API 사진(detailImage2)을 풍경·건물 / 편의시설(화장실·엘리베이터…) /
// 기타(사람 얼굴·안내문…)로 나눈 뒤 대표 사진을 고른다.
// - 2026-11-11 분류는 Claude Code가 장소별 사진 모음(번호를 붙인 이미지)을 직접 보고 정했다(Gemini 사진 입력이 장소당
//   수 분씩 걸려 바꿈). 그 결과가 캐시에 있고 --build-only로 만든다. 아래 Gemini 분류는 새 장소가 생길 때 쓰는 대안 경로.
// - 사람이 확인 페이지로 본 뒤 바꿀 것은 data/photos.overrides.json에 적는다(AI 분류보다 먼저).
// - 일정 만들 때는 부르지 않는다. 결과는 data/photos.json(커밋), 작은 사진은 public/photos/{id}.webp(1유형만, 줄여서 저장)
// - 3유형 사진은 내려받아 분류만 하고 저장하지 않는다(원본 주소로 그대로 보여 준다)
// - 장소별 분류 결과는 data/raw/tour/photo-labels/에 캐시(커밋 안 함) → 중간에 멈춰도 이어서
// - 사람이 확인한 덮어쓰기는 data/photos.overrides.json(장소 id → { cover, exclude })
// 사용: npx tsx scripts/tour/classify-photos.ts [--build-only] [--only=GN12] [--limit=10]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import places from "../../data/places.json";
import { createLlm, geminiTransport, type LlmImage } from "../../src/lib/llm";
import { compactPhotos, pickCover, visiblePhotos, type LabeledPhoto, type PhotoOverride, type PlacePhotos } from "../../src/lib/places/photos";

try {
  process.loadEnvFile(".env.local");
} catch {
  // 환경변수로 이미 설정된 경우
}

const RAW = "data/raw/tour/places";
const CACHE = "data/raw/tour/photo-labels";
const OUT = "data/photos.json";
const OVERRIDES = "data/photos.overrides.json";
const THUMBS = "public/photos";
const INDEX = "src/lib/places/photo-index.json";
const MAX_T1 = 8;
const MAX_T3 = 6;

const args = process.argv.slice(2);
const buildOnly = args.includes("--build-only");
const only = args.find((a) => a.startsWith("--only="))?.slice(7);
const limit = Number(args.find((a) => a.startsWith("--limit="))?.slice(8) ?? Infinity);

type RawImage = { originimgurl?: string; cpyrhtDivCd?: string; imgname?: string };
type Place = { id: string; name_ko: string; region: string; category: string; tour_content_id: number | string };

function rawImages(p: Place): { url: string; kogl_type: 1 | 3 }[] {
  const f = `${RAW}/${p.tour_content_id}.json`;
  if (!existsSync(f)) return [];
  const raw = JSON.parse(readFileSync(f, "utf8")) as { images?: RawImage[] };
  const imgs = (raw.images ?? []).filter((i) => i.originimgurl).map((i) => ({ url: String(i.originimgurl).replace(/^http:/, "https:"), kogl_type: i.cpyrhtDivCd === "Type1" ? (1 as const) : i.cpyrhtDivCd === "Type3" ? (3 as const) : null }));
  const t1 = imgs.filter((i) => i.kogl_type === 1).slice(0, MAX_T1);
  const t3 = imgs.filter((i) => i.kogl_type === 3).slice(0, MAX_T3);
  return [...t1, ...t3] as { url: string; kogl_type: 1 | 3 }[];
}

async function download(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`사진 받기 실패 ${res.status} ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

const SYSTEM = `너는 관광지 사진을 분류한다. 사진마다 하나로 나눈다.
- scenery: 그 관광지가 어떤 곳인지 보여 주는 사진(풍경, 건물 겉모습·내부 전시, 해변, 산책로 등)
- facility: 편의시설이 주인공인 사진(화장실·장애인 화장실, 엘리베이터, 주차장·장애인 주차구역, 경사로, 출입구 문턱, 점자 안내판 등)
- other: 사람 얼굴이 크게 나온 사진, 안내문·지도·포스터만 찍힌 사진, 흐리거나 무엇인지 알기 어려운 사진
facility이면 facility_kind를 고른다(toilet, elevator, parking, ramp, entrance, etc). 아니면 none.
cover_score(0~3): 장소 목록의 대표 사진으로 얼마나 좋은지. 밝고 장소 전체가 한눈에 보이면 3, 무난하면 2, 부분만 보이면 1, scenery가 아니면 0.
사진 순서대로 index(0부터)를 붙여 모든 사진에 답한다. 사진에 없는 내용을 지어내지 않는다.`;

const SCHEMA = {
  type: "object",
  properties: {
    photos: {
      type: "array",
      items: {
        type: "object",
        properties: {
          index: { type: "integer" },
          kind: { type: "string", enum: ["scenery", "facility", "other"] },
          facility_kind: { type: "string", enum: ["toilet", "elevator", "parking", "ramp", "entrance", "etc", "none"] },
          cover_score: { type: "integer", minimum: 0, maximum: 3 },
        },
        required: ["index", "kind", "facility_kind", "cover_score"],
      },
    },
  },
  required: ["photos"],
};

type Answer = { photos: { index: number; kind: LabeledPhoto["kind"]; facility_kind: LabeledPhoto["facility"] | "none"; cover_score: number }[] };

async function label(llm: ReturnType<typeof createLlm>, p: Place): Promise<LabeledPhoto[] | null> {
  const imgs = rawImages(p);
  if (imgs.length === 0) return [];
  const sent: LlmImage[] = [];
  for (const i of imgs) {
    const small = await sharp(await download(i.url)).resize(384, 384, { fit: "inside" }).jpeg({ quality: 70 }).toBuffer();
    sent.push({ data: small.toString("base64"), mimeType: "image/jpeg" });
  }
  const r = await llm.json<Answer>({
    task: "classify-photos",
    system: SYSTEM,
    input: `관광지: ${p.name_ko}(${p.region} · ${p.category}). 사진 ${imgs.length}장.`,
    schema: SCHEMA,
    tier: "read",
    temperature: 0,
    images: sent,
  });
  if (!r.ok) {
    console.log(`  ✕ ${p.name_ko}: ${r.message}`);
    return null;
  }
  const byIndex = new Map(r.data.photos.map((a) => [a.index, a]));
  if (imgs.some((_, i) => !byIndex.has(i))) {
    console.log(`  ✕ ${p.name_ko}: 답이 빠진 사진이 있음`);
    return null;
  }
  return imgs.map((img, i) => {
    const a = byIndex.get(i)!;
    return { url: img.url, kogl_type: img.kogl_type, kind: a.kind, ...(a.kind === "facility" ? { facility: a.facility_kind === "none" ? "etc" : a.facility_kind } : {}), cover_score: a.kind === "scenery" ? a.cover_score : 0 };
  });
}

async function build() {
  const overrides: Record<string, PhotoOverride> = existsSync(OVERRIDES) ? JSON.parse(readFileSync(OVERRIDES, "utf8")) : {};
  mkdirSync(THUMBS, { recursive: true });
  const out: Record<string, PlacePhotos> = {};
  let covers = 0;
  let covers3 = 0;
  for (const p of places as Place[]) {
    const f = `${CACHE}/${p.id}.json`;
    if (!existsSync(f)) continue;
    const labeled = JSON.parse(readFileSync(f, "utf8")) as LabeledPhoto[];
    const ov = overrides[p.id];
    const photos = visiblePhotos(labeled, ov);
    if (photos.length === 0) continue;
    const cover = pickCover(labeled, ov);
    const entry: PlacePhotos = { photos };
    if (cover?.kogl_type === 1) {
      const thumb = `/photos/${p.id}.webp`;
      // 1유형만 줄여서 저장(자르기·크기 조절 허용). 4:3 가운데 자르기
      await sharp(await download(cover.url)).resize(360, 270, { fit: "cover" }).webp({ quality: 68 }).toFile(`public${thumb}`);
      entry.cover = { url: cover.url, kogl_type: 1, thumb };
      covers++;
    } else if (cover) {
      // 3유형: 저장하지 않고 원본 주소 그대로(화면에서 자르지 않고 통째로)
      entry.cover = { url: cover.url, kogl_type: 3 };
      covers3++;
    }
    out[p.id] = entry;
  }
  writeFileSync(OUT, JSON.stringify({ source: "한국관광공사 무장애 여행정보 API(detailImage2)", labeledBy: "Claude Code(사진 모음을 보고 분류) + 사람 확인", generatedAt: new Date().toISOString().slice(0, 10), places: out }, null, 1) + "\n");
  // 화면용 압축본(주소 앞부분을 빼고 배열로)
  writeFileSync(INDEX, JSON.stringify(Object.fromEntries(Object.entries(out).map(([id, v]) => [id, compactPhotos(v)]))) + "\n");
  console.log(`✓ ${OUT}: 사진 있는 곳 ${Object.keys(out).length}곳 · 대표 사진 1유형 ${covers}곳 + 3유형 ${covers3}곳 · ${INDEX}`);
}

async function main() {
  if (!buildOnly) {
    const llm = createLlm({ transport: geminiTransport(process.env.GEMINI_API_KEY!.trim()), models: { read: process.env.GEMINI_MODEL_READ?.trim(), fast: process.env.GEMINI_MODEL_FAST?.trim() }, timeoutMs: 90_000 });
    mkdirSync(CACHE, { recursive: true });
    let done = 0;
    for (const p of places as Place[]) {
      if (only && p.id !== only) continue;
      if (done >= limit) break;
      const f = `${CACHE}/${p.id}.json`;
      if (existsSync(f) && !only) continue;
      if (rawImages(p).length === 0) continue; // 사진 없는 곳은 부르지 않는다
      done++;
      const labeled = await label(llm, p);
      if (labeled === null) continue;
      writeFileSync(f, JSON.stringify(labeled, null, 1));
      const k = (x: string) => labeled.filter((l) => l.kind === x).length;
      console.log(`✓ ${p.name_ko}: 풍경 ${k("scenery")} · 편의시설 ${k("facility")} · 기타 ${k("other")}`);
    }
  }
  await build();
}

main().catch((err) => {
  console.error(`✕ ${(err as Error).message}`);
  process.exit(1);
});
