// README의 'LLM이 어떻게 판단하고 추천하나요' 그림(docs/readme/flow.png)을 그린다.
// 누가 하는 일인지 색으로 나눈다: 데이터(노랑) · AI(파랑) · 코드(회색) · 화면(주황). 흐름은 → 다음 줄 ← 로 접어 높이를 줄인다.
// 사용: npx tsx scripts/readme/flow.ts   (개발 서버 필요 없음)
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

type Kind = "data" | "ai" | "code" | "screen";
type Card = { id: string; col: number; row: number; kind: Kind; title: string; sub: string; note?: string; dashed?: boolean };

const W = 2560;
const H = 1150;
const COL_W = 420;
const GAP = 70;
const X0 = 90;
const ROW_Y = [40, 270, 660, 950]; // 0: 입력 · 1: 위 줄(→) · 2: 아래 줄(←) · 3: 덧붙임
const ROW_H = [175, 190, 190, 165];
const x = (col: number) => X0 + (col - 1) * (COL_W + GAP);

const KIND: Record<Kind, { tag: string; bg: string; line: string; ink: string; tagBg: string }> = {
  data: { tag: "데이터", bg: "#FFF8EC", line: "#F0C27A", ink: "#7A4A00", tagBg: "#FFE7BF" },
  ai: { tag: "AI", bg: "#EAF2FD", line: "#1E6FD0", ink: "#1450A3", tagBg: "#1E6FD0" },
  code: { tag: "코드", bg: "#F2F4F6", line: "#A8B3B9", ink: "#191F28", tagBg: "#4E5968" },
  screen: { tag: "화면", bg: "#FFFFFF", line: "#E8743B", ink: "#191F28", tagBg: "#E8743B" },
};

const CARDS: Card[] = [
  { id: "input", col: 4, row: 0, kind: "screen", title: "입력 4단계", sub: "날짜·함께 가는 사람·꼭 필요한 조건·취향" },
  { id: "api", col: 1, row: 1, kind: "data", title: "공공 무장애 정보", sub: "관광공사 API · 영동 3개 시 152곳" },
  { id: "read", col: 2, row: 1, kind: "ai", title: "① AI 읽기 (미리)", sub: "문장 → 접근성 10개 항목", note: "근거 id · 모르면 '모름' + 질문" },
  { id: "places", col: 3, row: 1, kind: "data", title: "장소 데이터", sub: "places.json + 근거 원문" },
  { id: "filter", col: 4, row: 1, kind: "code", title: "후보 거르기", sub: "'불가'·휴무 제외 · 최대 20곳" },
  { id: "judge", col: 5, row: 1, kind: "ai", title: "② AI 판단 × 3회", sub: "적합·주의·확인 필요·부적합", note: "가드(코드): 근거 없음 버림 · 안전 하한" },
  { id: "plan", col: 5, row: 2, kind: "ai", title: "③ AI 일정 2~3안", sub: "장소·순서·체류·이유", note: "시각은 쓰지 않음" },
  { id: "check", col: 4, row: 2, kind: "code", title: "시각 계산·검사", sub: "이동 + 체류 + 여유 + 점심", note: "운영시간·휴무·하루 범위·중복" },
  { id: "review", col: 3, row: 2, kind: "ai", title: "④ AI 점검", sub: "피로도·시간 여유·취향 1~5점" },
  { id: "result", col: 2, row: 2, kind: "screen", title: "결과: 안 비교 → 상세", sub: "날짜별 시간순 카드 · 근거 · 전화" },
  { id: "final", col: 1, row: 2, kind: "screen", title: "확정 일정 + 지도", sub: "카카오 일반 차량 경로선", note: "열 때마다 받고 저장 안 함" },
  { id: "swap", col: 2, row: 3, kind: "code", title: "장소 바꾸기", sub: "판단 마친 근처 후보 · 다시 계산" },
  { id: "fallback", col: 3, row: 3, kind: "code", title: "규칙 일정 1안", sub: "AI가 실패하면 코드만으로", dashed: true },
];

const box = (id: string) => {
  const c = CARDS.find((k) => k.id === id)!;
  const l = x(c.col);
  const t = ROW_Y[c.row];
  return { l, t, r: l + COL_W, b: t + ROW_H[c.row], cx: l + COL_W / 2, cy: t + ROW_H[c.row] / 2 };
};

