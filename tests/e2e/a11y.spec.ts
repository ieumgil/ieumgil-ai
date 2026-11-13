// 접근성 기본 약속: 터치 영역 44px 이상(글자 크기는 rem이라 브라우저·휴대폰 설정을 따른다).
import { expect, test } from "@playwright/test";

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
