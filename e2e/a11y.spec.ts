// 접근성 기본 약속: '가 글씨 크게' 버튼, 터치 영역 44px 이상.
import { expect, test } from "@playwright/test";

test("'가 글씨 크게'를 누르면 글자가 커지고, 새로고침해도 유지된다", async ({ page }) => {
  await page.goto("/");
  const html = page.locator("html");
  const before = await html.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));

  await page.getByRole("button", { name: "가 글씨 크게" }).click();
  await expect(html).toHaveAttribute("data-font-size", "large");
  const after = await html.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(after).toBeGreaterThan(before);

  await page.reload();
  await expect(html).toHaveAttribute("data-font-size", "large");
  await expect(page.getByRole("button", { name: "가 글씨 작게" })).toHaveAttribute("aria-pressed", "true");
});

for (const path of ["/", "/plan/when", "/plan/who", "/plan/conditions", "/plan/taste"]) {
  test(`${path}: 누를 수 있는 요소는 높이 44px 이상`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const small = await page.locator("main a, main button, main select, main label:has(input)").evaluateAll((els) =>
      els
        .filter((el) => (el as HTMLElement).offsetParent !== null)
        .map((el) => ({ text: (el.textContent ?? "").trim().slice(0, 20), h: el.getBoundingClientRect().height }))
        .filter((r) => r.h < 43.5), // 소수점 반올림 오차 허용
    );
    expect(small, JSON.stringify(small)).toEqual([]);
  });
}
