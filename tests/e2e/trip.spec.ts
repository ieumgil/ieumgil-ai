// 만드는 중·결과 화면(LLM 호출 없이 확인할 수 있는 부분).
import { expect, test } from "@playwright/test";

test("앞 단계를 안 채우고 '만드는 중'에 들어오면 채우러 가라고 안내하고, 서버를 부르지 않는다", async ({ page }) => {
  let called = false;
  await page.route("**/api/plan", (route) => {
    called = true;
    return route.abort();
  });
  await page.goto("/plan/making");
  await expect(page.getByRole("link", { name: "채우러 가기" })).toBeVisible();
  expect(called).toBe(false);
});

test("만든 일정이 없으면 결과 화면에서 다시 만들라고 안내한다", async ({ page }) => {
  await page.goto("/trip/new");
  await expect(page.getByRole("heading", { level: 1, name: "만든 일정이 없어요" })).toBeVisible();
  await expect(page.getByRole("link", { name: "일정 만들기" })).toHaveAttribute("href", "/plan/when");
});

test("서버가 오류를 보내면 '다시 만들기'를 보여준다", async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem(
      "ieumgil-plan",
      JSON.stringify({ startDate: "2026-11-21", endDate: "2026-11-21", arrival: "gangneung-station", transport: "taxi", travelers: ["wheelchair"], categories: ["바다·해변"] }),
    );
  });
  await page.route("**/api/plan", (route) => route.fulfill({ status: 200, contentType: "application/x-ndjson", body: '{"stage":"rule"}\n{"stage":"error","message":"일정을 만들지 못했어요. 잠시 뒤 다시 시도해 주세요."}\n' }));
  await page.goto("/plan/making");
  await expect(page.getByRole("main").getByRole("alert")).toContainText("일정을 만들지 못했어요");
  await expect(page.getByRole("button", { name: "다시 만들기" })).toBeVisible();
});
