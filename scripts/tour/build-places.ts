// 관광공사 원본(data/raw/tour/places/*.json) → 장소 기본 정보 + 근거 문서.
// 사용: npx tsx scripts/tour/build-places.ts
// 결과
//  - data/build/places-base.json: 기본 정보(이름·좌표·지역·전화·사진·카테고리·체류 기본값). access·hours는 ① 읽기가 채운다.
//  - data/docs/places/{id}.md: 근거 문장(문단 id + 출처). ① 읽기와 ② 판단이 이 id만 근거로 쓴다.
//  - data/place-ids.json: contentid → 우리 id(고정, 다시 만들어도 안 바뀜)
//  - data/evidence.json: 장소 id → 근거 문단 목록(서버가 ② 판단 때 읽는다. 원본 data/raw는 커밋하지 않으므로)
//  - 관광지가 아닌 곳·전화번호가 없는 곳은 빼고 이유를 출력한다.

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import type { Category, Photo, Region } from "../../src/lib/types";
import { buildEvidence, cleanText, isOutdoorClass, type RawPlace } from "./evidence";

const RAW = "data/raw/tour/places";
const ID_FILE = "data/place-ids.json";

const REGION_BY_SIGNGU: Record<string, Region> = { "150": "강릉", "210": "속초", "170": "동해" };
const PREFIX: Record<Region, string> = { 강릉: "GN", 속초: "SC", 동해: "DH" };

// 관광지가 아닌 곳: 분류(앞부분 일치) + 이름
const EXCLUDE_CLASS = ["VE06", "VE09", "VE1201", "VE1203", "VE0502", "EX0501", "EX0502"];
const EXCLUDE_NAME = /화장실|복지관|노인회|문화원|교육문화관|생활문화센터|문화교육센터|관광안내센터|탐방안내소|여객터미널|축구공원|실버타운|㈜|친화공간|버스정류장|수영장|리조트|워터피아|스파랜드|서림$|서점$/;

/** 분류체계(lclsSystm3) → 우리 카테고리 6개 */
function categoryOf(cls: string): Category | null {
  if (/^NA020[789]/.test(cls)) return "바다·해변"; // 항구·해안·해변
  if (cls === "NA030300") return "바다·해변"; // 해안 바위(추암 등)
  if (/^NA/.test(cls)) return "자연·산책";
  if (/^HS/.test(cls)) return "역사·문화";
  if (cls === "VE010100") return "역사·문화"; // 성당 등 건축
  if (/^VE01|^VE02|^VE11|^EX/.test(cls)) return "전망·체험";
  if (/^VE03/.test(cls)) return "자연·산책";
  if (/^VE04/.test(cls)) return "시장·먹거리"; // 거리·먹거리 마을
  if (/^VE07/.test(cls)) return "전시·박물관";
  return null;
}

// 권장 체류 기본값(분). 관광공사 관람 소요시간은 3%만 있어 카테고리 기본값을 쓰고, 사람이 확인하면 고친다.
const STAY: Record<Category, [number, number]> = {
  "바다·해변": [30, 60],
  "자연·산책": [40, 90],
  "역사·문화": [30, 60],
  "전시·박물관": [40, 80],
  "시장·먹거리": [40, 70],
  "전망·체험": [40, 80],
};

const PHONE = /(0\d{1,2}|1\d{3})[-.)\s]?\d{3,4}[-.\s]?\d{4}|1\d{3}-\d{4}/;
function phoneOf(p: RawPlace): string | null {
  for (const src of [p.common?.tel, p.intro?.infocenter, p.intro?.infocenterculture]) {
    const m = cleanText(src).match(PHONE);
    if (m) return m[0].replace(/[.)\s]/g, "-").replace(/-+/g, "-");
  }
  return null;
}

function photosOf(p: RawPlace): Photo[] {
  const out: Photo[] = [];
  for (const img of p.images) {
    if (img.cpyrhtDivCd !== "Type1" || !img.originimgurl) continue;
    out.push({ url: String(img.originimgurl).replace(/^http:/, "https:"), provider: "한국관광공사", kogl_type: 1, credit: cleanText(img.imgname) || undefined });
    if (out.length >= 5) break;
  }
  return out;
}

