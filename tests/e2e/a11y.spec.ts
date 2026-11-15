// 접근성 기본 약속: 터치 영역 44px 이상(글자 크기는 rem이라 브라우저·휴대폰 설정을 따른다).
// 시작·입력 4단계에 더해 둘러보기·예시 결과·예시 확정 일정까지, 링크·버튼·select·label뿐 아니라 summary와 탭도 본다.
// 카카오 지도·관광공사 사진·경로선·이동시간·기상청은 막아 두고(외부 호출 없음) 우리 화면만 본다. 인트로는 sessionStorage로 건너뛴다.
import { expect, test, type Page } from "@playwright/test";

async function block(page: Page) {
  await page.route("https://dapi.kakao.com/**", (r) => r.abort());
  await page.route("https://tong.visitkorea.or.kr/**", (r) => r.abort());
  await page.route("**/api/route-line", (r) => r.fulfill({ json: { days: [null] } }));
  await page.route("**/api/legs", (r) => r.fulfill({ json: { days: [] } }));
  await page.route("**/api/weather", (r) => r.fulfill({ json: { available: false } }));
}

const PATHS = ["/", "/plan/when", "/plan/who", "/plan/conditions", "/plan/taste", "/places", "/trip/example", "/trip/example/final"];

for (const path of PATHS) {
  test(`${path}: 누를 수 있는 요소는 높이 44px 이상`, async ({ page }) => {
    await block(page);
    await page.addInitScript(() => sessionStorage.setItem("ieumgil-intro-seen", "1"));
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    await expect(page.locator("main").first()).toBeVisible();
    const small = await page
      .locator("main a, main button, main select, main label:has(input), main summary, main [role=tab]")
      .evaluateAll((els) =>
        els
          .filter((el) => (el as HTMLElement).offsetParent !== null)
          .map((el) => ({ text: (el.textContent ?? "").trim().slice(0, 20), h: el.getBoundingClientRect().height }))
          .filter((r) => r.h < 43.5), // 소수점 반올림 오차 허용
      );
    expect(small, JSON.stringify(small)).toEqual([]);
  });
}
