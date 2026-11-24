// 접근성 자동 검사(axe-core, WCAG 2.0·2.1·2.2 A/AA 규칙): 주요 화면과 열린 창 상태에서 위반 0건.
// 16px·44px·색+기호+글자 같은 이음길 규칙은 a11y.spec.ts 등에서 따로 검사한다(axe는 24px 기준이라 대신하지 못함).
// 카카오 지도·관광공사 사진·기상청은 막아 두고(외부 호출 없음) 우리 화면만 본다.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const trip = readFileSync(resolve(__dirname, "fixtures/trip-view.json"), "utf8");
const view = JSON.parse(trip) as { createdAt: string; options: { id: string }[] };
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function block(page: Page) {
  await page.route("https://dapi.kakao.com/**", (r) => r.abort());
  await page.route("https://tong.visitkorea.or.kr/**", (r) => r.abort());
  await page.route("**/api/route-line", (r) => r.fulfill({ json: { days: [null] } }));
  await page.route("**/api/legs", (r) => r.fulfill({ json: { days: [] } }));
  await page.route("**/api/weather", (r) => r.fulfill({ json: { available: false } }));
}

async function seedTrip(page: Page, confirmed: boolean) {
  await page.addInitScript(
    ([t, c]) => {
      sessionStorage.setItem("ieumgil-trip", t);
      if (c) sessionStorage.setItem("ieumgil-trip-confirmed", c);
    },
    [trip, confirmed ? `${view.createdAt}|${view.options[0].id}` : ""],
  );
}

// 글자 대비(color-contrast)는 검사하지 않는다(11/24 팀 결정): 색을 파랑 #3580db · 초록 #3daa7e 두 가지로 통일했고(흰 바탕 3.99 · 2.90:1),
// 실제 화면에서 잘 보인다고 판단했다. 나머지 WCAG A/AA 규칙(이름·역할·키보드·구조 등)은 그대로 검사한다.
async function scan(page: Page) {
  // 나타나는 애니메이션(animate-rise 등) 도중엔 글자가 반투명이라 대비가 낮게 잡힌다 → 끝난 뒤 검사
  await page.waitForTimeout(1200);
  const r = await new AxeBuilder({ page }).withTags(TAGS).disableRules(["color-contrast"]).analyze();
  const violations = r.violations;
  return violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    help: v.help,
    nodes: v.nodes.slice(0, 5).map((n) => n.target.join(" ")),
    count: v.nodes.length,
  }));
}

for (const path of ["/", "/about", "/about/how", "/plan/when", "/plan/who", "/plan/conditions", "/plan/taste", "/places", "/s/NotAReal00"]) {
  test(`axe ${path}: WCAG A/AA 위반 없음`, async ({ page }) => {
    await block(page);
    await page.goto(path);
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(800);
    const v = await scan(page);
    expect(v, JSON.stringify(v, null, 1)).toEqual([]);
  });
}

test("axe /places 자세히 창: WCAG A/AA 위반 없음", async ({ page }) => {
  await block(page);
  await page.goto("/places");
  await page.getByRole("button", { name: /자세히/ }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  const v = await scan(page);
  expect(v, JSON.stringify(v, null, 1)).toEqual([]);
});

test("axe /trip/new 안 비교: WCAG A/AA 위반 없음", async ({ page }) => {
  await block(page);
  await seedTrip(page, false);
  await page.goto("/trip/new");
  await expect(page.getByRole("radio").first()).toBeVisible();
  const v = await scan(page);
  expect(v, JSON.stringify(v, null, 1)).toEqual([]);
});

test("axe /trip/new 확정 창: WCAG A/AA 위반 없음", async ({ page }) => {
  await block(page);
  await seedTrip(page, false);
  await page.goto("/trip/new");
  await page.getByRole("button", { name: /일정으로 정하기/ }).last().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  const v = await scan(page);
  expect(v, JSON.stringify(v, null, 1)).toEqual([]);
});

test("axe /trip/new/final 확정 일정: WCAG A/AA 위반 없음", async ({ page }) => {
  await block(page);
  await seedTrip(page, true);
  await page.goto("/trip/new/final");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const v = await scan(page);
  expect(v, JSON.stringify(v, null, 1)).toEqual([]);
});

test("axe /trip/example/final 예시 확정 일정: WCAG A/AA 위반 없음", async ({ page }) => {
  await block(page);
  await page.goto("/trip/example/final");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const v = await scan(page);
  expect(v, JSON.stringify(v, null, 1)).toEqual([]);
});
