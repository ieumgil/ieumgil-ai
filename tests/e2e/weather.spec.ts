// 확정 일정 화면의 날씨 줄. 기상청 호출은 /api/weather를 가짜로 막아 두고 화면만 확인한다(외부 호출 없음).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page, type Route } from "@playwright/test";

const trip = readFileSync(resolve(__dirname, "fixtures/trip-view.json"), "utf8");
const weather = JSON.parse(readFileSync(resolve(__dirname, "fixtures/weather.json"), "utf8")) as unknown;
const view = JSON.parse(trip) as { createdAt: string; options: { id: string; title: string }[] };


async function setup(page: Page, onWeather: (r: Route) => Promise<void> | void) {
  await page.route("https://dapi.kakao.com/**", (r) => r.abort());
  await page.route("https://tong.visitkorea.or.kr/**", (r) => r.abort());
  await page.route("**/api/route-line", (r) => r.fulfill({ json: { days: [null] } }));
  await page.route("**/api/legs", (r) => r.fulfill({ json: { days: [] } }));
  await page.route("**/api/weather", onWeather);
  await page.addInitScript(
    ([t, c]) => {
      sessionStorage.setItem("ieumgil-trip", t);
      sessionStorage.setItem("ieumgil-trip-confirmed", c);
    },
    [trip, `${view.createdAt}|${view.options[0].id}`],
  );
}

test("기상청 예보가 있으면 확정 화면 첫날에 시마다 한 줄로 보인다", async ({ page }) => {
  await setup(page, (r) => r.fulfill({ json: weather }));
  await page.goto("/trip/new/final");
  await expect(page.getByText("강릉 · 흐림 · 비 70% · 8~14℃").filter({ visible: true })).toBeVisible();
  // 이날 속초는 안 가므로 속초 줄은 없다
  await expect(page.getByText(/^속초 ·/)).toHaveCount(0);
});

test("날씨는 탭 저장소에 남지 않는다(원칙 3)", async ({ page }) => {
  await setup(page, (r) => r.fulfill({ json: weather }));
  await page.goto("/trip/new/final");
  await expect(page.getByText("강릉 · 흐림 · 비 70% · 8~14℃").filter({ visible: true })).toBeVisible();
  const stored = await page.evaluate(() => JSON.stringify({ ...sessionStorage, ...localStorage }));
  expect(stored).not.toContain("흐림");
  expect(stored).not.toContain("available");
});
