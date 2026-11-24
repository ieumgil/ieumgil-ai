// 관광지 둘러보기: 지역·분야로 둘러보고, 어떤 곳인지 보고, 담으면 4단계 '꼭 가고 싶은 곳'에 들어간다.
import { expect, test, type Page } from "@playwright/test";
import { expectSelectedCentered, expectUnselectedCentered } from "./mark-geometry";
import { openDisclosure } from "./open-details";

test.beforeEach(async ({ page }) => {
  await page.route("https://tong.visitkorea.or.kr/**", (r) => r.abort()); // 관광공사 원본 사진(외부 호출 없음)
  await page.addInitScript(() => {
    sessionStorage.setItem("ieumgil-intro-seen", "1");
    sessionStorage.setItem(
      "ieumgil-plan",
      JSON.stringify({ startDate: "2026-12-12", endDate: "2026-12-12", arrival: "gangneung-station", transport: "taxi", travelers: ["wheelchair"], categories: ["바다·해변"], mustVisit: [] }),
    );
  });
});

test("4단계에서 '관광지 둘러보고 고르기'로 들어가 담으면, 돌아왔을 때 꼭 가고 싶은 곳에 있다 @p0308-taste", async ({ page }) => {
  await page.goto("/plan/taste");
  // '꼭 가고 싶은 곳'은 선택 사항이라 접혀 있다: 펼친 뒤 링크를 누른다
  await openDisclosure(page.locator("summary", { hasText: "꼭 가고 싶은 곳" }));
  await page.getByRole("link", { name: /관광지 둘러보고 고르기/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "영동 관광지 둘러보기" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "대표 관광지" })).toBeVisible();
  // 고른 유형(휠체어) 기준 접근성 요약이 카드에 있다
  await expect(page.getByText(/휠체어/).first()).toBeVisible();
  const first = page.locator("article").first();
  const name = (await first.getByRole("heading").textContent())!.replace("대표", "").trim();
  await first.getByRole("button", { name: /담기$/ }).click();
  await expect(first.getByRole("button", { name: /담기 취소/ })).toBeVisible();
  await expect(page.getByText("담은 곳 1곳")).toBeVisible();
  await page.getByRole("link", { name: /돌아가기/ }).click();
  await expect(page).toHaveURL(/\/plan\/taste$/);
  await expect(page.getByRole("list", { name: "꼭 가고 싶은 곳" })).toContainText(name);
});

test("지역·분야를 바꾸고, 볼 거리 낱말로 찾고, 자세히 보기에서 관광공사 소개와 접근성 10항목을 본다", async ({ page }) => {
  await page.goto("/places");
  await page.getByRole("radio", { name: /속초/ }).click();
  await expect(page.locator("article").first()).toContainText("속초");
  await page.getByRole("button", { name: "전시·박물관", exact: true }).click();
  const cards = page.locator("article");
  expect(await cards.count()).toBeGreaterThan(0);
  for (const t of await cards.allTextContents()) expect(t).toContain("전시·박물관");
  await page.getByRole("button", { name: "전체", exact: true }).click();
  await page.getByRole("radio", { name: /강릉/ }).click();
  await page.getByRole("searchbox", { name: "관광지 찾기" }).fill("율곡");
  await expect(cards.first()).toContainText("오죽헌");
  await cards.first().getByRole("button", { name: "자세히 보기" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "관광공사 소개" })).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "접근성" })).toBeVisible();
  await expect(dialog.locator("ul").last().locator("li")).toHaveCount(10);
  await expect(dialog.getByRole("link", { name: /\d{2,4}-\d{3,4}-\d{4}/ })).toBeVisible();
});

