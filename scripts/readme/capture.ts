// README 화면 캡처(docs/readme/*.png)를 다시 만든다. AI를 부르지 않는다:
// 결과 화면은 심사위원이 여는 예시 일정(/trip/example, src/lib/trip/example-trip.json — 실제 AI가 미리 만든 결과)을 그대로 찍는다.
//   그래서 README 그림과 예시 일정 화면이 같다. 확정 화면은 B안을 확정한 상태(예시 칸 ':example'에 넣음). 만드는 중 화면은 진행 기록 예시를 흘려 넣는다.
// 화면 흐름 테스트는 따로 tests/e2e/fixtures/trip-view.json(11/21 결과, 공통 엘리베이터 질문 등 경우가 많음)을 쓴다.
// 예시 일정 다시 만들기: npx tsx scripts/ai/make-example.ts
// 확정 일정의 지도는 실제 카카오 지도·경로선이라 개발 서버(localhost:3000, 카카오에 등록한 주소)가 켜져 있어야 한다.
// 시작 화면 단계 소개의 휴대폰 화면(public/preview/step-*.png)도 04·08·12 캡처로 함께 바꾼다.
// README '디자인 이야기' 그림(docs/readme/design-icons.png)은 `… capture.ts design` — 앱 아이콘 · 바로가기 그림 5개 · 색을 한 줄로(서버 불필요).
// 사용: npm run dev  →  npx tsx scripts/readme/capture.ts
import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium, type Browser, type Page } from "@playwright/test";
import sharp from "sharp";

const BASE = "http://localhost:3000";
const OUT = resolve("docs/readme");
const trip = readFileSync(resolve("src/lib/trip/example-trip.json"), "utf8");
const view = JSON.parse(trip) as { createdAt: string; options: { id: string }[] };
const confirmed = `${view.createdAt}|${(view.options[1] ?? view.options[0]).id}`;
// 예시 일정과 같은 조건(휠체어 · 자가용 + 장애인 표지 · 강릉 1박 2일 · 꼭 가고 싶은 곳 오죽헌)
const plan = JSON.stringify({ ...(JSON.parse(trip) as { input: object }).input, arrival: "gangneung-station" });

// 만드는 중 화면: 일정 짜기 단계까지 흘려 넣는다(끝 신호 없음 → 진행 중 모습)
const events = [
  { stage: "rule" },
  { stage: "log", text: "조건에 맞는 곳 147곳을 찾았어요 (어려운 곳 5곳 제외)", tone: "ok" },
  { stage: "log", text: "그중 동선이 좋은 20곳을 AI에게 넘겨요", tone: "info" },
  { stage: "candidates", names: ["강릉 오죽헌·시립박물관", "강릉 선교장", "경포해수욕장", "강릉 대도호부 관아", "허난설헌 생가터", "안목해변", "송정해변", "강릉 임영관 삼문"] },
  { stage: "judge" },
  { stage: "log", text: "장소 판단 1/3번째 끝", tone: "ok" },
  { stage: "log", text: "장소 판단 2/3번째 끝", tone: "ok" },
  { stage: "log", text: "장소 판단 3/3번째 끝", tone: "ok" },
  { stage: "log", text: "적합 10 · 주의 2 · 확인 필요 7 · 부적합 2", tone: "ok" },
  { stage: "plan" },
  { stage: "log", text: "A·B·C안을 짜고 있어요", tone: "info" },
  { stage: "log", text: 'A안 "오죽헌과 솔숲 사이를 천천히 거니는 여행" 검사 통과 · 4곳', tone: "ok" },
  { stage: "log", text: "B안: 운영시간을 넘는 곳이 있어 고치는 중", tone: "fix" },
];

type Shot = { name: string; path: string; desktop?: boolean; height?: number; act?: (p: Page) => Promise<void> };

