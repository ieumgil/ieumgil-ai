// 시작 화면(/) — 11/23 시작 화면 개편(PC 먼저, 휴대폰은 다음 단계 보수).
// 위에서 아래로: 사이트 머리줄(모든 화면) → 히어로(숑숑 문구) → 바로가기 띠(비짓강릉 CSS) → 소개(특징 + 주 버튼 + 미리보기)
//   → 물결 → 루트 카드 3장(예당 캠핑장 CSS, 누르면 그 루트 하나만) → 대표 관광지 → 바닥글.
// 예전 시험의 뜻은 그대로 지킨다: 주 버튼이 있고, 서비스 원칙 문구('일반 차량 경로 기준')가 보이고, 특징 문장이 남아 있고,
// 미리보기는 누르는 곳이 없고 가로 스크롤을 만들지 않는다. '첫 화면 안에 주 버튼'(03-16)은 히어로가 맨 위로 오면서
// 바로가기 띠의 '여행 루트 만들기'가 그 역할을 맡는다(PC 첫 화면 안).
import { expect, test } from "@playwright/test";

// 11/23 소개 구역: 특징 목록 → 단계 탭 3개 + 휴대폰 화면 전환(강진 MOBILITY · 울진 유튜브속 울진 레퍼런스)
const FEATURES = [
  ["조건에 안 맞는 곳은 빼요", "계단·화장실·걷는 거리를 함께 가는 사람 기준으로 확인해요"],
  ["왜 골랐는지와 출처를 보여 줘요", "장소마다 판단과 한 줄 이유, 관광공사 출처를 붙여요"],
  ["모르는 건 물어볼 것을 알려 줘요", "출발 전에 전화로 물어볼 질문과 공식 번호를 붙여요"],
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

test("소개 단계 3개는 탭이고 문장이 남아 있으며, 고르면 휴대폰 속 화면이 바뀐다 · 주 버튼과 원칙 문구가 보인다", async ({ page }) => {
  await page.goto("/");
  const tabs = page.getByRole("tablist", { name: "이음길이 고르는 방법" }).getByRole("tab");
  await expect(tabs).toHaveCount(3);
  for (const [i, [title, body]] of FEATURES.entries()) {
    await expect(tabs.nth(i)).toContainText(title);
    await expect(tabs.nth(i)).toContainText(body);
  }
  await expect(tabs.nth(0)).toHaveAttribute("aria-selected", "true");
  const screen = page.getByRole("tabpanel").getByRole("img");
  await expect(screen).toHaveAttribute("alt", /꼭 필요한 조건 화면/);
  await tabs.nth(2).click();
  await expect(tabs.nth(2)).toHaveAttribute("aria-selected", "true");
  await expect(screen).toHaveAttribute("alt", /전화로 확인할 곳/);
  // 키보드: 위 화살표로 이전 단계
  await page.keyboard.press("ArrowUp");
  await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
  await expect(tabs.nth(1)).toBeFocused();
  await expect(page.locator("section[aria-labelledby=intro-title]").getByRole("link", { name: "여행 루트 만들기" })).toHaveAttribute("href", "/plan");
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

test("대표 관광지 8곳은 누르면 관광지 둘러보기에서 그 관광지가 바로 열린다", async ({ page }) => {
  await page.goto("/");
  const section = page.getByRole("region", { name: /어디부터/ });
  const links = section.getByRole("listitem").getByRole("link");
  await expect(links).toHaveCount(8);
  for (const l of await links.all()) await expect(l).toHaveAttribute("href", /^\/places\?place=[A-Z]{2}\d+$/);
  // 속초 관광지(지역 탭이 강릉이 아닌 곳)를 눌러도 그 지역 탭이 골라지고 자세히 창이 열린다
  const sokcho = section.getByRole("link", { name: /속초/ }).first();
  const name = (await sokcho.locator("span.font-medium").textContent())!.trim();
  await sokcho.click();
  await expect(page).toHaveURL(/\/places\?place=SC/);
  const sheet = page.getByRole("dialog");
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("heading", { name })).toBeVisible();
  // 닫으면 속초 탭이 골라져 있고, 목록에서 그 관광지 카드가 화면에 보인다(창이 열린 동안 뒤 화면은 보조기기에서 가려진다)
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await expect(page.getByRole("radiogroup", { name: "지역" }).getByRole("radio", { checked: true })).toContainText("속초");
  await expect(page.locator("li[id^='place-SC']").filter({ hasText: name }).first()).toBeInViewport();
});

// 11/23 스크롤 고정: 넓고 높은 화면에서 소개 구역에 들어오면 한 화면이 고정된 채 스크롤로 1→2→3단계, 끝나면 고정이 풀린다
test("PC: 소개 구역은 화면이 고정된 채 스크롤로 1→3단계가 바뀌고, 지나간 번호는 클리어, 끝나면 풀린다", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "고정은 넓고 높은 화면에서만");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const box = await page.locator(".intro-scroll").evaluate((el) => ({ top: el.getBoundingClientRect().top + window.scrollY, h: (el as HTMLElement).offsetHeight }));
  expect(box.h).toBeGreaterThan(900 * 2); // 화면 세 배 길이
  const tabs = page.getByRole("tablist", { name: "이음길이 고르는 방법" }).getByRole("tab");
  const pinTop = () => page.locator(".intro-pin").evaluate((el) => Math.round(el.getBoundingClientRect().top));
  for (const [f, idx] of [[0.1, 0], [0.5, 1], [0.9, 2]] as const) {
    await page.evaluate(([t, h, f]) => window.scrollTo(0, t + (h - window.innerHeight) * f), [box.top, box.h, f]);
    await expect(tabs.nth(idx)).toHaveAttribute("aria-selected", "true");
    expect(await pinTop()).toBe(0); // 고정
  }
  await expect(page.locator(".intro-step__no[data-passed]")).toHaveCount(3);
  await page.evaluate(([t, h]) => window.scrollTo(0, t + h + 200), [box.top, box.h]);
  expect(await pinTop()).toBeLessThan(0); // 풀림
});