test("자세히 보기: 공중화장실 공공데이터 값은 출처·기준일과 함께 보인다(안목해변·망상해변)", async ({ page }) => {
  await page.goto("/places");
  await page.getByRole("searchbox", { name: "관광지 찾기" }).fill("안목해변");
  await page.locator("article").filter({ hasText: "안목해변" }).first().getByRole("button", { name: "자세히 보기" }).click();
  let dialog = page.getByRole("dialog");
  await expect(dialog.getByText("장애인 칸 2").first()).toBeVisible();
  await expect(dialog.getByText("남녀 화장실 모두")).toBeVisible();
  await expect(dialog.getByText("공공데이터(2024-12 기준)").first()).toBeVisible();
  await expect(dialog.getByText(/행정안전부/).first()).toBeVisible();
  await expect(dialog.locator("ul").last().locator("li")).toHaveCount(10);
  await page.keyboard.press("Escape");

  await page.getByRole("radio", { name: /동해/ }).click();
  await page.getByRole("searchbox", { name: "관광지 찾기" }).fill("망상해변");
  await page.locator("article").filter({ hasText: "망상해변" }).first().getByRole("button", { name: "자세히 보기" }).click();
  dialog = page.getByRole("dialog");
  await expect(dialog.getByText(/여자화장실에만/)).toBeVisible();
  await expect(dialog.getByText("공공데이터(2025-06 기준)").first()).toBeVisible();
});

test("공공데이터 값이 없는 곳은 안내 문장이 그대로", async ({ page }) => {
  await page.goto("/places");
  await page.getByRole("searchbox", { name: "관광지 찾기" }).fill("율곡");
  await page.locator("article").first().getByRole("button", { name: "자세히 보기" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("관광공사 무장애 정보를 AI가 정리한 값이에요.")).toBeVisible();
  await expect(dialog).not.toContainText("행정안전부");
});

test("시작 화면에서도 들어갈 수 있고, 누를 수 있는 것은 44px 이상", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("navigation", { name: "주요 바로가기" }).getByRole("link", { name: "관광지 둘러보기" }).click();
  await expect(page).toHaveURL(/\/places$/);
  for (const el of await page.locator("main button:visible, main a:visible").all()) {
    const box = await el.boundingBox();
    if (box) expect(box.height, (await el.textContent()) ?? "").toBeGreaterThanOrEqual(44);
  }
});

test("내려가면 오른쪽 아래에 '맨 위로' 버튼이 뜨고, 누르면 맨 위로 올라간다", async ({ page }) => {
  await page.goto("/places");
  await expect(page.getByRole("button", { name: "맨 위로" })).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 2000));
  const top = page.getByRole("button", { name: "맨 위로" });
  await expect(top).toBeVisible();
  // 나타날 때 톡 튀어나오는 움직임(animate-pop, 크기 0.x→1) 도중에는 화면 크기가 작게 잡힌다 → 움직임이 끝난 뒤의 높이를 본다
  await expect.poll(async () => (await top.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await top.click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(50);
});

// ---- 03-09: 둘러보기 정리(머리 예산 · 지역 분할 · 범례 접기 · 한 겹 항목 · 담기 이름 · 불투명 바) ----
const MARK = 'span[aria-hidden="true"]';
const PINE = "rgb(61, 170, 126)";

/** 입력(휠체어)이 화면에 반영될 때까지 기다린다: 그 전에 누르면 아직 붙지 않은 화면이라 눌림이 사라진다 */
async function gotoPlaces(page: Page) {
  await page.goto("/places");
  await expect(page.getByText("휠체어 기준으로 꼭 필요한 조건")).toBeVisible();
  await expect(page.locator("article").first()).toBeVisible();
}

