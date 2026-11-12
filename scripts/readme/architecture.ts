// README 구조도(docs/readme/architecture.png)를 만든다. 원본은 이 파일의 HTML·글이다 — 글을 고치고 다시 실행하면 된다.
// 레이아웃: 사용자 → 웹 서비스(화면·서버 API) → AI 일정 파이프라인(번호 단계 + 코드 검사) ↔ 외부 서비스·데이터.
// 화살표는 그린 뒤 칸 위치를 재서 점선으로 잇는다(글이 바뀌어 칸 크기가 달라져도 맞음). 아이콘은 서비스와 같은 lucide.
// 사용: npx tsx scripts/readme/architecture.ts
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";
import * as L from "lucide-react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const OUT = resolve("docs/readme/architecture.png");
const FONT = pathToFileURL(resolve("node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2")).href;

type IconName = keyof typeof L;
const icon = (name: IconName, size = 22, color = "currentColor") =>
  renderToStaticMarkup(createElement(L[name] as L.LucideIcon, { size, color, strokeWidth: 2, "aria-hidden": true }));

const item = (ic: IconName, title: string, sub?: string) =>
  `<div class="item"><span class="ic">${icon(ic, 22)}</span><span><b>${title}</b>${sub ? `<small>${sub}</small>` : ""}</span></div>`;

const aiStep = (id: string, n: number, title: string, purpose: string) =>
  `<div class="step" id="${id}"><span class="tag">${n}. ${title}</span><p><b>하는 일:</b> ${purpose}</p></div>`;

const codeCheck = (id: string, text: string) => `<div class="check" id="${id}">${icon("ShieldCheck", 20, "#4E5968")}<span>${text}</span></div>`;

