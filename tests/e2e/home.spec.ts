// 시작 화면(/) — 11/23 어머니 시안 개편(PC 먼저, 휴대폰은 다음 단계 보수).
// 위에서 아래로: 사이트 머리줄(모든 화면) → 히어로(숑숑 문구) → 바로가기 띠(비짓강릉 CSS) → 소개(특징 + 주 버튼 + 미리보기)
//   → 물결 → 루트 카드 3장(예당 캠핑장 CSS, 누르면 그 루트 하나만) → 대표 관광지 → 바닥글.
// 예전 시험의 뜻은 그대로 지킨다: 주 버튼이 있고, 서비스 원칙 문구('일반 차량 경로 기준')가 보이고, 특징 문장이 남아 있고,
// 미리보기는 누르는 곳이 없고 가로 스크롤을 만들지 않는다. '첫 화면 안에 주 버튼'(03-16)은 히어로가 맨 위로 오면서
// 바로가기 띠의 '여행 루트 만들기'가 그 역할을 맡는다(PC 첫 화면 안).
import { expect, test } from "@playwright/test";

const FEATURES = [
  ["조건에 안 맞는 곳은 빼요", "계단·화장실·걷는 거리를 유형별로 확인해요"],
  ["판단 근거를 함께 보여 줘요", "관광공사 원문의 어느 항목인지 알려 드려요"],
  ["모르는 건 물어볼 것을 알려 줘요", "출발 전에 전화로 물어볼 질문과 번호를 붙여요"],
];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("ieumgil-intro-seen", "1"));
  await page.route("**/api/weather", (r) => r.fulfill({ json: { available: false } }));
});

test("히어로 제목은 숑숑 글꼴의 '지도로 찾아가는 즐거운 영동 여행길'이다", async ({ page }) => {
  await page.goto("/");
  const h1 = page.getByRole("heading", { level: 1 });
  await expect(h1).toHaveText("지도로 찾아가는 즐거운 영동 여행길");
  const family = await h1.evaluate((el) => getComputedStyle(el).fontFamily.toLowerCase());
  expect(family.startsWith("syongsyong") || family.includes("syongsyong")).toBe(true);
});

test("사이트 머리줄: 로고는 처음 화면으로, 메뉴는 서비스 소개 · 관광지 둘러보기", async ({ page }, info) => {
  await page.goto("/places");
  await expect(page.getByRole("link", { name: "이음길 처음 화면" })).toHaveAttribute("href", "/");
  if (info.project.name === "desktop") {
    const nav = page.getByRole("navigation", { name: "주 메뉴" }).first();
    await expect(nav.getByRole("link", { name: "서비스 소개" })).toHaveAttribute("href", "/about");
    await expect(nav.getByRole("link", { name: "관광지 둘러보기" })).toHaveAttribute("href", "/places");
  } else {
    await page.locator("summary", { hasText: "메뉴 열기" }).click();
    await expect(page.getByRole("link", { name: "관광지 둘러보기" }).last()).toBeVisible();
  }
});

test("바로가기 띠 다섯 칸은 각 화면으로 간다", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "주요 바로가기" });
  const expected: [string, string][] = [
    ["여행 루트 만들기", "/plan"],
    ["예시 루트 보기", "/trip/example"],
    ["관광지 둘러보기", "/places"],
    ["서비스 소개", "/about"],
    ["만든 방법", "/about/how"],
  ];
  for (const [name, href] of expected) await expect(nav.getByRole("link", { name })).toHaveAttribute("href", href);
});

test("PC 첫 화면 안에 '여행 루트 만들기'가 보인다", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "PC 첫 화면");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const box = await page.getByRole("navigation", { name: "주요 바로가기" }).getByRole("link", { name: "여행 루트 만들기" }).boundingBox();
  expect(box!.y + box!.height).toBeLessThanOrEqual(900);
});

