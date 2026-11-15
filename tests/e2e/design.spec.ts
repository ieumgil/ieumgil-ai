// 디자인 다듬기(03단계) 시험: 제목 글꼴·새 토큰이 화면까지 실제로 이어지는지 본다.
// - D-08 제목 글꼴(고운바탕 700)은 같은 사이트(/_next/…)에서만 받는다. Google·jsDelivr·unpkg 같은 외부 글꼴 요청은 0건(개인정보 원칙 5).
// - 글꼴이 늦게 와도(대체 글꼴 Pretendard) 시작 화면 h1 줄 수가 달라지지 않는다(font-display: swap을 받아들인 조건).
// - 인쇄용 일정표(PrintSheet)는 제목 글꼴을 쓰지 않는다(서체 불변).
// 카카오 지도·관광공사 사진·기상청은 막아 두고 우리 화면만 본다.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";

const trip = readFileSync(resolve(__dirname, "fixtures/trip-view.json"), "utf8");
const view = JSON.parse(trip) as { createdAt: string; options: { id: string }[] };

const EXTERNAL_FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com", "cdn.jsdelivr.net", "unpkg.com"];

async function block(page: Page) {
  await page.route("https://dapi.kakao.com/**", (r) => r.abort());
  await page.route("https://tong.visitkorea.or.kr/**", (r) => r.abort());
  await page.route("**/api/route-line", (r) => r.fulfill({ json: { days: [null] } }));
  await page.route("**/api/legs", (r) => r.fulfill({ json: { days: [] } }));
  await page.route("**/api/weather", (r) => r.fulfill({ json: { available: false } }));
}

/** h1이 몇 줄인지: 높이 / 계산된 줄 높이 */
async function h1Lines(page: Page) {
  return page.locator("h1").first().evaluate((el) => {
    const cs = getComputedStyle(el);
    return Math.round(el.getBoundingClientRect().height / parseFloat(cs.lineHeight));
  });
}

test("제목 글꼴은 같은 사이트에서 받고 외부 글꼴 요청이 없다", async ({ page, baseURL }) => {
  await block(page);
  const origin = new URL(baseURL ?? "http://localhost:3000").origin;
  const fontUrls: string[] = [];
  const allUrls: string[] = [];
  page.on("request", (req) => {
    allUrls.push(req.url());
    if (req.resourceType() === "font") fontUrls.push(req.url());
  });
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator("h1").first()).toBeVisible();

  expect(fontUrls.length).toBeGreaterThan(0);
  for (const url of fontUrls) {
    const u = new URL(url);
    expect(u.origin, url).toBe(origin);
    expect(u.pathname.startsWith("/_next/"), url).toBe(true);
  }
  for (const url of allUrls) {
    expect(EXTERNAL_FONT_HOSTS.includes(new URL(url).hostname), url).toBe(false);
  }
  const loaded = await page.evaluate(() => [...document.fonts].filter((f) => f.family.replace(/["']/g, "").includes("Gowun Batang") && f.status === "loaded").length);
  expect(loaded).toBeGreaterThanOrEqual(1);
});

test("시작 화면 h1은 고운바탕 700 · 28px", async ({ page }) => {
  await block(page);
  await page.goto("/");
  const css = await page.locator("h1").first().evaluate((el) => {
    const cs = getComputedStyle(el);
    return { family: cs.fontFamily, weight: cs.fontWeight, size: cs.fontSize, spacing: cs.letterSpacing };
  });
  expect(css.family.replace(/["']/g, "").startsWith("Gowun Batang")).toBe(true);
  expect(css.weight).toBe("700");
  expect(css.size).toBe("28px");
  expect(css.spacing).toBe("-0.28px");
});

test("새 토큰 값", async ({ page }) => {
  await block(page);
  await page.goto("/");
  const v = await page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    const get = (n: string) => cs.getPropertyValue(n).trim();
    return { pine: get("--color-pine"), soft: get("--color-pine-soft"), control: get("--color-line-control"), display: get("--font-display") };
  });
  expect(v.pine).toBe("#2a6a50");
  expect(v.soft).toBe("#e8f3ec");
  expect(v.control).toBe("#8b95a1");
  expect(v.display).toContain("Gowun Batang");
});

test("글꼴이 늦게 와도 시작 화면 h1 줄 수가 같다", async ({ browser }, info) => {
  test.skip(info.project.name !== "mobile", "390px 휴대폰 폭에서만 본다");
  const ctxOptions = { viewport: { width: 390, height: 844 }, locale: "ko-KR", baseURL: info.project.use.baseURL };

  // 1) 글꼴을 모두 받은 뒤의 줄 수. 같은 때에 Pretendard(큰 본문 글꼴) 주소를 알아 둔다.
  const loadedCtx = await browser.newContext(ctxOptions);
  const loadedPage = await loadedCtx.newPage();
  await block(loadedPage);
  const sizes = new Map<string, number>();
  loadedPage.on("response", async (res) => {
    if (res.request().resourceType() !== "font") return;
    const body = await res.body().catch(() => null);
    if (body) sizes.set(res.url(), body.length);
  });
  await loadedPage.goto("/");
  await loadedPage.evaluate(() => document.fonts.ready);
  await loadedPage.waitForTimeout(500);
  const loadedLines = await h1Lines(loadedPage);
  const pretendard = new Set([...sizes].filter(([, n]) => n > 400_000).map(([u]) => u));
  await loadedCtx.close();
  expect(pretendard.size).toBeGreaterThan(0);

  // 2) Pretendard가 아닌 글꼴(고운바탕 조각)을 모두 막은 채의 줄 수 = 글꼴이 늦게 오는 동안 보이는 모습
  const lateCtx = await browser.newContext(ctxOptions);
  const latePage = await lateCtx.newPage();
  await block(latePage);
  await latePage.route(/\.woff2(\?.*)?$/, (r) => (pretendard.has(r.request().url()) ? r.continue() : r.abort()));
  await latePage.goto("/");
  await latePage.waitForTimeout(800);
  const lateLines = await h1Lines(latePage);
  await lateCtx.close();

  expect(lateLines).toBe(loadedLines);
});

test("인쇄 일정표는 제목 글꼴을 쓰지 않는다", async ({ page }) => {
  await block(page);
  // 예시 루트는 먼저 '정하기'를 눌러야 확정 화면이 열려서, 다른 e2e처럼 만들어 둔 일정을 탭에 넣고 연다
  await page.addInitScript(
    ([t, c]) => {
      sessionStorage.setItem("ieumgil-trip", t);
      sessionStorage.setItem("ieumgil-trip-confirmed", c);
    },
    [trip, `${view.createdAt}|${view.options[0].id}`],
  );
  await page.goto("/trip/new/final");
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  await page.emulateMedia({ media: "print" });
  const family = await page.locator(".print-sheet h1").evaluate((el) => getComputedStyle(el).fontFamily);
  expect(family).not.toContain("Gowun");
});
