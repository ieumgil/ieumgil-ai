// 관광지 둘러보기: 지역·분야로 둘러보고, 어떤 곳인지 보고, 담으면 4단계 '꼭 가고 싶은 곳'에 들어간다.
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("https://tong.visitkorea.or.kr/**", (r) => r.abort()); // 관광공사 원본 사진(외부 호출 없음)
  await page.addInitScript(() => {
    sessionStorage.setItem("ieumgil-intro-seen", "1");
    sessionStorage.setItem(
      "ieumgil-plan",
      JSON.stringify({ startDate: "2026-12-12", endDate: "2026-12-12", arrival: "gangneung-station", transport: "taxi", travelers: ["wheelchair"], categories: ["바다·해변"], mustVisit: [] }),
    );
  });
});

test("4단계에서 '관광지 둘러보고 고르기'로 들어가 담으면, 돌아왔을 때 꼭 가고 싶은 곳에 있다", async ({ page }) => {
  await page.goto("/plan/taste");
  await page.getByRole("link", { name: /관광지 둘러보고 고르기/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "영동 관광지 둘러보기" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "대표 관광지" })).toBeVisible();
  // 고른 유형(휠체어) 기준 접근성 요약이 카드에 있다
  await expect(page.getByText(/휠체어/).first()).toBeVisible();
  const first = page.locator("article").first();
  const name = (await first.getByRole("heading").textContent())!.replace("대표", "").trim();
  await first.getByRole("button", { name: /담기$/ }).click();
  await expect(first.getByRole("button", { name: /담기 취소/ })).toBeVisible();
  await expect(page.getByText("담은 곳 1곳")).toBeVisible();
  await page.getByRole("link", { name: /돌아가기/ }).click();
  await expect(page).toHaveURL(/\/plan\/taste$/);
  await expect(page.getByRole("list", { name: "꼭 가고 싶은 곳" })).toContainText(name);
});

test("지역·분야를 바꾸고, 볼 거리 낱말로 찾고, 자세히 보기에서 관광공사 소개와 접근성 10항목을 본다", async ({ page }) => {
  await page.goto("/places");
  await page.getByRole("radio", { name: /속초/ }).click();
  await expect(page.locator("article").first()).toContainText("속초");
  await page.getByRole("button", { name: "전시·박물관", exact: true }).click();
  const cards = page.locator("article");
  expect(await cards.count()).toBeGreaterThan(0);
  for (const t of await cards.allTextContents()) expect(t).toContain("전시·박물관");
  await page.getByRole("button", { name: "전체", exact: true }).click();
  await page.getByRole("radio", { name: /강릉/ }).click();
  await page.getByRole("searchbox", { name: "관광지 찾기" }).fill("율곡");
  await expect(cards.first()).toContainText("오죽헌");
  await cards.first().getByRole("button", { name: "자세히 보기" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "관광공사 소개" })).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "접근성" })).toBeVisible();
  await expect(dialog.locator("ul").last().locator("li")).toHaveCount(10);
  await expect(dialog.getByRole("link", { name: /\d{2,4}-\d{3,4}-\d{4}/ })).toBeVisible();
});

test("시작 화면에서도 들어갈 수 있고, 누를 수 있는 것은 44px 이상", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /어떤 관광지가 있는지 먼저 보기/ }).click();
  await expect(page).toHaveURL(/\/places$/);
  for (const el of await page.locator("main button:visible, main a:visible").all()) {
    const box = await el.boundingBox();
    if (box) expect(box.height, (await el.textContent()) ?? "").toBeGreaterThanOrEqual(44);
  }
});

test("내려가면 오른쪽 아래에 '맨 위로' 버튼이 뜨고, 누르면 맨 위로 올라간다", async ({ page }) => {
  await page.goto("/places");
  await expect(page.getByRole("button", { name: "맨 위로" })).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 2000));
  const top = page.getByRole("button", { name: "맨 위로" });
  await expect(top).toBeVisible();
  const box = (await top.boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(44);
  await top.click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(50);
});
