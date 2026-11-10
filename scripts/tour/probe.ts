// 처음 한 번 돌려 보는 확인용 스크립트: 법정동 코드 → 강릉·속초·동해 목록 → 무장애 상세 표본.
// 사용: npx tsx scripts/tour/probe.ts   (호출 약 10~20회)
// 결과 원본은 data/raw/tour/에 저장한다(커밋 여부는 아직 미정이라 .gitignore에 있음).

import { mkdirSync, writeFileSync } from "node:fs";
import { callCount, tour, tourAll, type TourItem } from "./client";

const CITIES = ["강릉시", "속초시", "동해시"] as const;
const TYPE_NAME: Record<string, string> = {
  "12": "관광지", "14": "문화시설", "15": "행사", "28": "레포츠", "32": "숙박", "38": "쇼핑", "39": "음식점",
};
// 무장애 상세에서 우리 access 항목과 관련 있는 필드
const ACCESS_FIELDS = ["parking", "route", "exit", "elevator", "restroom", "wheelchair", "stroller", "lactationroom", "handicapetc", "infantsfamilyetc", "publictransport", "ticketoffice", "auditorium"];

const OUT = "data/raw/tour";
mkdirSync(OUT, { recursive: true });
const save = (name: string, data: unknown) => writeFileSync(`${OUT}/${name}.json`, JSON.stringify(data, null, 2));

async function main() {
  // 1) 시도 → 강원
  const regions = await tourAll("ldongCode2");
  const gw = regions.find((r) => String(r.name).includes("강원"));
  if (!gw) throw new Error(`강원 시도 코드를 못 찾았어요: ${regions.map((r) => r.name).join(", ")}`);
  console.log(`강원 시도 코드: ${gw.code} (${gw.name})`);

  // 2) 강원 시군구 → 강릉·속초·동해
  const sigungu = await tourAll("ldongCode2", { lDongRegnCd: gw.code });
  const cityCodes = CITIES.map((c) => {
    const hit = sigungu.find((s) => s.name === c);
    if (!hit) throw new Error(`${c} 코드를 못 찾았어요`);
    return { city: c, code: String(hit.code) };
  });
  console.log("시군구 코드:", cityCodes.map((c) => `${c.city}=${c.code}`).join(", "));
  save("ldong", { gw, cityCodes });

  // 3) 시별 전체 목록 + 유형별 개수
  const all: (TourItem & { _city: string })[] = [];
  for (const { city, code } of cityCodes) {
    const items = await tourAll("areaBasedList2", { lDongRegnCd: gw.code, lDongSignguCd: code, arrange: "A" });
    save(`list-${city}`, items);
    const byType: Record<string, number> = {};
    for (const it of items) byType[TYPE_NAME[String(it.contenttypeid)] ?? it.contenttypeid] = (byType[TYPE_NAME[String(it.contenttypeid)] ?? it.contenttypeid] ?? 0) + 1;
    console.log(`\n${city}: 전체 ${items.length}곳`, byType);
    all.push(...items.map((it) => ({ ...it, _city: city })));
  }

  // 4) 관광지·문화시설 이름 목록(우리 후보군)
  const sights = all.filter((it) => ["12", "14"].includes(String(it.contenttypeid)));
  console.log(`\n관광지·문화시설 합계: ${sights.length}곳`);
  for (const city of CITIES) {
    const names = sights.filter((s) => s._city === city).map((s) => s.title);
    console.log(`- ${city} (${names.length}): ${names.join(", ")}`);
  }

  // 5) 무장애 상세 표본 3곳: 어떤 필드가 실제로 채워지는지
  const samples = sights.slice(0, 1).concat(sights.filter((s) => s._city === "속초시").slice(0, 1), sights.filter((s) => s._city === "동해시").slice(0, 1));
  const details = [];
  for (const s of samples) {
    const { items } = await tour("detailWithTour2", { contentId: s.contentid });
    const d = items[0] ?? {};
    details.push({ title: s.title, contentid: s.contentid, ...d });
    console.log(`\n[표본] ${s.title} (${s.contentid})`);
    for (const f of ACCESS_FIELDS) if (d[f]) console.log(`  ${f}: ${String(d[f]).replace(/\s+/g, " ").slice(0, 120)}`);
    const empty = ACCESS_FIELDS.filter((f) => !d[f]);
    console.log(`  (비어 있음: ${empty.join(", ") || "없음"})`);
  }
  save("probe-details", details);

  console.log(`\nAPI 호출 ${callCount()}회 · 원본 저장: ${OUT}/`);
}

main().catch((err) => {
  console.error(`✕ ${(err as Error).message}`);
  process.exit(1);
});