// 11/24 고칠 목록 11번: 첫 화면(히어로)에서 바로 누르는 주 버튼 — 설명 아래 · 날씨 위, 첫 화면 안에 보인다
test("히어로에 '여행 루트 만들기' 주 버튼과 '예시 루트 먼저 보기'가 첫 화면 안에 있다", async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("ieumgil-intro-seen", "1"));
  await page.goto("/");
  const hero = page.locator("section[aria-labelledby='hero-title']");
  const cta = hero.getByRole("link", { name: "여행 루트 만들기" });
  await expect(cta).toHaveAttribute("href", "/plan");
  await expect(cta).toBeInViewport();
  expect((await cta.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await expect(cta).toHaveCSS("background-color", "rgb(61, 170, 126)");
  await expect(hero.getByRole("link", { name: /예시 루트 먼저 보기/ })).toHaveAttribute("href", "/trip/example");
});

// 고칠 목록 9(11/24): 스크롤하면 루트 카드·대표 관광지가 차례로 나타난다. 끝까지 내리면 숨은 것이 남지 않는다
test("스크롤 등장: 아래쪽 카드는 기다렸다가 내려가면 모두 나타나고, 단계 소개(화면 고정)에는 쓰지 않는다", async ({ page }) => {
  await page.goto("/");
  const waiting = page.locator('main [data-reveal="wait"]');
  await expect.poll(() => waiting.count()).toBeGreaterThan(0);
  await expect(page.locator("section[aria-labelledby=intro-title] [data-reveal]")).toHaveCount(0);
  const h = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y <= h; y += 300) {
    await page.evaluate((v) => window.scrollTo(0, v), y);
    await page.waitForTimeout(60);
  }
  await expect(waiting).toHaveCount(0);
  await expect(page.getByRole("link", { name: /강릉 오죽헌/ }).first()).toBeVisible();
});

test("동작 줄이기 설정이면 시작 화면은 처음부터 모두 보인다", async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: "reduce" });
  await ctx.addInitScript(() => sessionStorage.setItem("ieumgil-intro-seen", "1"));
  const page = await ctx.newPage();
  await page.goto("/");
  await page.waitForTimeout(500);
  await expect(page.locator('[data-reveal="wait"]')).toHaveCount(0);
  await ctx.close();
});
