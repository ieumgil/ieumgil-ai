// 공중화장실 공공데이터(행정안전부 「전국공중화장실표준데이터」) 원본 CSV → 관광지에 짝지은 요약.
// 사용: npm run data:public
//   입력: data/raw/public/public-restrooms-gangwon.csv (cp949, 커밋하지 않는다. data/raw/는 gitignore)
//         data/places.json (장소 id·이름·지역만 읽는다)
//   결과: data/public/restrooms.json   — 장소 id → 짝지은 화장실 요약 + 출처·통계(빌드가 읽는 유일한 공공데이터 파일, 커밋)
//         docs/data/public-restrooms.md — 짝짓기 결과 보고서(사람이 본다, 커밋)
// 원본이 없으면 아무것도 쓰지 않고 멈춘다. 다시 돌려도 같은 파일이 나온다(날짜·시각을 쓰지 않는다).
// 원본은 저장소에 올리지 않는다: 아래 주소에서 강원 파일을 받아 위 경로에 저장한다.
//   https://www.data.go.kr/data/15012892/standard.do

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { buildRestroomsFile, type ExcludedMatch, type RestroomsFile } from "../../src/lib/public/restrooms";
import type { Place } from "../../src/lib/types";

const RAW_CSV = "data/raw/public/public-restrooms-gangwon.csv";
const OUT_JSON = "data/public/restrooms.json";
const OUT_REPORT = "docs/data/public-restrooms.md";

if (!existsSync(RAW_CSV)) {
  console.error(`✕ 원본 파일이 없어요: ${RAW_CSV}`);
  console.error("  https://www.data.go.kr/data/15012892/standard.do 에서 강원 파일을 받아 위 경로에 저장한 뒤 다시 실행하세요.");
  console.error("  (아무것도 쓰지 않았어요. 원본은 저장소에 올리지 않아요.)");
  process.exit(1);
}

const csv = new TextDecoder("euc-kr").decode(readFileSync(RAW_CSV)); // cp949
const places = (JSON.parse(readFileSync("data/places.json", "utf8")) as Place[]).map((p) => ({
  id: p.id,
  name_ko: p.name_ko,
  region: p.region,
}));
const nameOf = new Map(places.map((p) => [p.id, p.name_ko]));
// 표 칸에는 세로줄·줄바꿈이 없어야 한다
const cell = (t: string) => t.replace(/[|\r\n]/g, " ").trim();

const { file, excluded, badColumnRows, firstBadColumnRow } = buildRestroomsFile(csv, places);

mkdirSync("data/public", { recursive: true });
writeFileSync(OUT_JSON, JSON.stringify(file, null, 2) + "\n");
mkdirSync("docs/data", { recursive: true });
writeFileSync(OUT_REPORT, report(file, excluded, badColumnRows));

const s = file.source;
console.log(
  `✓ ${OUT_JSON} · 전체 ${s.rows}행 · 3개 시 ${s.rows_3_cities}행(강릉 ${s.by_city.강릉} · 속초 ${s.by_city.속초} · 동해 ${s.by_city.동해}) · 중복 합치면 ${s.unique_3_cities}곳 · 관광지 짝 ${s.matched_places}곳 · 값 보충 ${s.places_with_values}곳 · 제외한 짝 ${excluded.length} · 열 개수가 달라 버린 행 ${badColumnRows}`,
);
if (badColumnRows > 0) {
  console.warn(
    `! 열 개수가 헤더와 다른 행 ${badColumnRows}개를 버렸어요(첫 행 번호 ${firstBadColumnRow}, 헤더가 1). 원본 파일의 따옴표·쉼표를 확인해 주세요.`,
  );
}
console.log(`✓ ${OUT_REPORT}`);

