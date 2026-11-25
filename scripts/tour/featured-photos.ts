// 시작 화면 '영동 대표 관광지' 고화질 사진 만들기(11/25).
// data/featured-photos.json의 original(CC0 · CC BY · 공공누리 제1유형 원본)을 받아 4:3 가운데로 자르고 1200×900 WebP로 줄여
// public/photos/featured/{id}.webp에 저장한다. 바꾼 점(자르기·줄이기)은 JSON의 changes로 화면 출처 줄에 함께 적는다(CC BY 조건).
// 원본은 저장소에 두지 않는다. 사용: npx tsx scripts/tour/featured-photos.ts [--force]  (이미 만든 파일은 건너뛴다)
// 위키미디어는 연달아 받으면 429로 잠깐 막으므로 기다렸다 다시 받는다(최대 4번).
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import sharp from "sharp";

type Photo = { id: string; original: string };
const { photos } = JSON.parse(readFileSync("data/featured-photos.json", "utf8")) as { photos: Photo[] };
const OUT = "public/photos/featured";
const force = process.argv.includes("--force");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function download(url: string): Promise<Buffer> {
  for (let i = 0; ; i++) {
    const res = await fetch(url, { headers: { "User-Agent": "ieumgil-featured-photos/1.0" } });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    if (res.status !== 429 || i >= 3) throw new Error(`${res.status} ${url}`);
    await sleep(10_000 * 2 ** i);
  }
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  for (const p of photos) {
    if (!force && existsSync(`${OUT}/${p.id}.webp`)) {
      console.log(`· ${p.id} 있음(건너뜀)`);
      continue;
    }
    const buf = await download(p.original);
    const info = await sharp(buf).resize(1200, 900, { fit: "cover", position: "centre" }).webp({ quality: 78 }).toFile(`${OUT}/${p.id}.webp`);
    console.log(`✓ ${p.id} ${info.width}×${info.height} ${Math.round(info.size / 1024)}KB`);
    await sleep(3000);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