const raws: RawPlace[] = readdirSync(RAW)
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(readFileSync(`${RAW}/${f}`, "utf8")) as RawPlace)
  .sort((a, b) => cleanText(a.list.title).localeCompare(cleanText(b.list.title), "ko"));

const ids: Record<string, string> = existsSync(ID_FILE) ? JSON.parse(readFileSync(ID_FILE, "utf8")) : {};
const nextNo: Record<string, number> = { GN: 1, SC: 1, DH: 1 };
for (const id of Object.values(ids)) {
  const [, pre, no] = id.match(/^([A-Z]{2})(\d+)$/) ?? [];
  if (pre) nextNo[pre] = Math.max(nextNo[pre], Number(no) + 1);
}

const excluded: string[] = [];
const evidenceOut: Record<string, { id: string; label: string; text: string }[]> = {};
const base: { region: Region; category: Category; [k: string]: unknown }[] = [];
mkdirSync("data/docs/places", { recursive: true });
mkdirSync("data/build", { recursive: true });

for (const p of raws) {
  const title = cleanText(p.list.title);
  const contentId = String(p.list.contentid);
  const region = REGION_BY_SIGNGU[String(p.common?.lDongSignguCd ?? p.list.lDongSignguCd)];
  const cls = String(p.common?.lclsSystm3 ?? p.list.lclsSystm3 ?? "");
  const category = categoryOf(cls);
  const phone = phoneOf(p);

  const reason = !region
    ? "지역 코드 없음"
    : EXCLUDE_NAME.test(title) || EXCLUDE_CLASS.some((c) => cls.startsWith(c))
      ? `관광지 아님(${cls})`
      : !category
        ? `카테고리 없음(${cls})`
        : !phone
          ? "공식 전화번호 없음"
          : null;
  if (reason) {
    excluded.push(`${title}: ${reason}`);
    continue;
  }

  const prefix = PREFIX[region!];
  ids[contentId] ??= `${prefix}${String(nextNo[prefix]++).padStart(2, "0")}`;
  const id = ids[contentId];

  const evidence = buildEvidence(p);
  const fetched = p.fetchedAt.slice(0, 10);
  const md = [
    `# ${title} (${id})`,
    "",
    `> 출처: 한국관광공사 무장애 여행정보 API(KorWithService2) · contentid ${contentId} · 조회 ${fetched}`,
    "> 아래 문단 id가 AI 판단의 근거 id다. 원문 그대로이며 이음길이 고치지 않았다.",
    "",
    ...evidence.map((e) => `- \`${e.id}\` (${e.label}) ${e.text}`),
    "",
  ].join("\n");
  writeFileSync(`data/docs/places/${id}.md`, md);
  evidenceOut[id] = evidence;

  const [stay_min, stay_max] = STAY[category!];
  base.push({
    id,
    tour_content_id: contentId,
    name_ko: title,
    region: region!,
    category: category!,
    lat: Number(p.common?.mapy ?? p.list.mapy),
    lng: Number(p.common?.mapx ?? p.list.mapx),
    address: [cleanText(p.common?.addr1), cleanText(p.common?.addr2)].filter(Boolean).join(" "),
    phone,
    stay_min,
    stay_max,
    photos: photosOf(p),
    _verified_at: fetched,
    _evidence_ids: evidence.map((e) => e.id),
    _outdoor: isOutdoorClass(cls),
  });
}

writeFileSync(ID_FILE, JSON.stringify(Object.fromEntries(Object.entries(ids).sort()), null, 2) + "\n");
writeFileSync("data/build/places-base.json", JSON.stringify(base, null, 2) + "\n");
writeFileSync("data/evidence.json", JSON.stringify(Object.fromEntries(Object.entries(evidenceOut).sort()), null, 1) + "\n");

const by = (r: string) => base.filter((b) => b.region === r).length;
console.log(`✓ 장소 ${base.length}곳 (강릉 ${by("강릉")} · 속초 ${by("속초")} · 동해 ${by("동해")}) · 제외 ${excluded.length}곳`);
const cats: Record<string, number> = {};
base.forEach((b) => (cats[b.category] = (cats[b.category] ?? 0) + 1));
console.log("  카테고리:", cats);
console.log("  제외:");
excluded.forEach((e) => console.log(`   - ${e}`));
