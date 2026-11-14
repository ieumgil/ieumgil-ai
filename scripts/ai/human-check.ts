// AI 읽기 정확도 확인(사람 확인과 비교). 두 단계:
//   1) 양식 만들기:  npx tsx scripts/ai/human-check.ts template
//      → data/eval/human-check.csv (엑셀에서 열림). 대표 관광지 20곳(강릉 10 · 속초 5 · 동해 5) × 4항목.
//      AI 값은 넣지 않는다(보고 따라 적지 않도록). 사람이 열린관광(access.visitkorea.or.kr)·전화·현장으로 확인해 채운다.
//   2) 비교:        npx tsx scripts/ai/human-check.ts score
//      → data/eval/human-check.md: 항목별 일치율, AI '모름'(빈칸) 수, 위험한 다름(AI 가능 ↔ 사람 불가), 다른 칸 목록.
//      AI 값은 data/ai/read/(AI가 읽은 원래 값)에서 가져온다 — 사람 값을 places.json에 합친 뒤에도 공정하게 비교하려고.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import featured from "../../data/featured.json";
import places from "../../data/places.json";
import { compareHuman, HUMAN_CHECK_KEYS, type HumanCheckKey, type HumanRow } from "../../src/lib/ai/eval";
import { CONDITION_LABELS } from "../../src/lib/engine/conditions";
import type { AccessStatus, Place } from "../../src/lib/types";

const CSV = "data/eval/human-check.csv";
const REPORT = "data/eval/human-check.md";
const ps = places as unknown as Place[];
const byId = new Map(ps.map((p) => [p.id, p]));
const STATUS: AccessStatus[] = ["가능", "부분가능", "불가", "모름"];
const q = (v: string) => `"${v.replace(/"/g, '""')}"`;

function template() {
  if (existsSync(CSV)) throw new Error(`${CSV}이 이미 있어요(채운 내용을 덮어쓰지 않으려고 멈춤). 지우고 다시 실행하세요.`);
  const take = (region: string, n: number) => featured.ids.filter((id) => byId.get(id)?.region === region).slice(0, n);
  const ids = [...take("강릉", 10), ...take("속초", 5), ...take("동해", 5)];
  const head = ["id", "장소", "지역", "공식 전화", ...HUMAN_CHECK_KEYS.map((k) => CONDITION_LABELS[k]), "확인 방법(열린관광/전화/현장)", "확인일(yyyy-mm-dd)", "메모"];
  const guide = ["", "작성 안내 →", "", "", ...HUMAN_CHECK_KEYS.map(() => "가능/부분가능/불가/모름"), "", "", "확인 못 하면 '모름' 또는 비움"];
  const rows = ids.map((id) => {
    const p = byId.get(id)!;
    return [id, p.name_ko, p.region, p.phone, ...HUMAN_CHECK_KEYS.map(() => ""), "", "", ""].map(q).join(",");
  });
  writeFileSync(CSV, "﻿" + [head.map(q).join(","), guide.map(q).join(","), ...rows].join("\n") + "\n");
  console.log(`✓ ${CSV} · ${rows.length}곳 × ${HUMAN_CHECK_KEYS.length}항목`);
}

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
  return rows;
}

function score() {
  if (!existsSync(CSV)) throw new Error(`${CSV}이 없어요. 먼저 template으로 만들고 채워 주세요.`);
  const [head, , ...body] = parseCsv(readFileSync(CSV, "utf8"));
  const col = (k: HumanCheckKey) => head.indexOf(CONDITION_LABELS[k]);
  const bad: string[] = [];
  const rows: HumanRow[] = body
    .filter((r) => r[0]?.trim())
    .map((r) => {
      const human: HumanRow["human"] = {};
      for (const k of HUMAN_CHECK_KEYS) {
        const v = (r[col(k)] ?? "").trim();
        if (!v) continue;
        if (STATUS.includes(v as AccessStatus)) human[k] = v as AccessStatus;
        else bad.push(`${r[0]} ${CONDITION_LABELS[k]}: "${v}"`);
      }
      return { id: r[0].trim(), human };
    });

  const aiValues = new Map<string, Record<HumanCheckKey, AccessStatus>>();
  for (const { id } of rows) {
    const f = `data/ai/read/${id}.json`;
    if (!existsSync(f)) continue;
    const access = (JSON.parse(readFileSync(f, "utf8")) as { result: { access: Record<string, { value: AccessStatus }> } }).result.access;
    aiValues.set(id, Object.fromEntries(HUMAN_CHECK_KEYS.map((k) => [k, access[k]?.value ?? "모름"])) as Record<HumanCheckKey, AccessStatus>);
  }
  const r = compareHuman(rows, aiValues);
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 1000) / 10}%` : "—");
  const line = (label: string, c: (typeof r)["total"]) => {
    const known = c.compared - c.aiUnknown;
    return `| ${label} | ${c.compared} | ${c.match} | ${pct(c.match, known)} | ${c.aiUnknown} | ${c.differ} | ${c.dangerous} |`;
  };
  const md = [
    "# AI 읽기 정확도: 사람 확인과 비교",
    "",
    `사람이 열린관광·전화·현장으로 확인한 값과 AI가 관광공사 원문에서 읽은 값(\`data/ai/read/\`)을 비교했습니다. 장소 ${r.places}곳, 확인한 칸 ${r.total.compared}개.`,
    "사람이 '모름'이거나 비운 칸은 세지 않았습니다. **일치율은 AI가 값을 낸 칸(가능·부분가능·불가) 중 사람과 같은 비율**이고, AI '모름'은 틀림이 아니라 빈칸으로 따로 셉니다(화면에서는 확인할 방법을 붙입니다).",
    "",
    "| 항목 | 확인한 칸 | 같음 | 일치율 | AI 모름 | 다름 | 위험한 다름(AI 가능 ↔ 사람 불가) |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...HUMAN_CHECK_KEYS.map((k) => line(CONDITION_LABELS[k], r.byKey[k])),
    line("**합계**", r.total),
    "",
    r.diffs.length ? "## 다른 칸" : "",
    ...r.diffs.map((d) => `- ${byId.get(d.id)?.name_ko ?? d.id}(${d.id}) · ${CONDITION_LABELS[d.key]}: AI ${d.ai} / 사람 ${d.human}`),
    "",
  ].join("\n");
  writeFileSync(REPORT, md);
  console.log(`✓ ${REPORT} · ${r.places}곳 · 일치율 ${pct(r.total.match, r.total.compared - r.total.aiUnknown)} · 위험한 다름 ${r.total.dangerous}`);
  if (bad.length) console.log(`형식이 틀려 뺀 칸: ${bad.join(", ")}`);
}

const cmd = process.argv[2];
if (cmd === "template") template();
else if (cmd === "score") score();
else console.log("사용: npx tsx scripts/ai/human-check.ts template | score");
