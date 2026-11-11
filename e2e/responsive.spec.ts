// 창 너비에 따라 배치가 바로 바뀌는지: 휴대폰(390) · 태블릿(820) · PC(1024) · 넓은 PC(1280~).
// 너비를 직접 바꿔 보는 테스트라 PC 프로젝트에서만 돈다. 카카오 지도 SDK·경로선은 가짜로 막는다(외부 호출 없음).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";

const trip = readFileSync(resolve(__dirname, "fixtures/trip-view.json"), "utf8");
const plan = JSON.stringify({ startDate: "2026-11-21", endDate: "2026-11-22", arrival: "gangneung-station", transport: "taxi", travelers: ["wheelchair"], lodging: "강릉", categories: ["바다·해변"] });

test.beforeEach(async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "너비를 직접 바꿔 보는 테스트라 PC 프로젝트에서만");
  await page.route("https://dapi.kakao.com/**", (r) => r.abort());
  await page.addInitScript(
    ([t, p]) => {
      sessionStorage.setItem("ieumgil-trip", t);
      sessionStorage.setItem("ieumgil-plan", p);
      sessionStorage.setItem("ieumgil-intro-seen", "1");
    },
    [trip, plan],
  );
});

/** 경로선 요청을 가짜로 받고, 보낸 좌표 목록을 모은다 */
async function routeRequests(page: Page) {
  const bodies: string[] = [];
  await page.route("**/api/route-line", (r) => {
    bodies.push(r.request().postData() ?? "");
    return r.fulfill({ json: { days: [null] } });
  });
  return bodies;
}

async function noSideScroll(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
}

test("시작 화면: PC에서만 결과 화면 미리보기가 옆에 나온다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const preview = page.getByRole("figure", { name: "결과 화면 미리보기" });
  await expect(preview).toBeHidden();
  await noSideScroll(page);

  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(preview).toBeVisible();
  await expect(preview.getByRole("img")).toHaveCount(2);
  const title = await page.getByRole("heading", { level: 1 }).boundingBox();
  const box = await preview.boundingBox();
  expect(box!.x).toBeGreaterThan(title!.x + title!.width / 2); // 오른쪽 칸
  await noSideScroll(page);
});

test("입력 단계: PC에서만 '고른 조건' 요약이 오른쪽에 나오고, 누르면 그 단계로 간다", async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1000 });
  await page.goto("/plan/who");
  const summary = page.getByRole("complementary", { name: "지금까지 고른 조건" });
  await expect(summary).toBeHidden();
  await noSideScroll(page);

  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(summary).toBeVisible();
  await expect(summary.getByText("강릉역 도착 · 10:00~17:00")).toBeVisible();
  await expect(summary.getByRole("listitem").filter({ has: page.getByRole("link", { name: /누구와/ }) })).toHaveAttribute("aria-current", "step");
  await noSideScroll(page);
  await summary.getByRole("link", { name: /언제, 어디서/ }).click();
  await expect(page).toHaveURL(/\/plan\/when$/);
});

test("안 비교: 넓은 PC는 지도가 오른쪽 칸, 그보다 좁으면 날짜 탭 아래로 옮겨진다", async ({ page }) => {
  await routeRequests(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/trip/new");
  const mapColumn = page.getByRole("region", { name: "고른 일정 지도" });
  await expect(mapColumn).toBeVisible();
  const detail = await page.getByRole("tablist").boundingBox();
  const map = await mapColumn.boundingBox();
  expect(map!.x).toBeGreaterThan(detail!.x + detail!.width); // 상세 오른쪽
  await noSideScroll(page);

  for (const width of [1024, 820, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(mapColumn).toHaveCount(0);
    const tabs = await page.getByRole("tablist").boundingBox();
    const note = await page.getByText("지도를 불러오지 못했어요").boundingBox();
    expect(note!.y, `${width}px`).toBeGreaterThan(tabs!.y); // 날짜 탭 아래
    await noSideScroll(page);
  }
});

test("안 비교: 날짜·안을 바꾸면 지도 경로도 그 일정으로 다시 받는다", async ({ page }) => {
  const bodies = await routeRequests(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/trip/new");
  await expect.poll(() => bodies.length).toBeGreaterThan(0);
  const first = bodies.at(-1);

  await page.getByRole("tab").nth(1).click();
  await expect.poll(() => bodies.at(-1)).not.toBe(first);
  const second = bodies.at(-1);

  await page.getByRole("radio").nth(1).click();
  await expect.poll(() => bodies.at(-1)).not.toBe(second);
  await expect(page.getByRole("tab").first()).toHaveAttribute("aria-selected", "true"); // 안을 바꾸면 첫날부터
});

test("바꾸기 창: 휴대폰은 아래에서, PC는 화면 가운데에 뜬다", async ({ page }) => {
  await routeRequests(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/trip/new");
  await page.getByRole("button", { name: /다른 곳으로 바꾸기/ }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "이곳으로 바꾸기" }).first()).toBeVisible();
  await page.waitForTimeout(400); // 올라오는 움직임
  let box = (await dialog.boundingBox())!;
  expect(Math.round(box.y + box.height)).toBeGreaterThanOrEqual(843); // 화면 아래에 붙음
  await page.keyboard.press("Escape");

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole("button", { name: /다른 곳으로 바꾸기/ }).first().click();
  await expect(dialog.getByRole("button", { name: "이곳으로 바꾸기" }).first()).toBeVisible();
  await page.waitForTimeout(400);
  box = (await dialog.boundingBox())!;
  expect(Math.abs(box.x + box.width / 2 - 640)).toBeLessThan(2); // 가로 가운데
  expect(box.y).toBeGreaterThan(0);
  expect(box.y + box.height).toBeLessThan(900);
});

test("확정 일정·만드는 중: 어느 너비에서도 가로 스크롤이 없다", async ({ page }) => {
  await routeRequests(page);
  await page.route("**/api/plan", (r) => r.fulfill({ contentType: "application/x-ndjson", body: '{"stage":"rule"}\n' }));
  const view = JSON.parse(trip) as { createdAt: string; options: { id: string }[] };
  await page.addInitScript((c) => sessionStorage.setItem("ieumgil-trip-confirmed", c), `${view.createdAt}|${view.options[0].id}`);
  for (const width of [390, 820, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ["/trip/new/final", "/plan/making"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await noSideScroll(page);
    }
  }
});
