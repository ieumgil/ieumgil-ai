// 움직임 규칙(11/18 모션 토큰): 누르면 작아졌다 돌아오고(press), 기기 '동작 줄이기' 설정이면 크기는 그대로 두고 색만 바뀐다.
// 이음길 안에 움직임을 끄는 버튼은 두지 않는다 — 운영체제 설정(prefers-reduced-motion)을 따른다.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";

async function pressedScale(page: Page, selector: string) {
  const el = page.locator(selector).first();
  await el.scrollIntoViewIfNeeded(); // 시작 화면 주 버튼이 첫 화면 아래로 내려갔다(11/23)
  const box = (await el.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(250);
  const t = await el.evaluate((e) => getComputedStyle(e).transform);
  await page.mouse.up();
  return t;
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("ieumgil-intro-seen", "1"));
});

test("누르면 버튼이 살짝 작아지고, 유형 타일은 덜 작아진다", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  expect(await pressedScale(page, "section[aria-labelledby=intro-title] a[href='/plan']")).toBe("matrix(0.97, 0, 0, 0.97, 0, 0)");
  await page.goto("/plan/who");
  expect(await pressedScale(page, "main button[aria-pressed]")).toBe("matrix(0.985, 0, 0, 0.985, 0, 0)");
});

test("동작 줄이기 설정이면 눌러도 크기가 그대로이고 전환 시간이 0이다", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  expect(await pressedScale(page, "section[aria-labelledby=intro-title] a[href='/plan']")).toBe("none");
  const d = await page.locator("section[aria-labelledby=intro-title] a[href='/plan']").first().evaluate((e) => parseFloat(getComputedStyle(e).transitionDuration));
  expect(d).toBeLessThan(0.001);
});

const trip = readFileSync(resolve(__dirname, "fixtures/trip-view.json"), "utf8");

async function openTrip(page: Page) {
  await page.route("https://dapi.kakao.com/**", (r) => r.abort());
  await page.route("**/api/route-line", (r) => r.fulfill({ json: { days: [null] } }));
  await page.route("**/api/legs", (r) => r.fulfill({ json: { days: [] } }));
  await page.addInitScript((t) => sessionStorage.setItem("ieumgil-trip", t), trip);
  await page.goto("/trip/new");
  await expect(page.getByRole("radio").first()).toBeVisible();
}

test("날짜 탭 밑줄은 고른 탭 아래로 미끄러져 가고(160ms), 동작 줄이기면 바로 옮겨 간다", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await openTrip(page);
  const ind = page.locator('[data-slot="tabs-indicator"]').first();
  await expect(ind).toHaveCSS("transition-duration", "0.16s, 0.16s");
  const second = page.getByRole("tab").nth(1);
  await second.click();
  const left = await second.evaluate((e) => (e as HTMLElement).offsetLeft);
  await expect(ind).toHaveCSS("transform", `matrix(1, 0, 0, 1, ${left}, 0)`);

  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(parseFloat(await ind.evaluate((e) => getComputedStyle(e).transitionDuration))).toBeLessThan(0.001);
});

test("장소 카드 '자세히'는 열 때 높이가 늘어나며 열리고, 글자는 처음부터 보인다", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await openTrip(page);
  await page.getByRole("button", { name: /^자세히/ }).first().click();
  const det = page.locator(".expand-in").first();
  await expect(det).toBeVisible();
  await expect(det).toHaveCSS("opacity", "1");
  await expect(det.getByText("도착하면")).toBeVisible();
});

test("바꾸기 시트는 아래에서 올라오고, 닫을 때 내용을 그대로 둔 채 내려간 뒤 사라진다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await openTrip(page);
  await page.getByRole("button", { name: /다른 곳으로 바꾸기/ }).first().click();
  const sheet = page.locator("[data-slot=sheet-content]");
  await expect(sheet).toHaveCSS("animation-name", "sheet-up");
  await expect(sheet).toHaveCSS("animation-duration", "0.22s");
  await page.waitForTimeout(400);
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveAttribute("data-state", "closed");
  await expect(sheet).toHaveCSS("animation-name", "sheet-down");
  await expect(sheet.getByText(/대신 갈 곳/)).toBeAttached(); // 내려가는 동안 내용이 남아 있다
  await expect(sheet).toHaveCount(0);
});

