// 첫 접속 인트로: 탭에서 처음 시작 화면에 들어올 때만 약 1.2초 보이고 자동으로 사라진다. 누르면 바로 넘어간다.
import { expect, test } from "@playwright/test";

const intro = (page: import("@playwright/test").Page) => page.locator(".intro");

test("처음 접속하면 인트로가 보였다가 자동으로 사라지고, 새로고침하면 다시 나오지 않는다", async ({ page }) => {
  await page.goto("/");
  await expect(intro(page)).toBeVisible();
  await expect(intro(page)).toBeHidden({ timeout: 3000 });
  await expect(page.getByRole("link", { name: "여행 루트 만들기" })).toBeVisible();
  await page.reload();
  await expect(page.locator("html")).not.toHaveAttribute("data-intro", "on");
  await expect(intro(page)).toBeHidden();
});

test("인트로를 누르면 바로 넘어간다", async ({ page }) => {
  await page.goto("/");
  await expect(intro(page)).toBeVisible();
  await intro(page).click();
  await expect(intro(page)).toBeHidden({ timeout: 700 });
});

test("다른 화면으로 바로 들어오면 인트로가 없다", async ({ page }) => {
  await page.goto("/plan/when");
  await expect(page.locator("html")).not.toHaveAttribute("data-intro", "on");
});

test.describe("움직임 줄이기 설정", () => {
  test.use({ reducedMotion: "reduce" });
  test("인트로를 보여주지 않는다", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).not.toHaveAttribute("data-intro", "on");
    await expect(intro(page)).toBeHidden();
  });
});
