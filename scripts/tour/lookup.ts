// 장소 이름으로 찾아서 상세 5종을 화면에 보여준다(저장 안 함). 비교·확인용.
// 사용: npx tsx scripts/tour/lookup.ts "진주실크박물관"
import { callCount, tour, tourAll } from "./client";

const keyword = process.argv[2];
if (!keyword) {
  console.error('사용: npx tsx scripts/tour/lookup.ts "장소 이름"');
  process.exit(1);
}

const clean = (v: unknown) => String(v ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const show = (label: string, item: Record<string, unknown> | undefined) => {
  console.log(`\n[${label}]`);
  for (const [k, v] of Object.entries(item ?? {})) if (clean(v) && !["contentid", "contenttypeid"].includes(k)) console.log(`  ${k}: ${clean(v).slice(0, 160)}`);
};

async function main() {
  const { items } = await tour("searchKeyword2", { keyword });
  if (items.length === 0) return console.log(`'${keyword}' 결과 없음`);
  const hit = items[0];
  console.log(`검색 ${items.length}건 · 첫 결과: ${hit.title} (${hit.contentid}, 유형 ${hit.contenttypeid})`);
  const id = { contentId: hit.contentid };
  const typed = { ...id, contentTypeId: hit.contenttypeid };
  const [common, intro, info, withTour] = await Promise.all([
    tour("detailCommon2", id),
    tour("detailIntro2", typed),
    tourAll("detailInfo2", typed),
    tour("detailWithTour2", id),
  ]);
  show("공통", { ...common.items[0], overview: clean(common.items[0]?.overview).slice(0, 80) + "…" });
  show("소개", intro.items[0]);
  info.forEach((i) => console.log(`  [반복] ${clean(i.infoname)}: ${clean(i.infotext).slice(0, 120)}`));
  show("무장애", withTour.items[0]);
  console.log(`\nAPI 호출 ${callCount()}회`);
}

main().catch((err) => {
  console.error(`✕ ${(err as Error).message}`);
  process.exit(1);
});
