// README 화면 캡처(docs/readme/*.png)를 다시 만든다. AI를 부르지 않는다:
// 결과 화면은 저장해 둔 실제 AI 결과(e2e/fixtures/trip-view.json), 만드는 중 화면은 진행 기록 예시를 흘려 넣는다.
// 확정 일정의 지도는 실제 카카오 지도·경로선이라 개발 서버(localhost:3000, 카카오에 등록한 주소)가 켜져 있어야 한다.
// 시작 화면 PC 미리보기(public/preview/compare.png, final.png)도 07·10 캡처로 함께 바꾼다.
// 사용: npm run dev  →  npx tsx scripts/readme/capture.ts
import { copyFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium, type Browser, type Page } from "@playwright/test";

const BASE = "http://localhost:3000";
const OUT = resolve("docs/readme");
const trip = readFileSync(resolve("e2e/fixtures/trip-view.json"), "utf8");
const view = JSON.parse(trip) as { createdAt: string; options: { id: string }[] };
const confirmed = `${view.createdAt}|${(view.options[1] ?? view.options[0]).id}`;
// 결과 데이터와 같은 조건(휠체어 · 택시 · 1박 2일 · 강릉)
const plan = JSON.stringify({
  startDate: "2026-11-21",
  endDate: "2026-11-22",
  arrival: "gangneung-station",
  transport: "taxi",
  travelers: ["wheelchair"],
  lodging: "강릉",
  categories: ["바다·해변", "역사·문화"],
  pace: "normal",
  mustVisit: ["GN12"],
});

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
  { stage: "log", text: 'A안 "여유로운 일정" 검사 통과 · 4곳', tone: "ok" },
  { stage: "log", text: "B안: 운영시간을 넘는 곳이 있어 고치는 중", tone: "fix" },
];

type Shot = { name: string; path: string; desktop?: boolean; act?: (p: Page) => Promise<void> };

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
  { name: "07-result-compare", path: "/trip/new" },
  {
    name: "08-result-detail",
    path: "/trip/new",
    act: async (p) => {
      const more = p.getByRole("button", { name: /자세히/ }).first();
      await more.click();
      await p.locator("article").first().evaluate((el) => el.scrollIntoView({ block: "start" }));
      await p.evaluate(() => window.scrollBy(0, -12));
    },
  },
  {
    name: "09-swap",
    path: "/trip/new",
    act: async (p) => {
      await p.getByRole("button", { name: /다른 곳으로 바꾸기/ }).first().click();
      await p.getByRole("dialog").getByRole("button", { name: "이곳으로 바꾸기" }).first().waitFor();
      await p.waitForTimeout(500);
    },
  },
  { name: "10-final", path: "/trip/new/final", act: waitMap },
  { name: "11-final-desktop", path: "/trip/new/final", desktop: true, act: waitMap },
  {
    name: "12-checklist",
    path: "/trip/new/final",
    act: async (p) => {
      await waitMap(p);
      const g = p.getByRole("group", { name: /전화 결과/ });
      await g.nth(0).getByRole("button", { name: "괜찮대요" }).click();
      await g.nth(1).getByRole("button", { name: "어렵대요" }).click();
      await p.locator("#checklist-title").evaluate((el) => el.scrollIntoView({ block: "start" }));
      await p.evaluate(() => window.scrollBy(0, -16));
      await p.waitForTimeout(300);
    },
  },
  // PC: 시작(왼쪽 소개 + 오른쪽 미리보기), 안 비교(안 고르기 · 상세 · 지도 3칸)
  { name: "13-home-desktop", path: "/", desktop: true },
  { name: "14-compare-desktop", path: "/trip/new", desktop: true, act: waitMap },
];

/** 시작 화면 미리보기에 쓰는 캡처 */
const PREVIEW: Record<string, string> = { "07-result-compare": "compare", "10-final": "final" };

async function waitMap(p: Page) {
  await p.getByText(/카카오\)|직선으로|불러오지 못했어요/).first().waitFor({ timeout: 20_000 });
  await p.waitForTimeout(2000); // 지도 타일
}

async function capture(b: Browser, s: Shot) {
  const ctx = await b.newContext({
    viewport: s.desktop ? { width: 1440, height: 900 } : { width: 390, height: 844 },
    deviceScaleFactor: s.desktop ? 1 : 2,
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
    reducedMotion: "reduce",
  });
  await ctx.addInitScript(
    ([t, pl, c]) => {
      sessionStorage.setItem("ieumgil-trip", t);
      sessionStorage.setItem("ieumgil-plan", pl);
      sessionStorage.setItem("ieumgil-trip-confirmed", c);
    },
    [trip, plan, confirmed],
  );
  const page = await ctx.newPage();
  await page.route("**/api/plan", (r) => r.fulfill({ contentType: "application/x-ndjson", body: events.map((e) => JSON.stringify(e)).join("\n") + "\n" }));
  await page.goto(BASE + s.path, { waitUntil: "networkidle" });
  // 개발 서버 표시(Next.js 'N' 버튼) 숨기기
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
  if (s.act) await s.act(page);
  // 관광지 사진은 화면에 보일 때 불러온다 → 다 뜰 때까지 기다린다(못 불러오면 아이콘이라 계속 진행)
  await page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/${s.name}.png` });
  if (PREVIEW[s.name]) copyFileSync(`${OUT}/${s.name}.png`, resolve(`public/preview/${PREVIEW[s.name]}.png`));
  await ctx.close();
  console.log(`✓ ${s.name}`);
}

/** 표지: 시작 → 만드는 중 → 일정 비교 → 확정 일정(지도) */
async function cover(b: Browser) {
  const img = (n: string) => `data:image/png;base64,${readFileSync(`${OUT}/${n}.png`).toString("base64")}`;
  const names = ["01-home", "06-making", "07-result-compare", "10-final"];
  const page = await b.newPage({ viewport: { width: 2560, height: 1360 } });
  await page.setContent(`<!doctype html><html><body style="margin:0;width:2560px;height:1360px;display:flex;align-items:center;justify-content:center;gap:56px;background:linear-gradient(135deg,#EAF2FD,#DCE8FB)">
    ${names.map((n, i) => `<img src="${img(n)}" style="width:568px;height:1229px;object-fit:cover;object-position:top;border-radius:56px;box-shadow:0 24px 64px rgb(20 80 163/.18);transform:translateY(${i % 2 ? 32 : -32}px)" />`).join("")}
  </body></html>`);
  await page.screenshot({ path: `${OUT}/cover.png` });
  await page.close();
  console.log("✓ cover");
}

async function main() {
  const res = await fetch(BASE).catch(() => null);
  if (!res?.ok) throw new Error(`${BASE}에 개발 서버가 없어요. 먼저 npm run dev`);
  const b = await chromium.launch();
  for (const s of SHOTS) await capture(b, s);
  await cover(b);
  await b.close();
}

main().catch((err) => {
  console.error(`✕ ${(err as Error).message}`);
  process.exit(1);
});
