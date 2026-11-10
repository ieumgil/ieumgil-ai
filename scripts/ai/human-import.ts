// 조사 담당이 채운 사람 판정 양식(data/eval/human-40.csv) → data/eval/human.json
// 사용: npx tsx scripts/ai/human-import.ts [파일]   (그다음 merge-places.ts를 돌리면 등급 human으로 반영)
// 값이 하나라도 있는 칸만 옮긴다. 형식이 틀린 칸은 옮기지 않고 목록으로 알려준다.

import { readFileSync, writeFileSync } from "node:fs";
import { CONDITION_LABELS } from "../../src/lib/engine/conditions";
import { ACCESS_KEYS, type AccessKey, type AccessMethod, type AccessStatus } from "../../src/lib/types";

const file = process.argv[2] ?? "data/eval/human-40.csv";

/** 따옴표 칸을 지원하는 작은 CSV 읽기 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quoted) {
      if (ch === '"' && s[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell || row.length) rows.push([...row, cell]);
  return rows.filter((r) => r.some((c) => c.trim()));
}

const VALUES: AccessStatus[] = ["가능", "부분가능", "불가", "모름"];
const METHODS: AccessMethod[] = ["전화 확인", "현장 확인", "열린관광", "지자체 누리집", "관광공사 API", "기타"];
const labelToKey = new Map<string, AccessKey>(ACCESS_KEYS.map((k) => [CONDITION_LABELS[k], k]));

const [head, ...rest] = parseCsv(readFileSync(file, "utf8"));
const col = (name: string) => head.findIndex((h) => h.startsWith(name));
const idCol = col("id");
const methodCol = col("확인 방법");
const dateCol = col("확인일");
const parkCol = col("주차장→입구");
const routeCol = col("관람 동선 길이");
const distNoteCol = col("거리 메모");

const out: Record<string, Record<string, unknown>> = {};
const problems: string[] = [];
const num = (v: string) => (v.trim() && /^\d+$/.test(v.trim()) ? Number(v.trim()) : undefined);

for (const r of rest) {
  const id = r[idCol]?.trim();
  if (!id || !/^(GN|SC|DH)\d+$/.test(id)) continue; // 안내 줄 등
  const method = (r[methodCol]?.trim() || "전화 확인") as AccessMethod;
  const date = r[dateCol]?.trim() ?? "";
  if (!METHODS.includes(method)) problems.push(`${id}: 확인 방법 "${method}"은 ${METHODS.join("/")} 중 하나여야 해요`);
  const entry: Record<string, unknown> = {};
  const access: Record<string, unknown> = {};

  head.forEach((h, i) => {
    const m = h.match(/^(.*) 값$/);
    const key = m && labelToKey.get(m[1]);
    const value = r[i]?.trim();
    if (!key || !value) return;
    if (!VALUES.includes(value as AccessStatus)) return void problems.push(`${id} ${m![1]}: "${value}"는 가능/부분가능/불가/모름 중 하나여야 해요`);
    const note = r[i + 1]?.trim();
    if (value === "부분가능" && !note) return void problems.push(`${id} ${m![1]}: 부분가능이면 메모가 필요해요`);
    access[key] = {
      value,
      ...(note ? { note } : {}),
      ...(value === "모름" ? { ask: note || "현장에 직접 확인해 주세요" } : {}),
      method,
      verified_at: date,
    };
  });

  const park = num(r[parkCol] ?? "");
  const route = num(r[routeCol] ?? "");
  const distNote = r[distNoteCol]?.trim() || undefined;
  if (park !== undefined) entry.parking_to_entrance = { meters: park, ...(distNote ? { note: distNote } : {}) };
  if (route !== undefined) entry.route_length = { meters: route, ...(distNote ? { note: distNote } : {}) };
  if (Object.keys(access).length) entry.access = access;
  if (!Object.keys(entry).length) continue;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    problems.push(`${id}: 확인일을 yyyy-mm-dd로 적어 주세요`);
    continue;
  }
  out[id] = entry;
}

writeFileSync("data/eval/human.json", JSON.stringify(out, null, 2) + "\n");
console.log(`✓ data/eval/human.json · ${Object.keys(out).length}곳`);
if (problems.length) {
  console.log(`옮기지 않은 칸 ${problems.length}개:`);
  problems.forEach((p) => console.log(`  - ${p}`));
}