function report(f: RestroomsFile, ex: ExcludedMatch[], badColumnRows: number): string {
  const s = f.source;
  const ids = Object.keys(f.places).sort();
  const lines: string[] = [
    "# 공중화장실 공공데이터 짝짓기 결과",
    "",
    "관광공사 데이터에는 '장애인 화장실'·'기저귀 교환대'가 '모름'인 곳이 많다. 행정안전부 공중화장실 데이터와 이름이 맞는 관광지는 이 값을 '가능'(출처 등급 public)으로 보충한다.",
    "있음(개방 중 + 장애인용 대변기 칸 1개 이상, 또는 기저귀 교환대 Y)일 때만 '가능'으로 올리고, 없다고 해서 내리지 않는다(없음 = 모름).",
    "",
    "## 출처",
    "",
    `- 제공: ${s.provider} 「${s.dataset}」`,
    `- 주소: ${s.url}`,
    `- 이용허락범위: ${s.license.replace(/^이용허락범위\s*/, "")}`,
    `- 데이터 기준일: ${s.dates.join(", ")}`,
    "- 원본 CSV(cp949)는 저장소에 없다(`data/raw/`는 커밋하지 않는다). 짝지은 결과만 `data/public/restrooms.json`에 있다.",
    "",
    "## 행 기준 통계",
    "",
    `- 파일 전체: ${s.rows}행`,
    `- 강릉·속초·동해 3개 시: ${s.rows_3_cities}행 (강릉 ${s.by_city.강릉} · 속초 ${s.by_city.속초} · 동해 ${s.by_city.동해})`,
    `- 같은 화장실명·도로명·지번 중복을 합친 뒤: ${s.unique_3_cities}곳`,
    `- 장애인용 대변기 칸이 1개 이상인 행: ${s.disabled_rows}행`,
    `- 기저귀 교환대 Y인 행: ${s.diaper_rows}행`,
    `- 미개방인 행: ${s.closed_rows}행`,
    `- 데이터 기준일자 형식이 틀려 버린 행: ${s.skipped_rows}행`,
    // 0이면 줄을 넣지 않는다(지금 원본은 0 — 보고서가 달라지지 않게)
    ...(badColumnRows > 0 ? [`- 열 개수가 헤더와 달라 버린 행: ${badColumnRows}행(원본 파일을 확인할 것)`] : []),
    `- 이름이 맞은 관광지: ${s.matched_places}곳 (그중 '있음' 화장실이 있어 값을 보충하는 곳 ${s.places_with_values}곳)`,
    "",
    "## 짝짓기 규칙",
    "",
    "1. 화장실 이름에 관광지 이름이 들어 있으면 짝이다(공백·'·'·괄호 안 글자는 빼고 비교).",
    "2. 관광지 이름이 3글자 미만이면 짝짓지 않는다.",
    "3. 화장실이 있는 시와 관광지의 지역이 같아야 한다(다른 시는 제외).",
    "4. 이름에 '주유소'가 들어 있으면 제외한다.",
    "5. 주소로는 짝짓지 않는다(이름만 본다).",
    "",
    "## 제외한 짝",
    "",
  ];
  if (ex.length === 0) {
    lines.push("없음");
  } else {
    lines.push("| 장소 id | 관광지 | 화장실 | 이유 |", "| --- | --- | --- | --- |");
    for (const e of [...ex].sort((a, b) => (a.placeId < b.placeId ? -1 : a.placeId > b.placeId ? 1 : a.restroom < b.restroom ? -1 : 1))) {
      lines.push(`| ${e.placeId} | ${cell(nameOf.get(e.placeId) ?? "")} | ${cell(e.restroom)} | ${e.reason} |`);
    }
  }
  lines.push(
    "",
    "## 짝지은 관광지",
    "",
    "| 장소 id | 관광지 | 짝 수 | 장애인 칸 있는 곳 | 기저귀 Y | 근거 문단 id |",
    "| --- | --- | --- | --- | --- | --- |",
  );
  for (const id of ids) {
    const p = f.places[id];
    const disabled = p.restrooms.filter((r) => r.disabled_m + r.disabled_f > 0).length;
    const diaper = p.restrooms.filter((r) => r.diaper).length;
    const evid = p.restrooms.flatMap((r) => (r.evidence_id ? [r.evidence_id] : []));
    lines.push(`| ${id} | ${cell(p.name_ko)} | ${p.restrooms.length} | ${disabled} | ${diaper} | ${evid.join(", ") || "-"} |`);
  }
  lines.push("", "이 파일은 scripts/public/build-restrooms.ts가 만든다(손으로 고치지 않는다).", "");
  return lines.join("\n");
}
