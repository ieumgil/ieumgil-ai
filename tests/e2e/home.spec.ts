// 시작 화면(/): 03단계 D-10 배치 — 휴대폰은 로고 → 결과 화면 미리보기 → 제목 → 주 버튼 → 특징 목록 순서(03-15), 주 버튼은 390×844 첫 화면 안.
// 특징은 카드 없는 목록, '영동 여행'과 미리보기 뒤 면만 솔숲 초록. PC(1024px~)는 왼쪽 소개 + 오른쪽 미리보기 두 칸.
// 인트로는 sessionStorage로 건너뛴다(인트로 자체는 intro.spec이 본다). 서비스 원칙 문구('일반 차량 경로 기준')와 특징 여섯 문장은 그대로 남아야 한다(원칙 6).
import { expect, test } from "@playwright/test";

const PINE = "rgb(42, 106, 80)";
const INK = "rgb(25, 31, 40)";
const PINE_SOFT = "rgb(232, 243, 236)";

const FEATURES = [
  ["조건을 어기는 곳은 빼요", "계단, 화장실, 걷는 거리처럼 꼭 필요한 조건을 유형별로 확인해요"],
  ["판정마다 근거를 보여줘요", "어디서 확인한 정보인지, 언제 확인했는지 함께 알려드려요"],
  ["AI가 쉬운 말로 정리해요", "루트와 주의할 점, 챙길 것을 짧게 브리핑해요"],
];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem("ieumgil-intro-seen", "1"));
});

// 03-15: 휴대폰에서 미리보기가 맨 위로 올라왔다. 예전의 '667px 높이에서도 주 버튼 보임'(≤667)은 같은 뜻(스크롤 없이 주 버튼이 첫 화면 안)을
// 시안 높이 390×844로 바꿔 지킨다(미리보기가 늘어난 만큼 예산을 844로 옮긴 오케스트레이터 결정).
test("390×844 첫 화면 안에 주 버튼이 통째로 보인다", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "휴대폰 화면 예산이라 모바일 프로젝트에서만");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const main = page.getByRole("link", { name: "여행 루트 만들기" });
  await expect(main).toBeVisible();
  const box = await main.boundingBox();
  expect(box!.y + box!.height).toBeLessThanOrEqual(844);
});

test("휴대폰 순서: 미리보기 → 제목 → 주 버튼 → 특징 목록", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "휴대폰 순서라 모바일 프로젝트에서만");
  await page.goto("/");
  const preview = page.getByRole("figure", { name: "결과 화면 미리보기" });
  await expect(preview).toBeVisible();
  await expect(preview.getByRole("img")).toHaveCount(2);
  const logo = await page.getByRole("link", { name: /이음길/ }).first().boundingBox();
  const fig = await preview.boundingBox();
  const h1 = await page.getByRole("heading", { level: 1 }).boundingBox();
  const main = await page.getByRole("link", { name: "여행 루트 만들기" }).boundingBox();
  const list = await page.getByRole("list", { name: "이음길 특징" }).boundingBox();
  expect(logo!.y + logo!.height).toBeLessThanOrEqual(fig!.y + 1);
  expect(fig!.y + fig!.height).toBeLessThanOrEqual(h1!.y + 1); // 미리보기가 제목 위
  expect(h1!.y).toBeLessThan(main!.y);
  expect(main!.y).toBeLessThan(list!.y); // 특징 목록이 맨 아래
  expect(fig!.height).toBeLessThanOrEqual(340); // 첫 화면 예산 때문에 높이를 묶어 둠(잘린 휴대폰)
});

test("미리보기는 누르거나 초점이 가는 곳이 없고 가로 스크롤을 만들지 않는다", async ({ page }) => {
  for (const width of [320, 390, 820]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const preview = page.getByRole("figure", { name: "결과 화면 미리보기" });
    await expect(preview).toBeVisible();
    await expect(preview.locator("a, button, input, [tabindex]")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), `${width}px`).toBeLessThanOrEqual(0);
  }
});

test("주 버튼이 특징 목록보다 위에 있다", async ({ page }) => {
  await page.goto("/");
  const main = await page.getByRole("link", { name: "여행 루트 만들기" }).boundingBox();
  const list = await page.getByRole("list", { name: "이음길 특징" }).boundingBox();
  expect(main!.y).toBeLessThan(list!.y);
});

test("특징은 카드 없는 목록이고 문장은 그대로다", async ({ page }) => {
  await page.goto("/");
  const list = page.getByRole("list", { name: "이음길 특징" });
  const items = list.getByRole("listitem");
  await expect(items).toHaveCount(3);
  for (const item of await items.all()) {
    await expect(item).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  }
  await expect(list.locator("svg")).toHaveCount(0);
  for (const [title, body] of FEATURES) {
    await expect(list.getByText(title, { exact: true })).toBeVisible();
    await expect(list.getByText(body, { exact: true })).toBeVisible();
  }
});

test("'영동 여행'만 솔숲 초록이고 나머지 제목 글자는 본문색이다", async ({ page }) => {
  await page.goto("/");
  const h1 = page.getByRole("heading", { level: 1 });
  await expect(h1).toContainText("함께 가는 영동 여행");
  await expect(h1.getByText("영동 여행", { exact: true })).toHaveCSS("color", PINE);
  await expect(h1).toHaveCSS("color", INK);
  await expect(h1).toHaveCSS("font-size", "28px");
});

test("일반 차량 경로 문구가 항상 보인다", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("회원가입 없이 쓸 수 있어요 · 일반 차량 경로 기준")).toBeVisible();
});

test("PC 미리보기 뒤 면은 pine-soft다", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "미리보기는 PC에서만 보인다");
  await page.goto("/");
  const figure = page.getByRole("figure", { name: "결과 화면 미리보기" });
  await expect(figure).toBeVisible();
  await expect(figure.locator(':scope > div[aria-hidden="true"]')).toHaveCSS("background-color", PINE_SOFT);
});

test("PC는 왼쪽 소개 + 오른쪽 미리보기 두 칸이고 미리보기는 잘리지 않는다", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "PC 배치는 PC 프로젝트에서만");
  await page.goto("/");
  const figure = page.getByRole("figure", { name: "결과 화면 미리보기" });
  const h1 = await page.getByRole("heading", { level: 1 }).boundingBox();
  const fig = await figure.boundingBox();
  expect(fig!.x).toBeGreaterThan(h1!.x + h1!.width / 2); // 오른쪽 칸
  expect(fig!.height).toBeGreaterThanOrEqual(600); // 38rem, 휴대폰 두 대 전체
  await expect(figure).toHaveCSS("overflow", "visible");
  await expect(figure.getByText("실제 결과 화면 · 일정 비교와 확정 일정 지도")).toBeVisible();
});