const SHOTS: Shot[] = [
  { name: "01-home", path: "/" },
  { name: "02-when", path: "/plan/when" },
  { name: "03-who", path: "/plan/who" },
  { name: "04-conditions", path: "/plan/conditions" },
  { name: "05-taste", path: "/plan/taste" },
  {
    name: "06-making",
    path: "/plan/making",
    act: async (p) => {
      await p.getByText("B안: 운영시간을 넘는 곳이 있어 고치는 중").last().waitFor();
      await p.waitForTimeout(1200);
    },
  },
  { name: "07-result-compare", path: "/trip/example" },
  {
    name: "08-result-detail",
    path: "/trip/example",
    act: async (p) => {
      const more = p.getByRole("button", { name: /자세히/ }).first();
      await more.click();
      const h = await pinHeader(p);
      await p.locator("article").first().evaluate((el) => el.scrollIntoView({ block: "start" }));
      await p.evaluate((y) => window.scrollBy(0, -y), h + 12);
    },
  },
  {
    name: "09-swap",
    path: "/trip/example",
    act: async (p) => {
      await p.getByRole("button", { name: /다른 곳으로 바꾸기/ }).first().click();
      await p.getByRole("dialog").getByRole("button", { name: "이곳으로 바꾸기" }).first().waitFor();
      await p.waitForTimeout(500);
    },
  },
  { name: "10-final", path: "/trip/example/final", act: waitMap },
  // PC 확정 일정은 첫 장소 카드가 잘리지 않게 세로를 늘려 찍는다
  { name: "11-final-desktop", path: "/trip/example/final", desktop: true, height: 1005, act: waitMap },
  {
    name: "12-checklist",
    path: "/trip/example/final",
    act: async (p) => {
      await waitMap(p);
      const g = p.getByRole("group", { name: /전화 결과/ });
      // 확인할 곳이 둘 이상이면 하나는 괜찮대요, 하나는 어렵대요(바꾸기 권유가 보이게). 하나뿐이면 어렵대요
      if ((await g.count()) > 1) await g.nth(0).getByRole("button", { name: "괜찮대요" }).click();
      await g.last().getByRole("button", { name: "어렵대요" }).click();
      const h = await pinHeader(p);
      await p.locator("#checklist-title").evaluate((el) => el.scrollIntoView({ block: "start" }));
      await p.evaluate((y) => window.scrollBy(0, -y), h + 16);
      await p.waitForTimeout(300);
    },
  },
  // 지도 번호를 누르면 작은 카드(사진 · 시각 · 판단 · 일정에서 보기)
  {
    name: "15-map-card",
    path: "/trip/example/final",
    act: async (p) => {
      await waitMap(p);
      // 지도는 작게 시작한다(03단계) → 크게 본 뒤 번호를 누른다. 번호가 겹쳐 다른 번호가 가로채면 눌린 것과 같게 직접 누른다
      await p.getByRole("button", { name: "전체 화면" }).click();
      await p.waitForTimeout(1500);
      const pin = p.getByRole("button", { name: /^2번 .+ 정보 보기$/ }).first();
      await pin.click({ timeout: 4000 }).catch(() => pin.evaluate((el) => (el as HTMLElement).click()));
      await p.getByRole("button", { name: "일정에서 보기" }).waitFor();
      await p.waitForTimeout(1200);
    },
  },
  // 관광지 둘러보기: 지역 탭 · 분야 · 카드(사진 · 한 줄 소개 · 볼 거리 · 접근성 요약)
  { name: "16-places", path: "/places" },
  // 이번 조건으로 가기 어려운 곳과 대안(펼친 모습)
  {
    name: "17-hard",
    path: "/trip/example",
    act: async (p) => {
      const s = p.getByText(/이번 조건으로 가기 어려운 곳/);
      await s.click();
      await s.evaluate((el) => el.scrollIntoView({ block: "start" }));
      await p.evaluate(() => window.scrollBy(0, -16));
      await p.waitForTimeout(400);
    },
  },
  // 순서 고치기: 위·아래로 옮기기 · 빼기 · 처음 일정으로
  {
    name: "18-reorder",
    path: "/trip/example",
    act: async (p) => {
      await p.getByRole("button", { name: "순서 고치기" }).first().click();
      const panel = p.getByRole("region", { name: /순서 고치기/ });
      await panel.getByRole("button", { name: /아래로 옮기기/ }).first().click();
      await panel.evaluate((el) => el.scrollIntoView({ block: "start" }));
      await p.evaluate(() => window.scrollBy(0, -80));
      await p.waitForTimeout(400);
    },
  },
  // PC(README에서 휴대폰 화면과 나란히): 시작 · 안 비교(안 고르기 · 상세 · 지도 3칸) · 조건 단계(오른쪽 고른 조건 요약) · 관광지 둘러보기
  { name: "13-home-desktop", path: "/", desktop: true },
  { name: "14-compare-desktop", path: "/trip/example", desktop: true, act: waitMap },
  { name: "22-conditions-desktop", path: "/plan/conditions", desktop: true },
  { name: "23-places-desktop", path: "/places", desktop: true },
];

