// 예시 루트(/trip/example): 미리 만든 실제 AI 결과가 AI 호출 없이 바로 열리고, 바꾸기·확정·지도까지 된다.
// 예시에서 확정하거나 장소를 바꿔도 사용자가 만든 일정 기록은 그대로다(보관 칸이 따로).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";

const own = readFileSync(resolve(__dirname, "fixtures/trip-view.json"), "utf8");
const ownView = JSON.parse(own) as { createdAt: string; options: { id: string; title: string }[] };

async function setup(page: Page) {
  await page.route("https://dapi.kakao.com/**", (r) => r.abort());
  await page.route("**/api/route-line", (r) => r.fulfill({ json: { days: [null] } }));
  await page.route("**/api/legs", (r) => r.fulfill({ json: { days: [] } })); // 실제 이동시간 없음 → 추정 그대로
  await page.route("https://tong.visitkorea.or.kr/**", (r) => r.abort());
  let planCalled = false;
  await page.route("**/api/plan", (r) => {
    planCalled = true;
    return r.abort();
  });
  await page.addInitScript(() => sessionStorage.setItem("ieumgil-intro-seen", "1"));
  return () => planCalled;
}

test("시작 화면의 '예시 루트 바로 보기'를 누르면 AI를 부르지 않고 예시 일정이 바로 열린다", async ({ page }) => {
  const planCalled = await setup(page);
  await page.goto("/");
  await page.getByRole("link", { name: "예시 루트 바로 보기" }).click();
  await expect(page).toHaveURL(/\/trip\/example$/);
  await expect(page.getByText("예시 일정이에요.")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/일정 \d가지를 만들었어요/);
  await expect(page.getByRole("radio").first()).toBeVisible();
  await expect(page.locator("article").first()).toBeVisible();
  expect(planCalled()).toBe(false);
});

test("예시에서 정하면 예시 확정 화면으로 가고, 내가 만든 일정의 확정 기록은 그대로다", async ({ page }) => {
  await setup(page);
  const mine = ownView.options[0];
  await page.addInitScript(
    ([t, c]) => {
      sessionStorage.setItem("ieumgil-trip", t);
      sessionStorage.setItem("ieumgil-trip-confirmed", c);
    },
    [own, `${ownView.createdAt}|${mine.id}`],
  );
  await page.goto("/trip/example");
  await page.getByRole("button", { name: /일정으로 정하기/ }).last().click();
  await page.getByRole("dialog").getByRole("link", { name: "확정 일정 보기" }).click();
  await expect(page).toHaveURL(/\/trip\/example\/final$/);
  await expect(page.getByText("확정한 일정")).toBeVisible();
  await page.getByRole("link", { name: "다른 안 보기" }).click();
  await expect(page).toHaveURL(/\/trip\/example$/);

  // 내 일정은 원래 확정한 안 그대로
  await page.goto("/trip/new/final");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(mine.title);
});

test("예시에서도 장소를 바꿀 수 있다", async ({ page }) => {
  await setup(page);
  await page.goto("/trip/example");
  const first = page.locator("article").first().getByRole("heading", { level: 3 });
  const before = await first.textContent();
  await page.locator("article").first().getByRole("button", { name: /다른 곳으로 바꾸기/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "이곳으로 바꾸기" }).first().click();
  await expect(page.locator("article").first().getByText(/바꾼 장소 · 원래/)).toBeVisible();
  await expect(first).not.toHaveText(before ?? "");
});
