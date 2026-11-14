// 확정 일정 화면의 날씨 줄. 기상청 호출은 /api/weather를 가짜로 막아 두고 화면만 확인한다(외부 호출 없음).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page, type Route } from "@playwright/test";

const trip = readFileSync(resolve(__dirname, "fixtures/trip-view.json"), "utf8");
const weather = JSON.parse(readFileSync(resolve(__dirname, "fixtures/weather.json"), "utf8")) as unknown;
const view = JSON.parse(trip) as { createdAt: string; options: { id: string; title: string }[] };

const RAIN = "비 예보 — 데크·경사로가 미끄러울 수 있어요";
const SOURCE = "날씨: 기상청 단기·중기예보(11월 18일 17시 발표). 예보는 바뀔 수 있어요.";
const ROW = "강릉 · 흐림 · 비 70% · 8~14℃";
const withToday = (today: string) => ({ ...(weather as object), today });

// trip 복사본을 고쳐 JSON 문자열로 돌려준다(픽스처 파일은 하나로 유지)
type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
function editTrip(fn: (t: Json) => void): string {
  const t = JSON.parse(trip) as Json;
  fn(t);
  return JSON.stringify(t);
}

async function setup(page: Page, onWeather: (r: Route) => Promise<void> | void, tripJson: string = trip) {
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
    [tripJson, `${view.createdAt}|${view.options[0].id}`],
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
  expect(stored).not.toContain("기상청");
  expect(stored).not.toContain('"pop"');
});

// D-05: 기상청이 어떤 모양으로 실패해도 일정·지도 안내는 그대로이고 날씨 줄만 빠진다
const failures: [string, (r: Route) => Promise<void> | void][] = [
  ["서버 오류(500)", (r) => r.fulfill({ status: 500, json: { message: "오류" } })],
  ["연결 끊김", (r) => r.abort()],
  ["예보 없음({ available: false })", (r) => r.fulfill({ json: { available: false } })],
];

for (const [name, handler] of failures) {
  test(`날씨를 못 받아도(${name}) 일정은 그대로 열리고 날씨 줄만 없다`, async ({ page }) => {
    await setup(page, handler);
    await page.goto("/trip/new/final");
    await expect(page.getByRole("heading", { level: 2, name: /번째 장소/ }).first()).toBeVisible();
    await expect(page.getByText("지도의 선은 일반 차량 경로예요")).toBeVisible();
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(/^강릉 · /)).toHaveCount(0);
    await expect(page.getByText("날씨: 기상청")).toHaveCount(0);
    await expect(page.getByRole("list", { name: "이날 날씨" })).toHaveCount(0);
  });
}

test("날씨 줄 글자는 16px 이상이고 가로 스크롤이 없다", async ({ page }) => {
  await setup(page, (r) => r.fulfill({ json: weather }));
  await page.goto("/trip/new/final");
  const line = page.getByText(ROW).filter({ visible: true });
  await expect(line).toBeVisible();
  const size = await line.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  expect(size).toBeGreaterThanOrEqual(16);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
});

test("비 예보는 바깥 장소(경포해수욕장) 카드에만 '!'와 함께 붙고 실내 장소에는 없다", async ({ page }) => {
  await setup(page, (r) => r.fulfill({ json: weather }));
  await page.goto("/trip/new/final");
  await expect(page.getByText(ROW).filter({ visible: true })).toBeVisible();
  const caution = page.locator("#stop-GN33 p", { hasText: RAIN });
  await expect(caution).toBeVisible();
  await expect(caution.locator('span[aria-hidden="true"]')).toHaveText("!");
  await expect(page.locator("#stop-GN12").getByText("비 예보")).toHaveCount(0);
  await expect(page.locator("#stop-GN05").getByText("비 예보")).toHaveCount(0);
  await expect(page.getByText(RAIN).filter({ visible: true })).toHaveCount(1);
});

test("날씨가 보이면 화면 아래에 출처 한 줄이 붙는다", async ({ page }) => {
  await setup(page, (r) => r.fulfill({ json: weather }));
  await page.goto("/trip/new/final");
  await expect(page.getByText(SOURCE)).toBeVisible();
});

test("2일째에는 값이 없어 '예보 없음'으로 알리고 주의는 없다", async ({ page }) => {
  await setup(page, (r) => r.fulfill({ json: weather }));
  await page.goto("/trip/new/final");
  await expect(page.getByText(ROW).filter({ visible: true })).toBeVisible();
  await page.getByRole("tab", { name: /2일째/ }).click();
  await expect(page.getByText("강릉 · 예보 없음").filter({ visible: true })).toBeVisible();
  await expect(page.getByText(RAIN).filter({ visible: true })).toHaveCount(0);
});

test("출발까지 10일보다 많이 남으면 '아직 예보 없음' 안내만 있고 출처 줄은 없다", async ({ page }) => {
  await setup(page, (r) => r.fulfill({ json: withToday("2026-11-05") }));
  await page.goto("/trip/new/final");
  await expect(page.getByText("아직 예보 없음 · 출발 약 10일 전부터 나와요").filter({ visible: true })).toBeVisible();
  await expect(page.getByText("날씨: 기상청")).toHaveCount(0);
  await expect(page.getByText(RAIN)).toHaveCount(0);
});

test("지난 날짜면 '지난 일정이라 예보를 보여 주지 않아요' 안내만 있고 출처 줄은 없다", async ({ page }) => {
  await setup(page, (r) => r.fulfill({ json: withToday("2026-11-25") }));
  await page.goto("/trip/new/final");
  await expect(page.getByText("지난 일정이라 예보를 보여 주지 않아요").filter({ visible: true })).toBeVisible();
  await expect(page.getByText("날씨: 기상청")).toHaveCount(0);
  await expect(page.getByText(RAIN)).toHaveCount(0);
});

test("그날 가는 시가 둘이면 두 줄(첫 방문 순서)이고, 속초 쪽 장소에는 비 주의가 없다", async ({ page }) => {
  const mixed = editTrip((t) => {
    t.places.GN33.region = "속초";
  });
  await setup(page, (r) => r.fulfill({ json: weather }), mixed);
  await page.goto("/trip/new/final");
  const list = page.getByRole("list", { name: "이날 날씨" }).filter({ visible: true });
  const rows = list.getByRole("listitem");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText(ROW);
  await expect(rows.nth(1)).toContainText("속초 · 맑음 · 비 10% · 5~12℃");
  await expect(page.getByText(RAIN).filter({ visible: true })).toHaveCount(0);
});

test("1일 일정에도 날씨 줄이 보인다(날짜 탭 없음)", async ({ page }) => {
  const oneDay = editTrip((t) => {
    t.input.endDate = t.input.startDate;
    t.frames = t.frames.slice(0, 1);
    for (const o of t.options) {
      o.days = o.days.slice(0, 1);
      o.draft.days = o.draft.days.slice(0, 1);
    }
  });
  await setup(page, (r) => r.fulfill({ json: weather }), oneDay);
  await page.goto("/trip/new/final");
  await expect(page.getByText(ROW).filter({ visible: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: /일째/ })).toHaveCount(0);
});

// D-07: 안 비교·상세 화면은 날씨를 부르지 않는다(확정·공유 화면에서만)
test("안 비교 화면(/trip/new)은 날씨를 부르지 않는다", async ({ page }) => {
  const urls: string[] = [];
  page.on("request", (req) => urls.push(req.url()));
  await setup(page, (r) => r.fulfill({ json: weather }));
  await page.goto("/trip/new");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.waitForLoadState("networkidle");
  expect(urls.filter((u) => u.includes("/api/weather"))).toEqual([]);
});
