// 움직임 규칙(11/18 모션 토큰): 누르면 작아졌다 돌아오고(press), 기기 '동작 줄이기' 설정이면 크기는 그대로 두고 색만 바뀐다.
// 이음길 안에 움직임을 끄는 버튼은 두지 않는다 — 운영체제 설정(prefers-reduced-motion)을 따른다.
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
