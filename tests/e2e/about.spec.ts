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
  await page.getByRole("main").getByRole("link", { name: "여행 루트 만들기" }).click(); // 글 끝의 버튼(머리줄 버튼과 구분)
  await expect(page).toHaveURL(/\/plan/);
});

// 11/24: PC에서는 사이트 폭을 쓰고(왼쪽 차례 + 넓은 본문), 휴대폰은 한 칸 그대로. 스크롤 등장 효과는 내용을 숨긴 채 끝나지 않는다.
test("PC 소개 글은 넓게: 왼쪽 차례가 지금 읽는 구역을 표시하고, 본문이 40rem보다 넓다", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "차례는 PC(1024px 이상)에서만");
  await page.goto("/about/how");
  const toc = page.getByRole("navigation", { name: "이 글의 차례" });
  await expect(toc).toBeVisible();
  await expect(toc.locator('[aria-current="true"]')).toHaveText("출발점은 문장으로 된 공공데이터였어요");
  const width = await page.locator("#roles").evaluate((el) => el.getBoundingClientRect().width);
  expect(width).toBeGreaterThan(640);
  // 차례를 누르면 그 구역으로 가고 표시가 따라온다
  await toc.getByRole("link", { name: "숫자로 보면" }).click();
  await expect(toc.locator('[aria-current="true"]')).toHaveText("숫자로 보면");
  // 숫자는 다 올라간 뒤 최종 값, 화면 읽기 프로그램은 처음부터 최종 값
  await expect(page.locator("#numbers dd").first()).toContainText("152곳");
  await expect(page.locator("#numbers dd").getByText("96.4%", { exact: true }).first()).toBeAttached();
});

test("휴대폰은 차례 없이 한 칸, 끝까지 스크롤하면 숨었던 구역이 모두 보인다", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "휴대폰 배치");
  await page.goto("/about");
  await expect(page.getByRole("navigation", { name: "이 글의 차례" })).toBeHidden();
  const waiting = page.locator('[data-reveal="wait"]');
  await expect.poll(() => waiting.count()).toBeGreaterThan(0); // 아래쪽은 들어올 때 나타나도록 기다리는 중(화면이 준비된 뒤 붙는다)
  const h = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y <= h; y += 300) {
    await page.evaluate((v) => window.scrollTo(0, v), y);
    await page.waitForTimeout(60);
  }
  await expect(waiting).toHaveCount(0);
});

test("동작 줄이기 설정이면 처음부터 모두 보인다(숨기지 않음)", async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.goto("/about/how");
  await page.waitForTimeout(500);
  await expect(page.locator('[data-reveal="wait"]')).toHaveCount(0);
  await ctx.close();
});
