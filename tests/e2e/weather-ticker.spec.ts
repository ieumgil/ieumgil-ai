// 머리줄 오늘 날씨(11/25): 시작 화면 히어로에 있던 '오늘 영동 날씨'를 모든 화면 머리줄(메뉴 줄) 안 작은 칸으로 옮겼다(히어로 배경이 너무 커져서).
// 따로 띠를 한 줄 더 만들지 않는다(사용자 결정). 레퍼런스: 계룡시 문화관광(메뉴 쪽 오늘 날씨) + 함안군청(인기검색어가 몇 초마다 위로 굴러감).
// 강릉 → 속초 → 동해를 3초마다 바꿔 보여 주고, 칸 자체가 멈추기 버튼이다(WCAG 2.2.2). 동작 줄이기면 굴리지 않는다.
// 값은 /api/weather(기상청)를 열 때 받아 메모리에서만 쓰고 저장하지 않는다(원칙 3). 문구는 코드가 정한 고정 문구와 숫자뿐.
import { expect, test, type Page } from "@playwright/test";

const TODAY = "2026-11-25";
const PAYLOAD = {
  available: true,
  today: TODAY,
  asOf: {},
  regions: {
    강릉: { [TODAY]: { sky: 1, precip: null, pop: 10, tmin: 2, tmax: 9, source: "short" } },
    속초: { [TODAY]: { sky: 3, precip: null, pop: 20, tmin: 1, tmax: 7, source: "short" } },
    동해: { [TODAY]: { sky: 4, precip: "비", pop: 60, tmin: 4, tmax: 10, source: "short" } },
  },
};

const ticker = (page: Page) => page.getByRole("banner").getByRole("group", { name: "오늘 영동 날씨" });
const shown = (page: Page) => ticker(page).locator("[data-weather-current]");

async function open(page: Page, path = "/places", payload: unknown = PAYLOAD) {
  await page.addInitScript(() => sessionStorage.setItem("ieumgil-intro-seen", "1"));
  await page.route("https://tong.visitkorea.or.kr/**", (r) => r.abort());
  await page.route("**/api/weather", (r) => r.fulfill({ json: payload }));
  await page.clock.install();
  await page.goto(path);
}

test("머리줄 안에 오늘 날씨가 있고(띠를 따로 만들지 않음), 강릉 → 속초 → 동해를 3초마다 바꿔 보여 준다", async ({ page }) => {
  await open(page);
  await expect(shown(page)).toContainText("강릉");
  await expect(shown(page)).toContainText("2~9℃");
  await page.clock.runFor(3100);
  await expect(shown(page)).toContainText("속초");
  await page.clock.runFor(3100);
  await expect(shown(page)).toContainText("동해");
  await page.clock.runFor(3100);
  await expect(shown(page)).toContainText("강릉");
  // 머리줄 위에 다른 띠가 없다: 머리줄이 화면 맨 위
  expect((await page.getByRole("banner").boundingBox())!.y).toBeLessThanOrEqual(1);
  // 화면 읽기 프로그램에는 세 도시를 한 번에 + 출처
  const sr = ticker(page).locator(".sr-only");
  for (const t of ["강릉", "속초", "동해 흐림 · 비 60%", "기상청"]) await expect(sr).toContainText(t);
});

test("칸을 누르면 멈추고, 다시 누르면 이어서 바뀐다 · 누르는 자리는 44px 이상 · 글자 16px · 화면에 '기상청' 글자는 없다", async ({ page }) => {
  await open(page);
  await expect(shown(page)).toContainText("강릉");
  const stop = ticker(page).getByRole("button", { name: "날씨 넘김 멈추기" });
  expect((await stop.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await expect(shown(page)).toHaveCSS("font-size", "16px");
  await expect(stop).not.toContainText("기상청"); // 출처는 화면 읽기 글자에만(sr-only는 버튼 밖)
  await stop.click();
  await page.clock.runFor(9000);
  await expect(shown(page)).toContainText("강릉");
  await ticker(page).getByRole("button", { name: "날씨 넘김 다시 시작" }).click();
  await page.clock.runFor(3100);
  await expect(shown(page)).toContainText("속초");
});

test("시작 화면 히어로에는 날씨가 없다(머리줄로 옮김)", async ({ page }) => {
  await open(page, "/");
  await expect(shown(page)).toContainText("강릉");
  await expect(page.locator("section[aria-labelledby='hero-title']")).not.toContainText("℃");
});

test("동작 줄이기 설정이면 굴리지 않는다(강릉만, 멈추기 버튼 없음)", async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await open(page);
  await expect(shown(page)).toContainText("강릉");
  await expect(ticker(page).getByRole("button")).toHaveCount(0);
  await page.clock.runFor(9000);
  await expect(shown(page)).toContainText("강릉");
  await ctx.close();
});

test("날씨를 받지 못하면 칸을 그리지 않는다", async ({ page }) => {
  await open(page, "/places", { available: false });
  await expect(page.getByRole("banner").getByRole("link", { name: "이음길 처음 화면" })).toBeVisible();
  await expect(ticker(page)).toHaveCount(0);
});

test("휴대폰(390px)에서도 머리줄 한 줄 안에 로고 · 날씨 · ☰이 들어가고, 320px에서도 가로로 넘치지 않는다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await expect(shown(page)).toContainText("강릉");
  const [logo, wx] = [(await page.getByRole("link", { name: "이음길 처음 화면" }).boundingBox())!, (await ticker(page).boundingBox())!];
  expect(Math.abs(logo.y + logo.height / 2 - (wx.y + wx.height / 2))).toBeLessThan(8); // 같은 줄
  await page.setViewportSize({ width: 320, height: 640 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
});
