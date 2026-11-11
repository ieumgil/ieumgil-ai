// 결과 화면: 저장해 둔 실제 AI 결과(e2e/fixtures/trip-view.json)로 확인한다(LLM 호출 없음).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

const trip = readFileSync(resolve(__dirname, "fixtures/trip-view.json"), "utf8");
const view = JSON.parse(trip) as { options: { id: string; title: string }[] };

test.beforeEach(async ({ page }) => {
  // 안 비교 화면에도 지도가 있다: 카카오 지도 SDK·경로선은 가짜로 막는다(외부 호출 없음)
  await page.route("https://dapi.kakao.com/**", (r) => r.abort());
  await page.route("**/api/route-line", (r) => r.fulfill({ json: { days: [null] } }));
  await page.addInitScript((t) => sessionStorage.setItem("ieumgil-trip", t), trip);
  await page.goto("/trip/new");
});

test("안을 바꾸면 그 안의 일정이 보인다", async ({ page }) => {
  await expect(page.getByRole("heading", { level: 1 })).toContainText(`일정 ${view.options.length}가지`);
  const second = view.options[1];
  await page.getByRole("radio").nth(1).click();
  await expect(page.getByRole("radio").nth(1)).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("heading", { level: 2, name: second.title })).toBeVisible();
});

test("장소 카드는 핵심만 보이고, [자세히]를 누르면 판단 이유·확인할 것이 펼쳐진다", async ({ page }) => {
  const more = page.getByRole("button", { name: /자세히/ }).first();
  await expect(more).toHaveAttribute("aria-expanded", "false");
  await more.click();
  await expect(more).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText(/근거: 한국관광공사 무장애 여행정보/).first()).toBeVisible();
});

test("'이 일정으로 정하기'를 누르면 확인할 것 모음이 열리고, 정한 상태가 남는다", async ({ page }) => {
  await page.getByRole("button", { name: /일정으로 정하기/ }).last().click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toContainText("정했어요");
  await expect(sheet).toContainText(/출발 전 전화로 확인할 곳 \d+곳/);
  await expect(sheet.getByRole("link", { name: "확정 일정 보기" })).toHaveAttribute("href", "/trip/new/final");
  await sheet.getByRole("button", { name: "닫기" }).last().click();
  await expect(page.getByRole("link", { name: /정한 일정/ }).last()).toBeVisible();
  await page.reload();
  await expect(page.getByRole("link", { name: /정한 일정/ }).last()).toHaveAttribute("href", "/trip/new/final");
});

test("[바꾸기]로 근처 후보로 바꾸면 시각을 다시 계산해 보여주고, 원래대로 되돌릴 수 있다", async ({ page }) => {
  await expect(page.getByRole("link", { name: "조건 바꿔 다시 만들기" })).toHaveCount(0);
  const swap = page.getByRole("button", { name: /다른 곳으로 바꾸기/ }).first();
  const fromName = ((await swap.getAttribute("aria-label")) ?? "").replace(/ 다른 곳으로 바꾸기$/, "");
  await swap.click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toContainText(`${fromName} 대신 갈 곳`);
  const toName = (await sheet.locator("li p.text-lg").first().textContent())!.trim();
  await sheet.getByRole("button", { name: "이곳으로 바꾸기" }).first().click();
  await expect(sheet).toBeHidden();

  const card = page.getByRole("heading", { level: 3, name: new RegExp(toName.replace(/[()]/g, "\\$&")) }).first();
  await expect(card).toBeVisible();
  await expect(page.getByText(`바꾼 장소 · 원래 ${fromName}`).first()).toBeVisible();

  await page.reload(); // 바꾼 일정은 이 탭에 남는다
  await expect(page.getByText(`바꾼 장소 · 원래 ${fromName}`).first()).toBeVisible();

  await page.getByRole("button", { name: `${toName} 다른 곳으로 바꾸기` }).first().click();
  await page.getByRole("dialog").getByRole("button", { name: "원래 장소로 되돌리기" }).click();
  await expect(page.getByText(/바꾼 장소 · 원래/)).toHaveCount(0);
});

test("결과 화면도 누를 수 있는 요소는 높이 44px 이상", async ({ page }) => {
  await page.waitForLoadState("networkidle");
  const small = await page.locator("main a, main button, main summary").evaluateAll((els) =>
    els
      .filter((el) => (el as HTMLElement).offsetParent !== null)
      .map((el) => ({ text: (el.textContent ?? "").trim().slice(0, 20), h: el.getBoundingClientRect().height }))
      .filter((r) => r.h < 43.5), // 소수점 반올림 오차 허용
  );
  expect(small, JSON.stringify(small)).toEqual([]);
});

test("적합이어도 전화로 물어볼 것이 있으면 칩에 함께 적고, 안을 바꾸면 그 안이라고 알려준다", async ({ page }) => {
  await expect(page.getByText(/적합 · 전화로 확인할 것 있음/).first()).toBeVisible();
  const other = page.getByRole("radio").nth(0);
  const id = (await other.textContent())!.trim().charAt(0);
  if ((await other.getAttribute("aria-checked")) !== "true") {
    await other.click();
    await expect(page.getByRole("status").first()).toContainText(`${id}안 일정을 보여 드려요`);
  }
  await expect(page.getByRole("button", { name: `${id}안 일정으로 정하기` }).last()).toBeVisible();
});

test("버튼 모양 링크도 키보드 포커스 테두리가 보인다", async ({ page }) => {
  await page.getByRole("button", { name: /일정으로 정하기/ }).last().click();
  const link = page.getByRole("dialog").getByRole("link", { name: "확정 일정 보기" });
  await link.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  const style = await link.evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(style).not.toBe("none");
});