/** 시작 화면 미리보기에 쓰는 캡처 */
const PREVIEW: Record<string, string> = { "04-conditions": "step-conditions", "08-result-detail": "step-card", "12-checklist": "step-call" };

/** 시작 화면 휴대폰 미리보기: 캡처(780px 폭) 위에 상태 줄(9:41 · 신호 · 배터리, 흰 바탕 72px = 390 기준 36px)을 붙여 한 장으로.
 *  예전엔 상태 줄을 CSS 띠로 따로 그려서, 화면이 바뀔 때 그림만 흐려지고 띠는 가만히 있어 둘이 분리돼 보였다(11/25). 가운데 카메라 알약은 CSS(::after) */
async function withStatusBar(src: string, dst: string) {
  const W = 780;
  const H = 72;
  const bar = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#fff"/>
    <text x="64" y="46" font-family="Pretendard, 'Malgun Gothic', sans-serif" font-size="30" font-weight="600" fill="#191F28">9:41</text>
    <g transform="translate(632 26)" fill="#191F28"><rect x="0" y="14" width="6" height="8" rx="1.6"/><rect x="9" y="10" width="6" height="12" rx="1.6"/><rect x="18" y="5" width="6" height="17" rx="1.6"/><rect x="27" y="0" width="6" height="22" rx="1.6"/></g>
    <g transform="translate(676 26)"><rect x="1" y="1" width="42" height="21" rx="6" fill="none" stroke="#191F28" stroke-opacity=".4" stroke-width="2"/><rect x="4" y="4" width="36" height="15" rx="3.5" fill="#191F28"/><rect x="46" y="8" width="3" height="7" rx="1.5" fill="#191F28" fill-opacity=".4"/></g></svg>`);
  await sharp(src).extend({ top: H, background: "#ffffff" }).composite([{ input: bar, top: 0, left: 0 }]).png().toFile(dst);
}

/** 페이지 중간을 찍을 때도 사이트 머리줄(로고 · 메뉴)이 위에 보이게 화면 위에 붙인다 → 머리줄 높이를 돌려준다.
 *  시작 화면 단계 소개의 휴대폰 화면(08·12)이 '확대해서 잘라 낸 그림'처럼 보이지 않게(11/24). 실제 머리줄은 따라오지 않는다 */
async function pinHeader(p: Page) {
  return p.evaluate(() => {
    const h = document.querySelector("header")!;
    Object.assign(h.style, { position: "fixed", top: "0", left: "0", right: "0" });
    return h.getBoundingClientRect().height;
  });
}

async function waitMap(p: Page) {
  await p.getByText(/차량 약 \d+분|직선으로|불러오지 못했어요/).first().waitFor({ timeout: 20_000 });
  await p.waitForTimeout(2000); // 지도 타일
}

async function capture(b: Browser, s: Shot) {
  const ctx = await b.newContext({
    viewport: s.desktop ? { width: 1440, height: s.height ?? 900 } : { width: 390, height: 844 },
    deviceScaleFactor: s.desktop ? 1 : 2,
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
    reducedMotion: "reduce",
  });
  await ctx.addInitScript(
    ([t, pl, c]) => {
      sessionStorage.setItem("ieumgil-trip", t);
      sessionStorage.setItem("ieumgil-plan", pl);
      sessionStorage.setItem("ieumgil-trip-confirmed:example", c);
    },
    [trip, plan, confirmed],
  );
  const page = await ctx.newPage();
  await page.route("**/api/plan", (r) => r.fulfill({ contentType: "application/x-ndjson", body: events.map((e) => JSON.stringify(e)).join("\n") + "\n" }));
  await page.goto(BASE + s.path, { waitUntil: "networkidle" });
  // 개발 서버 표시(Next.js 'N' 버튼) 숨기기
  await page.addStyleTag({ content: "nextjs-portal,button[aria-label=\"맨 위로\"]{display:none!important}" });
  if (s.act) await s.act(page);
  // 관광지 사진은 화면에 보일 때 불러온다 → 다 뜰 때까지 기다린다(못 불러오면 아이콘이라 계속 진행)
  await page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/${s.name}.png` });
  if (PREVIEW[s.name]) await withStatusBar(`${OUT}/${s.name}.png`, resolve(`public/preview/${PREVIEW[s.name]}.png`));
  await ctx.close();
  console.log(`✓ ${s.name}`);
}

