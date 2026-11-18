// 확정 일정 지도 '전체 화면'(11/18): 지도 아래 안내 칸 오른쪽 버튼 → 휴대폰·PC 모두 화면 전체를 지도로 덮고, 닫기·Esc로 돌아온다.
// 실제 카카오 지도가 떠야 버튼이 생기므로(못 불러오면 안내 문구만) 카카오 키·도메인이 없는 환경(CI)에서는 건너뛴다.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

const trip = readFileSync(resolve(__dirname, "fixtures/trip-view.json"), "utf8");
const view = JSON.parse(trip) as { createdAt: string; options: { id: string }[] };

test("지도 '전체 화면'은 화면을 모두 덮고, 닫기·Esc로 돌아오며 뒤 화면 스크롤을 막는다", async ({ page }) => {
  await page.route("**/api/weather", (r) => r.fulfill({ json: { available: false } }));
  await page.addInitScript(
    ([t, c]) => {
      sessionStorage.setItem("ieumgil-trip", t);
      sessionStorage.setItem("ieumgil-trip-confirmed", c);
    },
    [trip, `${view.createdAt}|${view.options[0].id}`],
  );
  await page.goto("/trip/new/final");
  const open = page.getByRole("button", { name: "전체 화면" });
  const failed = page.getByRole("note").filter({ hasText: "지도를 불러오지 못했어요" });
  await expect(open.or(failed)).toBeVisible({ timeout: 20_000 });
  test.skip(await failed.isVisible(), "카카오 지도를 불러올 수 없는 환경");

  // 버튼은 '차량 약 …' 안내 칸 오른쪽
  const caption = page.locator("#final-map figcaption");
  await expect(caption.getByRole("button", { name: "전체 화면" })).toBeVisible();

  await open.click();
  const dialog = page.getByRole("dialog", { name: "지도 전체 화면" });
  await expect(dialog).toBeVisible();
  const vp = page.viewportSize()!;
  const box = (await dialog.boundingBox())!;
  expect(Math.round(box.width)).toBe(vp.width);
  expect(Math.round(box.height)).toBe(vp.height);
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("hidden");
  // 전체 화면 위에 다른 것(일정 카드 등)이 올라오지 않는다
  const top = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest("#final-map") !== null, [vp.width - 40, vp.height / 2]);
  expect(top).toBe(true);

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await open.click();
  await page.getByRole("button", { name: "닫기" }).click();
  await expect(page.getByRole("dialog", { name: "지도 전체 화면" })).toHaveCount(0);
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("");
});