function card(c: Card) {
  const k = KIND[c.kind];
  const b = box(c.id);
  const tagInk = c.kind === "data" ? k.ink : "#fff";
  return `<div style="position:absolute;left:${b.l}px;top:${b.t}px;width:${COL_W}px;height:${b.b - b.t}px;box-sizing:border-box;
    background:${k.bg};border:3px ${c.dashed ? "dashed" : "solid"} ${k.line};border-radius:28px;padding:22px 26px;display:flex;flex-direction:column;gap:8px;
    box-shadow:0 6px 18px rgb(25 31 40/.06)">
    <span style="align-self:flex-start;background:${k.tagBg};color:${tagInk};font-weight:700;font-size:20px;line-height:1;padding:7px 12px;border-radius:999px">${k.tag}</span>
    <span style="font-weight:800;font-size:31px;color:${k.ink};letter-spacing:-0.02em">${c.title}</span>
    <span style="font-size:23px;color:#4E5968;line-height:1.35">${c.sub}${c.note ? `<br/><span style="color:${c.kind === "ai" ? "#1450A3" : "#4E5968"};font-weight:600">${c.note}</span>` : ""}</span>
  </div>`;
}

// 화살표: d는 SVG 경로, label은 [x, y, 글]
const ORANGE = "#E8743B";
const INK = "#4E5968";
function arrows() {
  const a = (id: string) => box(id);
  const line = (d: string, color = INK, dash = false) =>
    `<path d="${d}" fill="none" stroke="${color}" stroke-width="4" ${dash ? 'stroke-dasharray="12 10"' : ""} marker-end="url(#${color === ORANGE ? "ho" : "hi"})" stroke-linecap="round"/>`;
  const label = (lx: number, ly: number, text: string, color = INK, anchor = "middle") =>
    `<text x="${lx}" y="${ly}" text-anchor="${anchor}" font-size="22" font-weight="700" fill="${color}" paint-order="stroke" stroke="#F7FAFE" stroke-width="10">${text}</text>`;
  const [api, read, places, filter, judge, input] = ["api", "read", "places", "filter", "judge", "input"].map(a);
  const [plan, check, review, result, final, swap, fb] = ["plan", "check", "review", "result", "final", "swap", "fallback"].map(a);
  return [
    // 위 줄 →
    line(`M${api.r + 6} ${api.cy} H${read.l - 12}`),
    line(`M${read.r + 6} ${read.cy} H${places.l - 12}`),
    line(`M${places.r + 6} ${places.cy} H${filter.l - 12}`),
    line(`M${filter.r + 6} ${filter.cy} H${judge.l - 12}`),
    line(`M${input.cx} ${input.b + 6} V${filter.t - 12}`),
    // 오른쪽에서 아래 줄로
    line(`M${judge.r - 50} ${judge.b + 6} V${plan.t - 12}`),
    // 아래 줄 ←
    line(`M${plan.l - 6} ${plan.cy} H${check.r + 12}`),
    line(`M${check.l - 6} ${check.cy} H${review.r + 12}`),
    line(`M${review.l - 6} ${review.cy} H${result.r + 12}`),
    line(`M${result.l - 6} ${result.cy} H${final.r + 12}`, ORANGE),
    // 되돌림(주황 점선): 검사 → 계획(낮게), 점검 → 계획(높게). 글은 출발점 왼쪽 위에
    line(`M${check.r - 70} ${check.t - 6} C${check.r - 70} ${check.t - 70}, ${plan.l + 70} ${plan.t - 70}, ${plan.l + 70} ${plan.t - 12}`, ORANGE, true),
    label(check.r - 100, check.t - 26, "위반 → 걸린 안만 다시 (최대 2회)", ORANGE, "end"),
    line(`M${review.cx} ${review.t - 6} C${review.cx} ${review.t - 150}, ${plan.cx + 40} ${plan.t - 150}, ${plan.cx + 40} ${plan.t - 12}`, ORANGE, true),
    label(review.cx - 24, review.t - 26, "점수 2점 이하 → 1회 개선", ORANGE, "end"),
    // 결과 ↔ 바꾸기
    line(`M${result.cx - 40} ${result.b + 6} V${swap.t - 12}`),
    line(`M${swap.cx + 40} ${swap.t - 6} V${result.b + 12}`),
    label(result.cx + 60, (result.b + swap.t) / 2 + 8, "AI 호출 없음", INK, "start"),
    // AI 실패 → 규칙 일정 → 결과
    line(`M${fb.l - 6} ${fb.cy - 30} C${fb.l - 50} ${fb.cy - 30}, ${result.r - 30} ${result.b + 40}, ${result.r - 30} ${result.b + 12}`, INK, true),
  ].join("");
}

function legend() {
  const items = (Object.keys(KIND) as Kind[]).map((k) => {
    const s = KIND[k];
    const label = { data: "공공데이터·장소 데이터", ai: "AI가 읽고·판단하고·계획·점검", code: "코드가 계산·검사(강제)", screen: "사용자가 보는 화면" }[k];
    return `<span style="display:inline-flex;align-items:center;gap:12px;font-size:23px;color:#191F28">
      <span style="width:30px;height:30px;border-radius:10px;background:${s.bg};border:3px solid ${s.line}"></span>${label}</span>`;
  });
  return `<div style="position:absolute;left:${X0}px;top:${ROW_Y[0]}px;width:${x(4) - X0 - 60}px;display:flex;flex-direction:column;gap:22px">
    <span style="font-weight:800;font-size:40px;color:#191F28;letter-spacing:-0.02em">LLM이 읽고·판단하고·계획하고, 코드는 계산과 검사를 강제합니다</span>
    <span style="display:flex;flex-wrap:wrap;gap:18px 36px">${items.join("")}</span>
  </div>`;
}

async function main() {
  const font = readFileSync(resolve("node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2")).toString("base64");
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    @font-face{font-family:P;src:url(data:font/woff2;base64,${font}) format("woff2");font-weight:100 900}
    *{font-family:P,sans-serif} body{margin:0}
  </style></head><body>
  <div style="position:relative;width:${W}px;height:${H}px;background:linear-gradient(180deg,#F7FAFE,#EEF4FC);overflow:hidden">
    <svg width="${W}" height="${H}" style="position:absolute;inset:0">
      <defs>
        <marker id="hi" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${INK}"/></marker>
        <marker id="ho" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${ORANGE}"/></marker>
      </defs>
      ${arrows()}
    </svg>
    ${legend()}
    ${CARDS.map(card).join("")}
  </div></body></html>`;
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: W, height: H } });
  await page.setContent(html);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: resolve("docs/readme/flow.png") });
  await b.close();
  console.log("✓ docs/readme/flow.png");
}

main().catch((err) => {
  console.error(`✕ ${(err as Error).message}`);
  process.exit(1);
});
