// 확정 일정 페이지: 정한 안 하나 + 지도만. 카카오 지도 SDK와 경로선은 가짜로 막아 두고(외부 호출 없음) 화면만 확인한다.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";

const trip = readFileSync(resolve(__dirname, "fixtures/trip-view.json"), "utf8");
const view = JSON.parse(trip) as { createdAt: string; options: { id: string; title: string }[] };

async function setup(page: Page, confirmed?: string) {
  await page.route("https://dapi.kakao.com/**", (r) => r.abort());
  await page.route("https://tong.visitkorea.or.kr/**", (r) => r.abort()); // 관광공사 원본 사진(외부 호출 없음)
  await page.route("**/api/route-line", (r) => r.fulfill({ json: { days: [null] } }));
  await page.route("**/api/legs", (r) => r.fulfill({ json: { days: [] } })); // 실제 이동시간 없음 → 추정 그대로
  await page.addInitScript(
    ([t, c]) => {
      sessionStorage.setItem("ieumgil-trip", t);
      if (c) sessionStorage.setItem("ieumgil-trip-confirmed", c);
    },
    [trip, confirmed ? `${view.createdAt}|${confirmed}` : ""],
  );
}

test("결과 화면에서 정하면 확정 일정 페이지로 가고, 다른 안은 보이지 않는다", async ({ page }) => {
  await setup(page);
  await page.goto("/trip/new");
  const second = view.options[1];
  await page.getByRole("radio").nth(1).click();
  await page.getByRole("button", { name: /일정으로 정하기/ }).last().click();
  await page.getByRole("dialog").getByRole("link", { name: "확정 일정 보기" }).click();

  await expect(page).toHaveURL(/\/trip\/new\/final$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(second.title);
  await expect(page.getByRole("radio")).toHaveCount(0); // 안 고르기 없음
  // 지도가 막혀도 일정은 보인다(앞 화면은 숨긴 채 남아 있을 수 있어 보이는 것만 센다)
  await expect(page.getByText("지도를 불러오지 못했어요").filter({ visible: true })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: /번째 장소/ }).first()).toBeVisible();
  await expect(page.getByText("지도의 선은 일반 차량 경로예요")).toBeVisible();

  await page.getByRole("link", { name: "다른 안 보기" }).click();
  await expect(page).toHaveURL(/\/trip\/new$/);
});

test("장소를 바꾼 일정이면 확정 페이지에도 바꾼 장소가 나온다", async ({ page }) => {
  await setup(page, view.options[0].id);
  await page.goto("/trip/new");
  const swap = page.getByRole("button", { name: /다른 곳으로 바꾸기/ }).first();
  await swap.click();
  const sheet = page.getByRole("dialog");
  const toName = (await sheet.locator("li p.text-lg").first().textContent())!.trim();
  await sheet.getByRole("button", { name: "이곳으로 바꾸기" }).first().click();
  await page.goto("/trip/new/final");
  await expect(page.getByRole("heading", { level: 2, name: new RegExp(toName.replace(/[()]/g, "\$&")) })).toBeVisible();
});

test("경로선은 열 때마다 받고 브라우저에 저장하지 않는다", async ({ page }) => {
  await setup(page, view.options[0].id);
  const req = page.waitForRequest("**/api/route-line");
  await page.goto("/trip/new/final");
  const body = (await req).postDataJSON() as { days: { points: { lat: number; lng: number }[] }[] };
  expect(body.days[0].points.length).toBeGreaterThanOrEqual(3); // 출발 + 장소 + 도착
  const stored = await page.evaluate(() => JSON.stringify({ ...sessionStorage, ...localStorage }));
  expect(stored).not.toContain("route-line");
  expect(stored).not.toContain('"path"');
});

test("출발 전 확인: 확인할 곳 수가 안 비교 카드와 같고, 전화 결과(괜찮대요)는 새로고침해도 남는다", async ({ page }) => {
  const confirmed = view.options[1];
  await setup(page, confirmed.id);
  await page.goto("/trip/new");
  const card = page.getByRole("radio").nth(1);
  const calls = Number((await card.textContent())!.match(/전화 확인 (\d+)곳/)![1]);

  await page.goto("/trip/new/final");
  await expect(page.getByText(`${calls}곳 중 0곳 확인했어요`)).toBeVisible();
  await page.getByRole("button", { name: "괜찮대요" }).first().click();
  await expect(page.getByText(`${calls}곳 중 1곳 확인했어요`)).toBeVisible();
  await page.reload();
  await expect(page.getByText(`${calls}곳 중 1곳 확인했어요`)).toBeVisible();
  await expect(page.getByRole("button", { name: "괜찮대요" }).first()).toHaveAttribute("aria-pressed", "true");
});

test("모두 '괜찮대요'면 출발 준비 끝을 보여준다", async ({ page }) => {
  await setup(page, view.options[1].id);
  await page.goto("/trip/new/final");
  const oks = page.getByRole("button", { name: "괜찮대요" });
  await expect(oks.first()).toBeVisible(); // 그려진 뒤에 센다
  const n = await oks.count();
  expect(n).toBeGreaterThan(0);
  for (let i = 0; i < n; i++) {
    await oks.nth(i).click();
    await expect(oks.nth(i)).toHaveAttribute("aria-pressed", "true");
  }
  await expect(page.getByText("출발 준비 끝!")).toBeVisible();
});

test("'어렵대요'를 고르면 바꾸기를 권하고, 누르면 그 장소의 바꾸기 창이 열린다", async ({ page }) => {
  await setup(page, view.options[1].id);
  await page.goto("/trip/new/final");
  const item = page.getByRole("group", { name: /전화 결과/ }).first();
  const name = ((await item.getAttribute("aria-label")) ?? "").replace(/ 전화 결과$/, "");
  await item.getByRole("button", { name: "어렵대요" }).click();
  await expect(page.getByText(/어렵다고 한 곳 1곳/)).toBeVisible();
  await page.getByRole("link", { name: "다른 곳으로 바꾸기" }).first().click();
  await expect(page).toHaveURL(/\/trip\/new$/);
  await expect(page.getByRole("dialog")).toContainText(`${name} 대신 갈 곳`);
});

test("정한 일정이 없으면 고르러 가라고 안내한다", async ({ page }) => {
  await setup(page);
  await page.goto("/trip/new/final");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("아직 정한 일정이 없어요");
  await expect(page.getByRole("link", { name: "일정 고르러 가기" })).toHaveAttribute("href", "/trip/new");
});

test("확정 페이지도 누를 수 있는 요소는 높이 44px 이상", async ({ page }) => {
  await setup(page, view.options[0].id);
  await page.goto("/trip/new/final");
  await page.waitForLoadState("networkidle");
  const small = await page.locator("main a, main button").evaluateAll((els) =>
    els
      .filter((el) => (el as HTMLElement).offsetParent !== null)
      .map((el) => ({ text: (el.textContent ?? "").trim().slice(0, 20), h: el.getBoundingClientRect().height }))
      .filter((r) => r.h < 43.5),
  );
  expect(small, JSON.stringify(small)).toEqual([]);
});
