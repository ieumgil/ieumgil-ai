// 입력 4단계 흐름을 실제 브라우저로 검사한다.
// 날짜는 고정 시계(2026-11-14 토)로 두고, 예시 날짜 11/21(토)을 고른다.
import { expect, test, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-14T10:00:00+09:00"));
});

async function pickDay(page: Page, day: number) {
  await page.getByRole("button", { name: new RegExp(`^2026년 11월 ${day}일`) }).click();
}

test("시작 화면에서 1단계로 들어간다", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("함께 가는 영동 여행");
  await page.getByRole("link", { name: "여행 루트 만들기" }).click();
  await expect(page).toHaveURL(/\/plan\/when$/);
  await expect(page.getByRole("heading", { name: "언제 여행하나요?" })).toBeVisible();
});

test("1단계: 다 채우기 전에는 다음으로 갈 수 없고, 빠진 항목을 버튼에 보여준다", async ({ page }) => {
  await page.goto("/plan/when");
  await expect(page.getByRole("button", { name: "날짜를 골라 주세요" })).toBeDisabled();

  await pickDay(page, 21);
  await expect(page.getByText("당일", { exact: false }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "도착 지점을 골라 주세요" })).toBeDisabled();

  await page.getByRole("radio", { name: "강릉역" }).click();
  await expect(page.getByRole("button", { name: "이동수단을 골라 주세요" })).toBeDisabled();

  await page.getByRole("radio", { name: "택시" }).click();
  await expect(page.getByRole("link", { name: "다음 · 누구와 가나요" })).toBeVisible();
});

test("1박 이상이면 숙소 지역을 골라야 한다", async ({ page }) => {
  await page.goto("/plan/when");
  await pickDay(page, 21);
  await pickDay(page, 22);
  await page.getByRole("radio", { name: "강릉역" }).click();
  await page.getByRole("radio", { name: "택시" }).click();
  await expect(page.getByRole("button", { name: "숙소 지역을 골라 주세요" })).toBeDisabled();

  await page.getByRole("radio", { name: "속초", exact: true }).click();
  await expect(page.getByRole("link", { name: "다음 · 누구와 가나요" })).toBeVisible();
});

test("휠체어 · 자가용 + 표지 차량: 장애인 전용 주차가 필수 조건으로 켜지고 4단계까지 간다", async ({ page }) => {
  await page.goto("/plan/when");
  await pickDay(page, 21);
  await page.getByRole("radio", { name: "강릉역" }).click();
  await page.getByRole("radio", { name: "자가용·렌터카" }).click();
  await page.getByLabel("장애인 사용 자동차 표지가 있어요").check();
  await page.getByRole("link", { name: "다음 · 누구와 가나요" }).click();

  await expect(page).toHaveURL(/\/plan\/who$/);
  await expect(page.getByRole("button", { name: "유형을 골라 주세요" })).toBeDisabled();
  await page.getByRole("button", { name: /휠체어 이용/ }).click();
  await page.getByRole("link", { name: "다음 · 꼭 필요한 조건" }).click();

  await expect(page).toHaveURL(/\/plan\/conditions$/);
  const parking = page.getByLabel(/장애인 전용 주차구역/);
  await expect(parking).toBeChecked();
  await expect(page.getByLabel(/장애인 화장실/)).toBeChecked();
  await page.getByRole("link", { name: "다음 · 좋아하는 곳" }).click();

  await expect(page).toHaveURL(/\/plan\/taste$/);
  await expect(page.getByRole("button", { name: "좋아하는 곳을 골라 주세요" })).toBeDisabled();
  await page.getByRole("button", { name: /바다·해변/ }).click();
  await expect(page.getByRole("link", { name: "루트 만들기" })).toHaveAttribute("href", "/trip/new");
});

test("휠체어 · 택시: 장애인 전용 주차 조건이 나오지 않는다", async ({ page }) => {
  await page.goto("/plan/when");
  await pickDay(page, 21);
  await page.getByRole("radio", { name: "강릉역" }).click();
  await page.getByRole("radio", { name: "택시" }).click();
  await page.getByRole("link", { name: "다음 · 누구와 가나요" }).click();
  await page.getByRole("button", { name: /휠체어 이용/ }).click();
  await page.getByRole("link", { name: "다음 · 꼭 필요한 조건" }).click();

  await expect(page.getByLabel(/장애인 화장실/)).toBeChecked();
  await expect(page.getByLabel(/장애인 전용 주차구역/)).toHaveCount(0);
});

test("어르신을 고르면 걸을 수 있는 거리를 묻는다", async ({ page }) => {
  await page.goto("/plan/when");
  await pickDay(page, 21);
  await page.getByRole("radio", { name: "강릉역" }).click();
  await page.getByRole("radio", { name: "택시" }).click();
  await page.getByRole("link", { name: "다음 · 누구와 가나요" }).click();
  await page.getByRole("button", { name: /보행이 불편한 어르신/ }).click();
  await page.getByRole("link", { name: "다음 · 꼭 필요한 조건" }).click();

  await expect(page.getByRole("radiogroup", { name: /한 번에 걸을 수 있는 거리/ })).toBeVisible();
});

test("1단계를 건너뛰고 2단계로 바로 들어오면 앞 단계를 먼저 채우라고 안내한다", async ({ page }) => {
  await page.goto("/plan/who");
  await page.getByRole("button", { name: /휠체어 이용/ }).click();
  await expect(page.getByRole("link", { name: "다음 · 꼭 필요한 조건" })).toHaveCount(0);
});
