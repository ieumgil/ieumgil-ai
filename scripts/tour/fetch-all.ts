// 강릉·속초·동해 관광지(12)·문화시설(14) 전체의 상세 5종을 받아 장소별로 저장한다.
// 먼저 probe.ts로 목록(data/raw/tour/list-*.json)을 받아 둬야 한다.
// 사용: npx tsx scripts/tour/fetch-all.ts   (장소 182곳 × 5회 ≈ 910회, 오퍼레이션마다 하루 1,000건 안)
// 이미 받은 장소는 건너뛴다(중간에 끊겨도 다시 돌리면 이어서 받음).

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { callCount, tour, tourAll, type TourItem } from "./client";

const RAW = "data/raw/tour";
const OUT = `${RAW}/places`;
mkdirSync(OUT, { recursive: true });

const lists = readdirSync(RAW).filter((f) => /^list-.+\.json$/.test(f));
if (lists.length === 0) {
  console.error("✕ 목록이 없어요. 먼저 npx tsx scripts/tour/probe.ts 를 돌려 주세요.");
  process.exit(1);
}

const sights: (TourItem & { _city: string })[] = lists.flatMap((f) => {
  const city = f.replace(/^list-|\.json$/g, "");
  return (JSON.parse(readFileSync(`${RAW}/${f}`, "utf8")) as TourItem[])
    .filter((it) => ["12", "14"].includes(String(it.contenttypeid)))
    .map((it) => ({ ...it, _city: city }));
});

async function fetchPlace(s: TourItem & { _city: string }) {
  const file = `${OUT}/${s.contentid}.json`;
  if (existsSync(file)) return "skip";
  const id = { contentId: s.contentid };
  const typed = { ...id, contentTypeId: s.contenttypeid };
  const [common, intro, info, images, withTour] = await Promise.all([
    tour("detailCommon2", id),
    tour("detailIntro2", typed),
    tourAll("detailInfo2", typed),
    tourAll("detailImage2", { ...id, imageYN: "Y" }),
    tour("detailWithTour2", id),
  ]);
  writeFileSync(
    file,
    JSON.stringify(
      {
        fetchedAt: new Date().toISOString(),
        city: s._city,
        list: s,
        common: common.items[0] ?? null,
        intro: intro.items[0] ?? null,
        info,
        images,
        withTour: withTour.items[0] ?? null,
      },
      null,
      2,
    ),
  );
  return "ok";
}

async function main() {
  console.log(`대상 ${sights.length}곳`);
  let done = 0;
  const failed: string[] = [];
  const queue = [...sights];
  // 동시에 3곳씩(곳마다 5회 병렬) — 포털에 무리 주지 않게
  await Promise.all(
    Array.from({ length: 3 }, async () => {
      for (let s = queue.shift(); s; s = queue.shift()) {
        try {
          await fetchPlace(s);
        } catch (err) {
          failed.push(`${s.title}(${s.contentid}): ${(err as Error).message}`);
        }
        done++;
        if (done % 20 === 0) console.log(`  ${done}/${sights.length} · 호출 ${callCount()}회`);
      }
    }),
  );
  console.log(`\n완료 ${done - failed.length}/${sights.length} · 이번 호출 ${callCount()}회 · 저장: ${OUT}/`);
  if (failed.length) {
    console.log(`실패 ${failed.length}곳 (다시 돌리면 이어서 받음):`);
    failed.forEach((f) => console.log(`  - ${f}`));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`✕ ${(err as Error).message}`);
  process.exit(1);
});
