// 사람 판정 40곳 양식(CSV, 엑셀에서 열림) 만들기. AI 답은 넣지 않는다(정확도를 공정하게 재기 위해).
// 사용: npx tsx scripts/ai/human-template.ts
// 결과: data/eval/human-40.csv  → 조사 담당이 채운 뒤 scripts/ai/human-import.ts로 data/eval/human.json에 옮긴다.
// 고르는 순서: 조사표(docs/data/ 32곳)에 해당하는 장소 → 무장애 정보가 많은 곳 순서로 40곳까지.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { CONDITION_LABELS } from "../../src/lib/engine/conditions";
import { ACCESS_KEYS } from "../../src/lib/types";

interface Base {
  id: string;
  name_ko: string;
  region: string;
  phone: string;
  tour_content_id: string;
  _evidence_ids: string[];
}
const base: Base[] = JSON.parse(readFileSync("data/build/places-base.json", "utf8"));
const survey: { id: string; name: string }[] = existsSync("data/raw/tour/survey.json") ? JSON.parse(readFileSync("data/raw/tour/survey.json", "utf8")) : [];

// 조사표 이름과 맞추기(scripts/tour/report.ts와 같은 규칙)
const STOP = new Set(["강릉", "속초", "동해", "박물관", "해변", "기념공원", "공원", "일대", "시장", "거리", "전망대", "습지", "포함", "수산시장", "출렁다리", "전망", "갯배"]);
const norm = (s: string) => s.replace(/\(.*?\)/g, "").replace(/해수욕장/g, "해변").replace(/[\s·&]/g, "");
const tokens = (s: string) =>
  s
    .split(/[·()\s/,]+/)
    .flatMap((t) => [norm(t), norm(t).replace(/^(강릉|속초|동해)(시립)?/, "")])
    .filter((t) => t.length >= 2 && !STOP.has(t));
const surveyHit = (title: string) => survey.find((s) => tokens(s.name).some((tok) => norm(title).includes(tok)))?.id;

const ACCESS_FIELDS = ["parking-1", "route-1", "exit-1", "elevator-1", "restroom-1", "wheelchair-1", "stroller-1", "lactationroom-1"];
const richness = (b: Base) => b._evidence_ids.filter((id) => ACCESS_FIELDS.includes(id)).length;

const picked: (Base & { survey?: string })[] = [];
const seenSurvey = new Set<string>();
for (const b of [...base].sort((a, c) => richness(c) - richness(a))) {
  const s = surveyHit(b.name_ko);
  if (s && !seenSurvey.has(s)) {
    seenSurvey.add(s);
    picked.push({ ...b, survey: s });
  }
}
for (const b of [...base].sort((a, c) => richness(c) - richness(a))) {
  if (picked.length >= 40) break;
  if (!picked.some((p) => p.id === b.id)) picked.push(b);
}

const q = (v: string) => `"${v.replace(/"/g, '""')}"`;
const head = [
  "id",
  "장소",
  "지역",
  "공식 전화",
  "근거 문서",
  "조사표",
  ...ACCESS_KEYS.flatMap((k) => [`${CONDITION_LABELS[k]} 값`, `${CONDITION_LABELS[k]} 메모`]),
  "확인 방법(전화 확인/현장 확인/열린관광/지자체 누리집)",
  "확인일(yyyy-mm-dd)",
];
const guide = [
  "",
  "작성 안내 →",
  "",
  "",
  "",
  "",
  ...ACCESS_KEYS.flatMap(() => ["가능/부분가능/불가/모름 중 하나", "부분가능이면 어느 부분인지, 모름이면 비움"]),
  "",
  "",
];
const rows = picked.slice(0, 40).map((p) =>
  [p.id, p.name_ko, p.region, p.phone, `data/docs/places/${p.id}.md`, p.survey ?? "", ...ACCESS_KEYS.flatMap(() => ["", ""]), "", ""].map(q).join(","),
);
mkdirSync("data/eval", { recursive: true });
writeFileSync("data/eval/human-40.csv", "﻿" + [head.map(q).join(","), guide.map(q).join(","), ...rows].join("\n") + "\n");
console.log(`✓ data/eval/human-40.csv · ${rows.length}곳(조사표 해당 ${picked.filter((p) => p.survey).length}곳)`);