test.describe("둘러보기 첫 화면", () => {
  test("머리 영역은 300px 안, 첫 장소가 첫 화면에 @p0309", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "머리 예산은 휴대폰 폭(390px)에서만 본다");
    // 둘째 화면 로드부터는 유형을 고르지 않은 입력으로 바꾼다(첫 로드는 beforeEach의 휠체어 입력)
    await page.addInitScript(() => {
      if (sessionStorage.getItem("p0309-no-type")) {
        sessionStorage.setItem(
          "ieumgil-plan",
          JSON.stringify({ startDate: "2026-12-12", endDate: "2026-12-12", arrival: "gangneung-station", transport: "taxi", travelers: [], categories: [], mustVisit: [] }),
        );
      }
    });
    const firstAboveBar = async () => {
      const first = (await page.locator("article").first().boundingBox())!;
      const bar = (await page.locator("[data-bottom-bar]").boundingBox())!;
      expect(first.y).toBeLessThan(bar.y);
      return first;
    };

    await gotoPlaces(page); // 휠체어 기준 한 줄이 더해진 상태: 그래도 첫 장소가 바 위에 보인다
    await expect(page.locator("article").first()).toBeVisible();
    await firstAboveBar();

    await page.evaluate(() => sessionStorage.setItem("p0309-no-type", "1"));
    await page.reload(); // 유형을 안 고른 기본 상태: 머리는 300px 안
    await expect(page.locator("article").first()).toBeVisible();
    const h1 = (await page.getByRole("heading", { level: 1, name: "영동 관광지 둘러보기" }).boundingBox())!;
    const search = (await page.getByRole("searchbox", { name: "관광지 찾기" }).locator("xpath=ancestor::label").boundingBox())!;
    expect(search.y + search.height - h1.y).toBeLessThanOrEqual(300);
    await firstAboveBar();
  });

  test("지역은 한 줄 분할, 고른 지역 숫자는 솔숲 초록 @p0309", async ({ page }) => {
    await gotoPlaces(page);
    const radios = page.getByRole("radiogroup", { name: "지역" }).getByRole("radio");
    await expect(radios).toHaveCount(3);
    const boxes = await radios.evaluateAll((els) => els.map((el) => el.getBoundingClientRect()).map((r) => ({ y: r.y, h: r.height })));
    expect(Math.max(...boxes.map((b) => b.y)) - Math.min(...boxes.map((b) => b.y))).toBeLessThanOrEqual(1);
    for (const b of boxes) {
      expect(b.h).toBeGreaterThanOrEqual(44);
      expect(b.h).toBeLessThanOrEqual(56);
    }
    await expect(radios.nth(0).getByText(/^\d+곳$/)).toHaveCSS("color", PINE);
  });

  test("범례는 '접근성 표시 보는 법' 안에 있다 @p0309", async ({ page }) => {
    await gotoPlaces(page);
    const summary = page.locator("summary", { hasText: "접근성 표시 보는 법" });
    await expect(summary).toBeVisible();
    const legend = page.getByText(/✓ 가능 · ! 일부만/);
    await expect(legend).not.toBeVisible();
    await summary.click();
    await expect(legend).toBeVisible();
    await expect(legend).toContainText("✕ 어려움 · ? 공식 정보 없음");
  });

  test("장소 항목은 한 겹, 이름 20px, 지역·분류는 솔숲 초록, 볼 거리는 자세히 안 @p0309", async ({ page }) => {
    await gotoPlaces(page);
    const first = page.locator("article").first();
    await expect(first).toBeVisible();
    await expect(first).toHaveCSS("box-shadow", "none");
    await expect(first).toHaveCSS("border-top-width", "1px");
    await expect(first.getByRole("heading", { level: 3 })).toHaveCSS("font-size", "20px");
    await expect(first.getByText(/^(강릉|속초|동해) · /)).toHaveCSS("color", PINE);
    await expect(first).not.toContainText("볼 거리");
  });

  test("칩은 4개까지 + 나머지 개수 @p0309", async ({ page }) => {
    await gotoPlaces(page);
    await expect(page.locator("article").first()).toBeVisible();
    const lists = await page.locator("article ul").evaluateAll((els) => els.map((ul) => [...ul.children].map((li) => li.textContent ?? "")));
    expect(lists.length).toBeGreaterThan(0);
    for (const items of lists) {
      expect(items.length).toBeLessThanOrEqual(5);
      if (items.length === 5) expect(items[4]).toMatch(/^\+\d+/);
    }
    expect(lists.some((items) => items.length === 5)).toBe(true); // 휠체어 필수 조건은 4개를 넘어 '+N'이 실제로 나온다
  });

  test("담았어요 이름에 보이는 글자가 들어간다 @p0309", async ({ page }) => {
    await gotoPlaces(page);
    const first = page.locator("article").first();
    await first.getByRole("button", { name: /담기$/ }).click();
    const done = first.getByRole("button", { name: /담았어요, 누르면 담기 취소/ });
    await expect(done).toBeVisible();
    await expect(done).toContainText("담았어요"); // 보이는 글자
    await expect(done).toHaveAttribute("aria-pressed", "true");
    await expect(first).toHaveCSS("border-top-width", "2px"); // 담은 곳은 2px 테두리
  });

  test("아래 바는 불투명 @p0309", async ({ page }) => {
    await gotoPlaces(page);
    const bar = page.locator("[data-bottom-bar]");
    await expect(bar).toBeVisible();
    await expect(bar).toHaveCSS("background-color", "rgb(255, 255, 255)");
    await expect(bar).toHaveCSS("backdrop-filter", "none");
  });

  test("자세히 창 제목은 제목 글꼴(Pretendard) @p0309 @p0309-detail", async ({ page }) => {
    await gotoPlaces(page);
    await page.locator("article").first().getByRole("button", { name: "자세히 보기" }).click();
    const title = page.getByRole("dialog").getByRole("heading", { level: 2 });
    const family = await title.evaluate((el) => getComputedStyle(el).fontFamily);
    expect(family.replace(/["']/g, "").toLowerCase().startsWith("pretendard")).toBe(true);
    await expect(title).toHaveCSS("font-size", "20px");
  });

  test("지역·분야 칩의 글자는 고르기 전·후 모두 칩 가운데에 있다 @p0314", async ({ page }) => {
    await gotoPlaces(page);
    const centerGap = (btn: import("@playwright/test").Locator) =>
      btn.evaluate((el) => {
        const label = el.querySelector(":scope > span:last-of-type") as HTMLElement;
        const b = el.getBoundingClientRect();
        const l = label.getBoundingClientRect();
        return Math.abs(l.left + l.width / 2 - (b.left + b.width / 2));
      });
    const regions = page.getByRole("radiogroup", { name: "지역" });
    expect(await centerGap(regions.getByRole("radio", { name: /속초/ }))).toBeLessThanOrEqual(2); // 안 고름
    expect(await centerGap(regions.getByRole("radio", { name: /강릉/ }))).toBeLessThanOrEqual(2); // 고름
    // 지역은 칸 폭이 정해진 넓은 분할 칸: ✓가 글자 바로 앞('✓ 강릉 101곳')이고 묶음이 칸 가운데, 안 고른 칸은 글자만 가운데(03-15)
    await expectSelectedCentered(regions.getByRole("radio", { name: /강릉/ }));
    await expectUnselectedCentered(regions.getByRole("radio", { name: /속초/ }));
    await regions.getByRole("radio", { name: /속초/ }).click();
    await expectSelectedCentered(regions.getByRole("radio", { name: /속초/ }));
    await expectUnselectedCentered(regions.getByRole("radio", { name: /강릉/ }));
    await regions.getByRole("radio", { name: /강릉/ }).click();
    const cats = page.getByRole("group", { name: "분야" });
    const exhibit = cats.getByRole("button", { name: "전시·박물관", exact: true });
    expect(await centerGap(exhibit)).toBeLessThanOrEqual(2);
    await exhibit.click();
    expect(await centerGap(exhibit)).toBeLessThanOrEqual(2);
  });

  test("고른 지역·분야는 ✓로도 구분된다 @p0309", async ({ page }) => {
    await gotoPlaces(page);
    const regions = page.getByRole("radiogroup", { name: "지역" });
    await expect(regions.getByRole("radio", { name: /강릉/ }).locator(MARK, { hasText: "✓" })).toBeVisible();
    await expect(regions.getByRole("radio", { name: /속초/ }).locator(MARK, { hasText: "✓" })).not.toBeVisible();
    const cats = page.getByRole("group", { name: "분야" });
    const exhibit = cats.getByRole("button", { name: "전시·박물관", exact: true });
    await exhibit.click();
    await expect(exhibit.locator(MARK, { hasText: "✓" })).toBeVisible();
    await expect(cats.getByRole("button", { name: "전체", exact: true }).locator(MARK, { hasText: "✓" })).not.toBeVisible();
    // ✓는 장식이라 접근 이름은 그대로
    await expect(exhibit).toHaveAccessibleName("전시·박물관");
  });
});