test("특징은 카드 없는 목록이고 문장이 남아 있으며, 주 버튼과 원칙 문구가 보인다", async ({ page }) => {
  await page.goto("/");
  const list = page.getByRole("list", { name: "이음길 특징" });
  await expect(list.getByRole("listitem")).toHaveCount(3);
  for (const item of await list.getByRole("listitem").all()) await expect(item).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  for (const [title, body] of FEATURES) {
    await expect(list.getByText(title, { exact: true })).toBeVisible();
    await expect(list.getByText(body, { exact: true })).toBeVisible();
  }
  await expect(page.getByRole("main").getByRole("link", { name: "여행 루트 만들기" }).last()).toHaveAttribute("href", "/plan");
  await expect(page.getByText("회원가입 없이 쓸 수 있어요 · 일반 차량 경로 기준")).toBeVisible();
});

test("미리보기는 누르거나 초점이 가는 곳이 없고 가로 스크롤을 만들지 않는다", async ({ page }) => {
  for (const width of [320, 390, 820, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const preview = page.getByRole("figure", { name: "결과 화면 미리보기" });
    await expect(preview).toBeVisible();
    await expect(preview.locator("a, button, input, [tabindex]")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), `${width}px`).toBeLessThanOrEqual(0);
  }
});

test("PC는 소개 왼쪽 + 미리보기 오른쪽", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "PC 배치");
  await page.goto("/");
  const title = await page.getByRole("heading", { name: /갈 수 있는 곳만/ }).boundingBox();
  const fig = await page.getByRole("figure", { name: "결과 화면 미리보기" }).boundingBox();
  expect(fig!.x).toBeGreaterThan(title!.x + title!.width / 2);
});

test("루트 카드 3장: 함께 가는 사람 × 도시, 누르면 그 루트 하나만 열린다(안 비교 없음)", async ({ page }) => {
  await page.goto("/");
  const cards = page.locator("a.route-card");
  await expect(cards).toHaveCount(3);
  await expect(cards.nth(0)).toHaveAttribute("href", "/trip/route-wheelchair");
  await expect(cards.nth(1)).toHaveAttribute("href", "/trip/route-elder");
  await expect(cards.nth(2)).toHaveAttribute("href", "/trip/route-stroller");
  await expect(cards.nth(1)).toContainText("어르신 · 속초 · 당일");
  await page.route("https://dapi.kakao.com/**", (r) => r.abort());
  await page.route("**/api/legs", (r) => r.fulfill({ json: { days: [] } }));
  await page.route("**/api/route-line", (r) => r.fulfill({ json: { days: [null] } }));
  await cards.nth(2).click();
  await expect(page).toHaveURL(/\/trip\/route-stroller$/);
  await expect(page.getByRole("heading", { level: 1, name: "일정을 만들었어요" })).toBeVisible();
  await expect(page.getByRole("radio")).toHaveCount(0); // 다른 안 고르기 없음(예시 루트는 안마다 radio가 있다)
  await expect(page.getByText("추암해변").first()).toBeVisible();
});

test("PC에서 루트 카드에 마우스를 올리면 30px 떠오르고 '루트 보기' 딱지가 나타난다", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "마우스는 PC에서");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const card = page.locator("a.route-card").first();
  await card.scrollIntoViewIfNeeded();
  await card.hover();
  await expect.poll(() => card.evaluate((el) => getComputedStyle(el).transform)).toBe("matrix(1, 0, 0, 1, 0, -30)");
  await expect(card.locator(".route-card__badge")).toHaveCSS("opacity", "1");
});

test("대표 관광지 8곳은 관광지 둘러보기로 간다", async ({ page }) => {
  await page.goto("/");
  const section = page.getByRole("region", { name: /어디부터/ });
  const links = section.getByRole("listitem").getByRole("link");
  await expect(links).toHaveCount(8);
  await expect(links.first()).toHaveAttribute("href", "/places");
});
