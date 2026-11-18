// 소개 글 두 편(/about 서비스 소개, /about/how 만든 방법): 시작 화면 하단바에서 열리고, 서로 이어지고, 시작 버튼이 있다.
import { expect, test } from "@playwright/test";

test("시작 화면 하단바 → 서비스 소개 → 만든 방법 → 다시 소개", async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("ieumgil-intro-seen", "1"));
  await page.goto("/");
  const footer = page.getByRole("contentinfo", { name: "사이트 정보" });
  await footer.getByRole("link", { name: "서비스 소개" }).click();
  await expect(page).toHaveURL(/\/about$/);
  await expect(page.getByRole("heading", { level: 1, name: "이음길은 이런 서비스예요" })).toBeVisible();
  // 판단 표시는 기호와 글자를 함께
  await expect(page.locator("dt").filter({ hasText: "확인 필요" })).toContainText("!");
  // 꼭 알려야 할 안내는 본문에 있다
  await expect(page.getByText("지도의 경로는 일반 차량 경로예요")).toBeVisible();
  await expect(page.getByText("이름과 연락처를 받지 않아요")).toBeVisible();

  await page.getByRole("link", { name: /이음길은 이렇게 만들었어요/ }).click();
  await expect(page).toHaveURL(/\/about\/how$/);
  await expect(page.getByRole("heading", { level: 1, name: "이음길은 이렇게 만들었어요" })).toBeVisible();
  await expect(page.getByText("시각 계산과 검사(코드)")).toBeVisible();

  await page.getByRole("link", { name: /이음길은 이런 서비스예요/ }).click();
  await expect(page).toHaveURL(/\/about$/);
});

test("소개 글 끝에서 바로 일정 만들기로 간다", async ({ page }) => {
  await page.goto("/about/how");
  await page.getByRole("link", { name: "여행 루트 만들기" }).click();
  await expect(page).toHaveURL(/\/plan/);
});
