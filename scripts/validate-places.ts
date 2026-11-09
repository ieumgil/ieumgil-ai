// 장소 데이터 검사 스크립트. `npm run build` 전에 자동으로 돈다(prebuild).
// 사용법: npm run validate:places [-- 파일경로]   (기본값 data/places.json)

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { validatePlaces } from "../src/lib/places/validate";

const file = resolve(process.argv[2] ?? "data/places.json");

let data: unknown;
try {
  data = JSON.parse(readFileSync(file, "utf8"));
} catch (err) {
  console.error(`✕ ${file}을(를) 읽지 못했어요: ${(err as Error).message}`);
  process.exit(1);
}

const { ok, issues } = validatePlaces(data);
const count = Array.isArray(data) ? data.length : 0;

if (ok) {
  console.log(`✓ 장소 데이터 검사 통과 · ${count}곳 · ${file}`);
  process.exit(0);
}

console.error(`✕ 장소 데이터 검사 실패 · 문제 ${issues.length}건 · ${file}`);
for (const issue of issues) {
  console.error(`  - ${issue.placeId ?? "?"} ${issue.path}: ${issue.message}`);
}
process.exit(1);
