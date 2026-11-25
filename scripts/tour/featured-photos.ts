// 시작 화면 '영동 대표 관광지' 고화질 사진 만들기(11/25).
// data/featured-photos.json의 original(CC0 · CC BY · 공공누리 제1유형 원본)을 받아 4:3 가운데로 자르고 1200×900 WebP로 줄여
// public/photos/featured/{id}.webp에 저장한다. 바꾼 점(자르기·줄이기)은 JSON의 changes로 화면 출처 줄에 함께 적는다(CC BY 조건).
// 원본은 저장소에 두지 않는다. 사용: npx tsx scripts/tour/featured-photos.ts [--force]  (이미 만든 파일은 건너뛴다)
// 관광지 고화질 대표 사진(11/25): … featured-photos.ts --data data/hires-photos.json --out public/photos/hires [--local 원본폴더]
//   --local: 이미 받아 둔 원본({id}.img)이 있으면 그것을 쓴다(위키미디어에 다시 요청하지 않게). 원본 폴더는 저장소 밖에 둔다.
// 위키미디어는 연달아 받으면 429로 잠깐 막으므로 기다렸다 다시 받는다(최대 4번).
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import sharp from "sharp";

type Photo = { id: string; original: string };
const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const { photos } = JSON.parse(readFileSync(arg("--data") ?? "data/featured-photos.json", "utf8")) as { photos: Photo[] };
const OUT = arg("--out") ?? "public/photos/featured";
const LOCAL = arg("--local");
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
    const local = LOCAL && existsSync(`${LOCAL}/${p.id}.img`) ? readFileSync(`${LOCAL}/${p.id}.img`) : null;
    const buf = local ?? (await download(p.original));
    // failOn none: 일부 원본(카메라가 만든 비표준 JPEG)은 끝부분이 어긋나 있어도 그림은 멀쩡하다. rotate: 세로로 찍은 사진의 방향 정보를 반영
    const info = await sharp(buf, { failOn: "none" }).rotate().resize(1200, 900, { fit: "cover", position: "centre" }).webp({ quality: 78 }).toFile(`${OUT}/${p.id}.webp`);
    console.log(`✓ ${p.id} ${info.width}×${info.height} ${Math.round(info.size / 1024)}KB`);
    if (!local) await sleep(3000);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