/** 표지(cover.png): 시작 → 만드는 중 → 일정 비교 → 확정 일정(지도) */
async function cover(b: Browser) {
  await coverOf(b, "cover", ["01-home", "06-making", "07-result-compare", "10-final"]);
}

async function coverOf(b: Browser, file: string, names: string[]) {
  // 휴대폰 틀을 입힌 mock/ 이미지를 쓴다(frames를 먼저 돌려야 한다)
  const img = (n: string) => `data:image/png;base64,${readFileSync(`${OUT}/mock/${n}.png`).toString("base64")}`;
  const page = await b.newPage({ viewport: { width: 2560, height: 1360 } });
  await page.setContent(`<!doctype html><html><body style="margin:0;width:2560px;height:1360px;display:flex;align-items:center;justify-content:center;gap:24px;background:linear-gradient(135deg,#EAF2FD,#DCE8FB)">
    ${names.map((n, i) => `<img src="${img(n)}" style="height:1240px;width:auto;transform:translateY(${i % 2 ? 24 : -24}px)" />`).join("")}
  </body></html>`);
  await page.screenshot({ path: `${OUT}/${file}.png` });
  await page.close();
  console.log(`✓ ${file}`);
}

/** 공유·인쇄: 공유 창(19) → 받은 사람 화면(20, 실제 Supabase에 저장된 링크) · 인쇄용 일정표(21).
 *  공유 링크는 .env.local에 SUPABASE_URL·SUPABASE_SERVICE_ROLE_KEY가 있어야 만들어진다(없으면 19·20은 건너뜀). */