test("동작 줄이기면 시트가 바로 열리고 바로 닫힌다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openTrip(page);
  await page.getByRole("button", { name: /다른 곳으로 바꾸기/ }).first().click();
  const sheet = page.locator("[data-slot=sheet-content]");
  expect(parseFloat(await sheet.evaluate((e) => getComputedStyle(e).animationDuration))).toBeLessThan(0.001);
});

const PLAN = JSON.stringify({ startDate: "2026-12-12", endDate: "2026-12-12", arrival: "gangneung-station", transport: "taxi", travelers: ["wheelchair"], categories: ["바다·해변"], mustVisit: [] });
const questionBox = (page: Page, title: RegExp) => page.getByRole("heading", { level: 1, name: title }).locator("xpath=../..");

test("입력 단계: '다음'이면 질문이 오른쪽에서, '이전'이면 왼쪽에서 들어오고, 단계 표시와 아래 버튼은 제자리다", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript((p) => sessionStorage.setItem("ieumgil-plan", p), PLAN);
  await page.goto("/plan/who");
  await expect(questionBox(page, /누구와/)).not.toHaveAttribute("data-enter"); // 바로 들어온 화면은 움직이지 않는다

  await page.getByRole("link", { name: /다음/ }).click();
  const cond = questionBox(page, /꼭 필요한 조건/);
  await expect(cond).toHaveAttribute("data-enter", "forward");
  await expect(cond).toHaveCSS("animation-name", "step-in-forward");
  await expect(page.getByText(/3 \/ 4 단계/)).toHaveCSS("animation-name", "none");

  await page.getByRole("link", { name: "이전", exact: true }).click();
  await expect(questionBox(page, /누구와/)).toHaveAttribute("data-enter", "back"); // 다시 보인 화면도 방향을 따른다

  await page.goBack(); // 브라우저 뒤로가기는 움직이지 않는다(방금 버튼을 눌렀어도)
  await expect(questionBox(page, /꼭 필요한 조건/)).not.toHaveAttribute("data-enter");
});

test("동작 줄이기면 입력 단계가 바로 바뀐다", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript((p) => sessionStorage.setItem("ieumgil-plan", p), PLAN);
  await page.goto("/plan/who");
  await page.getByRole("link", { name: /다음/ }).click();
  const cond = questionBox(page, /꼭 필요한 조건/);
  await expect(cond).toHaveAttribute("data-enter", "forward");
  expect(parseFloat(await cond.evaluate((e) => getComputedStyle(e).animationDuration))).toBeLessThan(0.001);
});

// 11/23 타임라인 스크롤 진행 표시: 작은 원이 출발 깃발부터 세로선을 따라 내려가고, 지나온 선이 채워진다. 인쇄에는 없다.
test("일정 타임라인: 스크롤하면 진행 원이 세로선을 따라 내려가고, 인쇄에는 나오지 않는다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openTrip(page);
  const bar = page.locator("[data-timeline-progress]:visible").first();
  await expect(bar).toHaveAttribute("aria-hidden", "true");
  const progress = () => bar.evaluate((el) => Number(getComputedStyle(el).getPropertyValue("--progress")));
  const dotTop = () => bar.locator("span").nth(1).evaluate((el) => el.getBoundingClientRect().top - el.parentElement!.getBoundingClientRect().top);
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect.poll(progress).toBe(0);
  const before = await dotTop();
  await bar.evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.45 + el.getBoundingClientRect().height / 2));
  await expect.poll(progress).toBeGreaterThan(0.3);
  expect(await dotTop()).toBeGreaterThan(before);
  await page.emulateMedia({ media: "print" });
  await expect(bar).toBeHidden();
});