const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>
@font-face { font-family: P; src: url("${FONT}") format("woff2"); font-weight: 100 900; }
* { box-sizing: border-box; margin: 0; }
body { font-family: P, sans-serif; color: #191F28; background: #fff; width: 2000px; word-break: keep-all; }
.canvas { position: relative; margin: 28px; padding: 44px 40px; border-radius: 28px; background: #F2F4F6; display: flex; gap: 96px; align-items: flex-start; }
.col { display: flex; flex-direction: column; }
.box { background: #fff; border: 1.5px solid #D1D6DB; border-radius: 22px; padding: 22px 24px; }
.box > h3 { display: flex; align-items: center; gap: 12px; font-size: 23px; font-weight: 800; margin-bottom: 16px; }
.badge { display: inline-flex; width: 44px; height: 44px; border-radius: 14px; align-items: center; justify-content: center; flex: none; }
.panel { background: #FFF6CC; border-radius: 16px; padding: 18px 20px; display: flex; flex-direction: column; gap: 12px; }
.panel > h4 { font-size: 20px; font-weight: 800; }
.item { display: flex; gap: 12px; align-items: flex-start; font-size: 18px; line-height: 1.45; }
.item .ic { display: inline-flex; width: 36px; height: 36px; border-radius: 50%; background: #fff; align-items: center; justify-content: center; flex: none; color: #1E6FD0; }
.item small { display: block; font-size: 15.5px; color: #4E5968; font-weight: 500; }
.mono { font-family: ui-monospace, Consolas, monospace; font-size: 16.5px; }
.user { width: 150px; align-items: center; text-align: center; margin-top: 150px; gap: 10px; }
.user .head { width: 96px; height: 96px; border-radius: 50%; background: #191F28; display: flex; align-items: center; justify-content: center; }
.user b { font-size: 22px; } .user small { font-size: 15.5px; color: #4E5968; line-height: 1.45; }
.pipe { background: #F3F8FF; border-color: #A9C8F0; width: 560px; display: flex; flex-direction: column; }
.pipe .flow { display: flex; flex-direction: column; gap: 18px; }
.step { background: #fff; border: 1.5px solid #191F28; border-radius: 6px; padding: 14px 18px 16px; }
.tag { display: inline-block; background: #FFDD55; font-weight: 800; font-size: 19px; padding: 4px 10px; border-radius: 4px; margin-bottom: 10px; }
.step p { font-size: 17.5px; line-height: 1.55; }
.check { display: flex; gap: 10px; align-items: center; background: #E9ECEF; border-radius: 10px; padding: 10px 14px; font-size: 16.5px; font-weight: 600; color: #333D4B; }
.fallback { display: flex; gap: 10px; align-items: center; background: #FFF4E5; border: 1.5px solid #E0B97A; color: #7A4A00; border-radius: 10px; padding: 12px 14px; font-size: 16.5px; font-weight: 700; margin-top: 22px; }
.side { width: 440px; gap: 34px; }
.list { display: flex; flex-direction: column; gap: 10px; background: #FAFBFC; border-radius: 12px; padding: 14px 16px; }
.list div { font-size: 16.5px; line-height: 1.45; color: #4E5968; } .list b { color: #191F28; display: block; font-size: 17.5px; }
.note { font-size: 15px; color: #4E5968; margin-top: 12px; line-height: 1.5; }
svg.links { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; overflow: visible; }
.lbl { position: absolute; transform: translate(-50%, -50%); background: #F2F4F6; padding: 2px 8px; font-size: 15.5px; font-weight: 700; color: #333D4B; white-space: nowrap; text-align: center; line-height: 1.4; }
</style></head><body><div class="canvas" id="canvas">

  <div class="col user" id="user">
    <span class="head">${icon("User", 56, "#fff")}</span>
    <b>사용자</b>
    <small>휠체어 이용자<br>보행이 불편한 어르신<br>유모차 가족</small>
  </div>

  <div class="col" style="width:410px;gap:0">
    <div class="box" id="web">
      <h3><span class="badge" style="background:#191F28">${icon("Monitor", 24, "#fff")}</span>웹 서비스 · Next.js (Vercel)</h3>
      <div class="panel" id="front">
        <h4>화면</h4>
        ${item("ListChecks", "입력 4단계", "언제·어디서 / 누구와 / 꼭 필요한 조건 / 좋아하는 곳")}
        ${item("LayoutGrid", "일정 비교 · 상세", "안 2~3개, 날짜별 카드, 지도, 관광지 사진")}
        ${item("Phone", "바꾸기 · 확정 · 전화 확인", "장소 바꾸기는 AI 없이 코드가 다시 계산")}
      </div>
      <div style="height:64px"></div>
      <div class="panel" id="back">
        <h4>서버 API</h4>
        ${item("Sparkles", '<span class="mono">POST /api/plan</span>', "일정 만들기 · 진행 상황 실시간 전송")}
        ${item("Route", '<span class="mono">POST /api/route-line</span>', "지도 경로선 · 결과 저장 안 함")}
      </div>
      <p class="note">일정·확정 기록은 이 브라우저 탭에만 보관<br>서버 저장 없음 · 이름·연락처 받지 않음</p>
    </div>
  </div>

  <div class="col">
    <div class="box pipe" id="pipe">
      <h3><span class="badge" style="background:#1E6FD0">${icon("Sparkles", 24, "#fff")}</span>AI 일정 파이프라인</h3>
      <div class="flow">
        ${codeCheck("c0", "코드: 조건·휴무로 거르고 후보 20곳 고르기")}
        ${aiStep("s1", 1, "AI 장소 판단 × 3", "“이 사람이 여기서 관광할 수 있나?” 적합·주의·확인 필요·부적합 + 이유 + 근거 문단")}
        ${codeCheck("c1", "코드: 근거 없는 판단 버림 · 안전 기준보다 낙관하면 내림")}
        ${aiStep("s2", 2, "AI 일정 2~3안", "여유롭게 · 좋아하는 곳 · 실내 위주로 장소·순서·머무는 시간·이유를 짠다(시각은 쓰지 않음)")}
        ${codeCheck("c2", "코드: 시각 계산 · 운영시간·하루 범위 검사 → 걸린 안만 다시(최대 2회)")}
        ${aiStep("s3", 3, "AI 평가자", "피로도·시간 여유·취향을 1~5점으로 매기고, 2점 이하면 한 번 더 다듬게 한다")}
      </div>
      <div class="fallback" id="fb">${icon("LifeBuoy", 20, "#7A4A00")}AI가 실패하면 → 코드만으로 규칙 일정 1안</div>
    </div>
  </div>

  <div class="col side" style="width:440px">
    <div class="box" id="gemini">
      <h3><span class="badge" style="background:#EAF2FD">${icon("BrainCircuit", 26, "#1E6FD0")}</span>Google Gemini API</h3>
      <div class="list">
        <div><b>gemini-3.5-flash-lite</b>장소 판단 · 일정 · 평가 (요청할 때)</div>
        <div><b>JSON 스키마로만 답받기</b>코드가 다시 검사 · 형식이 틀리면 1번 다시</div>
      </div>
    </div>
    <div class="box" id="data">
      <h3><span class="badge" style="background:#F2F4F6">${icon("Database", 24, "#191F28")}</span>미리 만든 데이터</h3>
      <div class="list">
        <div><b>한국관광공사 무장애 여행정보 API</b>강릉·속초·동해 182곳 → 관광지 152곳</div>
        <div><b>AI 읽기(미리 한 번)</b>문장 → 접근성 10항목 · 근거 · 모르면 질문</div>
        <div><b>관광지 사진</b>공공누리 사진 135곳 · 출처 표시</div>
      </div>
    </div>
    <div class="box" id="kakao">
      <h3><span class="badge" style="background:#FFF4E5">${icon("Map", 24, "#7A4A00")}</span>카카오</h3>
      <div class="list">
        <div><b>카카오맵 JS</b>지도 · 장소 번호 표시</div>
        <div><b>카카오모빌리티 길찾기</b>일반 차량 경로선 · 열 때마다 받고 저장 안 함</div>
      </div>
    </div>
  </div>

  <svg class="links" id="links"><defs>
    <marker id="a" viewBox="0 0 10 10" refX="8.5" refY="5" markerUnits="userSpaceOnUse" markerWidth="14" markerHeight="14" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#191F28"/></marker>
  </defs></svg>
</div>
<script>
window.drawLinks = () => {
const C = document.getElementById("canvas").getBoundingClientRect();
const svg = document.getElementById("links");
function pt(id, side, f = 0.5) {
  const r = document.getElementById(id).getBoundingClientRect();
  const x = r.left - C.left, y = r.top - C.top;
  return side === "r" ? [x + r.width, y + r.height * f] : side === "l" ? [x, y + r.height * f] : side === "t" ? [x + r.width * f, y] : [x + r.width * f, y + r.height];
}
function link(a, b, { both = false, label, via, lx, ly } = {}) {
  const [x1, y1] = a, [x2, y2] = b;
  let d;
  if (via === "down") d = "M" + x1 + " " + y1 + " V" + y2;
  else if (via === "under") { const yb = ly; d = "M" + x1 + " " + y1 + " V" + yb + " H" + x2 + " V" + y2; }
  else { const mx = lx ?? (x1 + x2) / 2; d = "M" + x1 + " " + y1 + " H" + mx + " V" + y2 + " H" + x2; }
  const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
  p.setAttribute("d", d); p.setAttribute("fill", "none"); p.setAttribute("stroke", "#191F28");
  p.setAttribute("stroke-width", "3"); p.setAttribute("stroke-dasharray", "2 6"); p.setAttribute("stroke-linecap", "round");
  p.setAttribute("marker-end", "url(#a)"); if (both) p.setAttribute("marker-start", "url(#a)");
  svg.appendChild(p);
  if (label) { const t = document.createElement("div"); t.className = "lbl"; t.innerHTML = label.text;
    t.style.left = label.x + "px"; t.style.top = label.y + "px"; document.getElementById("canvas").appendChild(t); }
}
const head = document.querySelector(".user .head").getBoundingClientRect();
const hy = head.top - C.top + head.height / 2, hx = head.right - C.left + 14;
const wl = pt("web", "l");
link([hx, hy], [wl[0] - 4, hy], { label: { text: "조건 입력<br>화면 조작", x: (hx + wl[0]) / 2, y: hy - 34 } });
const fb = pt("front", "b"), bt = pt("back", "t");
link([fb[0], fb[1] + 6], [bt[0], bt[1] - 6], { both: true, via: "down" });
const bp = pt("back", "r", 0.38), pp = pt("pipe", "l", 0.34);
link(bp, pp, { both: true, label: { text: "일정 요청 · 결과", x: (bp[0] + pp[0]) / 2, y: Math.min(bp[1], pp[1]) - 22 } });
const gl = pt("gemini", "l", 0.3), pr = [pt("pipe", "r")[0], gl[1]];
link(pr, gl, { both: true });
const dl = pt("data", "l", 0.4), pr2 = [pt("pipe", "r")[0], dl[1]];
link(dl, pr2, { label: { text: "장소 데이터", x: (dl[0] + pr2[0]) / 2, y: Math.min(dl[1], pr2[1]) - 22 } });
const rb = pt("web", "b", 0.5), kb = pt("kakao", "b", 0.5);
const yb = Math.max(rb[1], kb[1]) + 46;
link([rb[0], rb[1] + 6], [kb[0], kb[1] + 6], { via: "under", ly: yb, label: { text: "경로선 요청(저장 안 함)", x: (rb[0] + kb[0]) / 2, y: yb } });
};
</script></body></html>`;

async function main() {
  const dir = mkdtempSync(join(tmpdir(), "ieumgil-arch-"));
  const file = join(dir, "architecture.html");
  writeFileSync(file, html);
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 2060, height: 1300 }, deviceScaleFactor: 2 });
  await page.goto(pathToFileURL(file).href);
  // 글꼴이 다 들어온 뒤 칸 위치를 재서 화살표를 그린다
  await page.evaluate(async () => {
    await document.fonts.ready;
    (document.getElementById("canvas") as HTMLElement).style.paddingBottom = "96px";
    (window as unknown as { drawLinks: () => void }).drawLinks();
  });
  await page.waitForTimeout(200);
  await page.locator("#canvas").screenshot({ path: OUT });
  await b.close();
  console.log(`✓ ${OUT}`);
}

main().catch((err) => {
  console.error(`✕ ${(err as Error).message}`);
  process.exit(1);
});