async function shareShots(b: Browser) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "ko-KR", timezoneId: "Asia/Seoul", reducedMotion: "reduce" });
  await ctx.addInitScript(([t, c]) => { sessionStorage.setItem("ieumgil-trip", t); sessionStorage.setItem("ieumgil-trip-confirmed:example", c); }, [trip, confirmed]);
  const page = await ctx.newPage();
  await page.goto(BASE + "/trip/example/final", { waitUntil: "networkidle" });
  await page.addStyleTag({ content: 'nextjs-portal,button[aria-label="맨 위로"]{display:none!important}' });
  await waitMap(page);

  // 21: 인쇄·PDF(A4 일정표) — 인쇄 모드로 A4 너비에서
  await page.setViewportSize({ width: 794, height: 1123 });
  await page.emulateMedia({ media: "print" });
  await page.addStyleTag({ content: ".print-sheet{padding:40px 44px!important;background:#fff}" }); // 종이 여백처럼
  await page.waitForTimeout(300);
  await page.locator(".print-sheet").screenshot({ path: `${OUT}/21-print.png` });
  console.log("✓ 21-print");
  await page.emulateMedia({ media: "screen" });
  await page.setViewportSize({ width: 390, height: 844 });

  await page.getByRole("button", { name: "공유 링크 만들기" }).click();
  const box = page.getByRole("textbox", { name: "공유 주소" });
  const ok = await box.waitFor({ timeout: 15_000 }).then(() => true, () => false);
  if (!ok) {
    console.log("… 공유 링크를 만들지 못해 19·20은 건너뜀(Supabase 키 확인)");
    await ctx.close();
    return;
  }
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/19-share.png` });
  console.log("✓ 19-share");
  const url = await box.inputValue();
  await ctx.close();

  // 20: 받은 사람(이 탭 기록 없음)이 링크를 열었을 때
  const other = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: "ko-KR", timezoneId: "Asia/Seoul", reducedMotion: "reduce" });
  const p2 = await other.newPage();
  await p2.goto(url, { waitUntil: "networkidle" });
  await p2.addStyleTag({ content: 'nextjs-portal,button[aria-label="맨 위로"]{display:none!important}' });
  await waitMap(p2);
  await p2.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 15_000 }).catch(() => {});
  await p2.screenshot({ path: `${OUT}/20-shared.png` });
  console.log("✓ 20-shared");
  await other.close();
}

/** 휴대폰 틀(검은 테두리 + 위쪽 상태 줄)·PC 브라우저 창 틀을 씌운 사본을 docs/readme/mock/에 만든다.
 *  원본(docs/readme/*.png)은 그대로 둔다(표지·시작 화면 미리보기가 원본을 쓴다). 바탕은 투명이라 GitHub 밝은·어두운 화면 모두에 맞는다.
 *  인쇄(21)는 종이라 틀 없이 원본을 쓴다. */
async function frames(b: Browser) {
  mkdirSync(`${OUT}/mock`, { recursive: true });
  const src = (n: string) => `data:image/png;base64,${readFileSync(`${OUT}/${n}.png`).toString("base64")}`;
  const phones = [...SHOTS.filter((s) => !s.desktop).map((s) => s.name), "19-share", "20-shared"];
  const desktops = SHOTS.filter((s) => s.desktop).map((s) => s.name);

  // 휴대폰: 화면 390×844(캡처 2배) + 상태 줄 36 · 테두리 12 · 그림자 자리 32
  const phone = await b.newPage({ viewport: { width: 520, height: 1020 }, deviceScaleFactor: 2 });
  for (const n of phones) {
    await phone.setContent(`<!doctype html><html><body style="margin:0;background:transparent">
      <div id="f" style="display:inline-block;padding:16px 32px 48px">
        <div style="padding:12px;border-radius:60px;background:#191F28;box-shadow:0 20px 40px rgb(20 80 163/.18),inset 0 0 0 2px #3A414C">
          <div style="width:390px;border-radius:48px;overflow:hidden;background:#fff">
            <div style="height:36px;display:flex;justify-content:center;align-items:center"><div style="width:96px;height:26px;border-radius:14px;background:#191F28"></div></div>
            <img src="${src(n)}" style="display:block;width:390px;height:844px" />
          </div>
        </div>
      </div></body></html>`);
    await phone.locator("#f").screenshot({ path: `${OUT}/mock/${n}.png`, omitBackground: true });
  }
  await phone.close();

  // PC: 1440×900 캡처 + 위쪽 창 막대(점 3개 · 주소)
  const pc = await b.newPage({ viewport: { width: 1560, height: 1400 }, deviceScaleFactor: 1 });
  for (const n of desktops) {
    await pc.setContent(`<!doctype html><html><body style="margin:0;background:transparent;font-family:'Malgun Gothic',sans-serif">
      <div id="f" style="display:inline-block;padding:16px 40px 56px">
        <div style="border-radius:16px;overflow:hidden;border:1px solid #D1D6DB;box-shadow:0 24px 48px rgb(20 80 163/.16);background:#fff">
          <div style="height:44px;background:#F2F4F6;display:flex;align-items:center;gap:8px;padding:0 16px;border-bottom:1px solid #E5E8EB">
            ${["#FF5F57", "#FEBC2E", "#28C840"].map((c) => `<span style="width:12px;height:12px;border-radius:50%;background:${c}"></span>`).join("")}
            <div style="margin-left:24px;flex:0 1 480px;height:28px;border-radius:14px;background:#fff;color:#4E5968;font-size:14px;display:flex;align-items:center;padding:0 16px">ieumgil-ai.vercel.app</div>
          </div>
          <img src="${src(n)}" style="display:block;width:1440px;height:auto" />
        </div>
      </div></body></html>`);
    await pc.locator("#f").screenshot({ path: `${OUT}/mock/${n}.png`, omitBackground: true });
  }
  await pc.close();
  console.log(`✓ frames(휴대폰 ${phones.length} · PC ${desktops.length})`);
}

/** README '디자인 이야기' 그림: 앱 아이콘 + 시작 화면 바로가기 그림 5개(QuickMenu ITEMS와 같은 순서·이름) + 색.
 *  연한 판 위에 올려 GitHub 어두운 화면에서도 그림이 묻히지 않게 하고, 판 밖은 투명. 글자는 Pretendard(패키지 파일을 그대로 씀). */
async function designStrip(b: Browser) {
  const img = (path: string) => `data:image/${path.endsWith(".png") ? "png" : "webp"};base64,${readFileSync(resolve(path)).toString("base64")}`;
  const font = readFileSync(resolve("node_modules/pretendard/dist/web/static/woff2/Pretendard-Medium.woff2")).toString("base64");
  const quick: [string, string][] = [
    ["여행 루트 만들기", "icon-route"],
    ["예시 루트 보기", "icon-map"],
    ["관광지 둘러보기", "icon-car"],
    ["서비스 소개", "icon-tube"],
    ["작동 원리", "icon-bag"],
  ];
  // 시작 화면(히어로·바로가기) 색 세 가지 + 다른 화면의 파랑·초록
  const colors: [string, string][] = [["시작 화면 파랑", "#1553A3"], ["시작 화면 초록", "#2F993B"], ["시작 화면 주황", "#ED7049"], ["화면 파랑", "#3580DB"], ["화면 초록", "#3DAA7E"]];
  const cell = (label: string, inner: string) => `<div class="c"><div class="i">${inner}</div><div class="l">${label}</div></div>`;
  const icon = (n: string) => `<img src="${img(`public/home/quick/${n}.png`)}" />`;
  const page = await b.newPage({ viewport: { width: 1400, height: 400 }, deviceScaleFactor: 2 });
  await page.setContent(`<!doctype html><html><head><style>
    @font-face{font-family:P;src:url(data:font/woff2;base64,${font}) format("woff2")}
    body{margin:0;background:transparent;font-family:P,sans-serif;color:#191F28}
    #f{display:inline-flex;align-items:center;gap:40px;padding:32px 40px;border-radius:24px;background:#F5F8FC}
    .c{display:flex;flex-direction:column;align-items:center;gap:12px;width:132px}
    .i{display:flex;align-items:flex-end;justify-content:center;width:96px;height:96px}.i img{max-width:96px;max-height:84px}
    .app .i{width:112px;height:112px}.app .i img{max-width:none;max-height:none;width:112px;height:112px;border-radius:24px}
    .l{font-size:17px;white-space:nowrap}
    .bar{width:1px;align-self:stretch;background:#D1D6DB}
    .sw{display:grid;grid-template-columns:auto auto;gap:10px 24px}
    .s{display:flex;align-items:center;gap:10px;font-size:16px;white-space:nowrap}.s i{display:block;width:28px;height:28px;border-radius:8px}
    .s b{font-weight:500;font-variant-numeric:tabular-nums;color:#4E5968}
  </style></head><body><div id="f">
    <div class="app">${cell("앱 아이콘", `<img src="${img("docs/brand/icon-1024.png")}" />`)}</div>
    <div class="bar"></div>
    ${quick.map(([l, n]) => cell(l, icon(n))).join("")}
    <div class="bar"></div>
    <div class="sw">${colors.map(([n, c]) => `<div class="s"><i style="background:${c}"></i>${n} <b>${c}</b></div>`).join("")}</div>
  </div></body></html>`);
  await page.locator("#f").screenshot({ path: `${OUT}/design-icons.png`, omitBackground: true });
  await page.close();
  console.log("✓ design-icons");
}

async function main() {
  const only = process.argv[2]; // 예: share → 공유·인쇄만, screens → 화면·표지만(공유 링크를 만들지 않음), cover → 표지만, frames → 틀만, design → 디자인 이야기 그림만, 15-map-card → 그 장면 하나만
  const b = await chromium.launch();
  if (only === "design") {
    await designStrip(b);
    await b.close();
    return;
  }
  if (only === "cover" || only === "frames") {
    // 이미 찍은 원본으로 표지·틀만 다시(개발 서버 필요 없음)
    await frames(b);
    if (only === "cover") await cover(b);
    await b.close();
    return;
  }
  const res = await fetch(BASE).catch(() => null);
  if (!res?.ok) throw new Error(`${BASE}에 개발 서버가 없어요. 먼저 npm run dev`);
  const one = SHOTS.find((s) => s.name === only);
  if (one) {
    await capture(b, one);
  } else {
    if (only !== "share") for (const s of SHOTS) await capture(b, s);
    if (only !== "screens") await shareShots(b);
  }
  await frames(b);
  if (!one && only !== "share") await cover(b); // 표지는 틀을 입힌 이미지로 만든다
  await b.close();
}

main().catch((err) => {
  console.error(`✕ ${(err as Error).message}`);
  process.exit(1);
});
