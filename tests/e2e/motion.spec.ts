// 움직임 규칙(11/18 모션 토큰): 누르면 작아졌다 돌아오고(press), 기기 '동작 줄이기' 설정이면 크기는 그대로 두고 색만 바뀐다.
// 이음길 안에 움직임을 끄는 버튼은 두지 않는다 — 운영체제 설정(prefers-reduced-motion)을 따른다.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";

async function pressedScale(page: Page, selector: string) {
  const el = page.locator(selector).first();
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
  expect(await pressedScale(page, "a[href='/plan']")).toBe("matrix(0.97, 0, 0, 0.97, 0, 0)");
  await page.goto("/plan/who");
  expect(await pressedScale(page, "main button[aria-pressed]")).toBe("matrix(0.985, 0, 0, 0.985, 0, 0)");
});

test("동작 줄이기 설정이면 눌러도 크기가 그대로이고 전환 시간이 0이다", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  expect(await pressedScale(page, "a[href='/plan']")).toBe("none");
  const d = await page.locator("a[href='/plan']").first().evaluate((e) => parseFloat(getComputedStyle(e).transitionDuration));
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
  await expect(det.getByText("AI 판단 이유")).toBeVisible();
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
