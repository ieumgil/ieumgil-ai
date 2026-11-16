// 입력 4단계 흐름을 실제 브라우저로 검사한다.
// 날짜는 고정 시계(2026-11-14 토)로 두고, 예시 날짜 11/21(토)을 고른다.
import { expect, test, type Page } from "@playwright/test";
import { openDisclosure } from "./open-details";

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-14T10:00:00+09:00"));
});

async function pickDay(page: Page, day: number) {
  await page.getByRole("button", { name: new RegExp(`^2026년 11월 ${day} 일`) }).click();
}

test("시작 화면에서 1단계로 들어간다", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("함께 가는 영동 여행");
  await page.getByRole("link", { name: "여행 루트 만들기" }).click();
  await expect(page).toHaveURL(/\/plan\/when$/);
  await expect(page.getByRole("heading", { name: "언제 여행하나요?" })).toBeVisible();
});

test("1단계: 다 채우기 전에는 다음으로 갈 수 없고, 빠진 항목을 버튼에 보여준다", async ({ page }) => {
  await page.goto("/plan/when");
  await expect(page.getByRole("button", { name: "날짜를 골라 주세요" })).toBeDisabled();

  await pickDay(page, 21);
  await expect(page.getByText("당일", { exact: false }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "도착 지점을 골라 주세요" })).toBeDisabled();

  await page.getByRole("radio", { name: "강릉역" }).click();
  await expect(page.getByRole("button", { name: "이동수단을 골라 주세요" })).toBeDisabled();

  await page.getByRole("radio", { name: "택시" }).click();
  await expect(page.getByRole("link", { name: "다음 · 누구와 가나요" })).toBeVisible();
});

test("막힌 다음 버튼을 누르면 아직 안 고른 칸으로 가서 잠깐 표시하고, 그 칸으로 포커스를 옮긴다", async ({ page }) => {
  await page.goto("/plan/when");
  await pickDay(page, 21);
  const blocked = page.getByRole("button", { name: "도착 지점을 골라 주세요" });
  await blocked.click({ force: true }); // 비활성 표시(aria-disabled)여도 실제로 눌린다
  const arrival = page.locator("#field-arrival");
  await expect(arrival).toHaveAttribute("data-attention", "");
  await expect(arrival).toBeInViewport();
  await expect(page.getByRole("radio", { name: "강릉역" })).toBeFocused();
  await expect(arrival).not.toHaveAttribute("data-attention", "", { timeout: 4000 }); // 잠깐 뒤 사라짐
  await expect(page).toHaveURL(/\/plan\/when$/); // 다음으로 넘어가지 않음

  await page.goto("/plan/who");
  await page.getByRole("button", { name: "유형을 골라 주세요" }).click({ force: true });
  await expect(page.locator("#field-travelers")).toHaveAttribute("data-attention", "");
});

test("숙소: 1박이면 한 줄, 2박이면 '둘째 밤' 줄이 하나 더(기본은 첫째 밤과 같음)", async ({ page }) => {
  await page.goto("/plan/when");
  await pickDay(page, 21);
  await pickDay(page, 22); // 1박 2일
  await expect(page.getByRole("radiogroup", { name: "숙소 지역" })).toBeVisible();
  await expect(page.getByRole("radiogroup", { name: "둘째 밤 숙소 지역" })).toHaveCount(0);

  await pickDay(page, 21);
  await pickDay(page, 23); // 2박 3일로 다시 고르기
  await expect(page.getByRole("radiogroup", { name: "첫째 밤 숙소 지역" })).toBeVisible();
  const second = page.getByRole("radiogroup", { name: "둘째 밤 숙소 지역" });
  await expect(second.getByRole("radio", { name: /첫째 밤과 같음/ })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("radiogroup", { name: "첫째 밤 숙소 지역" }).getByRole("radio", { name: "강릉" }).click();
  await second.getByRole("radio", { name: "속초" }).click();
  await expect(second.getByRole("radio", { name: "속초" })).toHaveAttribute("aria-checked", "true");
  const saved = await page.evaluate(() => JSON.parse(sessionStorage.getItem("ieumgil-plan") ?? "{}"));
  expect([saved.lodging, saved.lodging2]).toEqual(["강릉", "속초"]);
});

test("1단계 이후 화면에는 가운데 로고가 없고 뒤로 버튼만 있다", async ({ page }) => {
  await page.goto("/plan/who");
  await expect(page.getByRole("link", { name: "이전 단계로" })).toBeVisible();
  await expect(page.getByRole("link", { name: "이음길 처음 화면" })).toHaveCount(0);
});

test("1박 이상이면 숙소 지역을 골라야 한다", async ({ page }) => {
  await page.goto("/plan/when");
  await pickDay(page, 21);
  await pickDay(page, 22);
  await page.getByRole("radio", { name: "강릉역" }).click();
  await page.getByRole("radio", { name: "택시" }).click();
  await expect(page.getByRole("button", { name: "숙소 지역을 골라 주세요" })).toBeDisabled();

  await page.getByRole("radio", { name: "속초", exact: true }).click();
  await expect(page.getByRole("link", { name: "다음 · 누구와 가나요" })).toBeVisible();
});

test("휠체어 · 자가용 + 표지 차량: 장애인 전용 주차가 필수 조건으로 켜지고 4단계까지 간다", async ({ page }) => {
  await page.goto("/plan/when");
  await pickDay(page, 21);
  await page.getByRole("radio", { name: "강릉역" }).click();
  await page.getByRole("radio", { name: "자가용·렌터카" }).click();
  await page.getByLabel("장애인 사용 자동차 표지가 있어요").check();
  await page.getByRole("link", { name: "다음 · 누구와 가나요" }).click();

  await expect(page).toHaveURL(/\/plan\/who$/);
  await expect(page.getByRole("button", { name: "유형을 골라 주세요" })).toBeDisabled();
  await page.getByRole("button", { name: /휠체어 이용/ }).click();
  await page.getByRole("link", { name: "다음 · 꼭 필요한 조건" }).click();

  await expect(page).toHaveURL(/\/plan\/conditions$/);
  const parking = page.getByLabel(/장애인 전용 주차구역/);
  await expect(parking).toBeChecked();
  await expect(page.getByLabel(/장애인 화장실/)).toBeChecked();
  await page.getByRole("link", { name: "다음 · 좋아하는 곳" }).click();

  await expect(page).toHaveURL(/\/plan\/taste$/);
  await expect(page.getByRole("button", { name: "좋아하는 곳을 골라 주세요" })).toBeDisabled();
  await page.getByRole("button", { name: /바다·해변/ }).click();
  await expect(page.getByRole("link", { name: "루트 만들기" })).toHaveAttribute("href", "/plan/making");
});

test("휠체어 · 택시: 장애인 전용 주차 조건이 나오지 않는다", async ({ page }) => {
  await page.goto("/plan/when");
  await pickDay(page, 21);
  await page.getByRole("radio", { name: "강릉역" }).click();
  await page.getByRole("radio", { name: "택시" }).click();
  await page.getByRole("link", { name: "다음 · 누구와 가나요" }).click();
  await page.getByRole("button", { name: /휠체어 이용/ }).click();
  await page.getByRole("link", { name: "다음 · 꼭 필요한 조건" }).click();

  await expect(page.getByLabel(/장애인 화장실/)).toBeChecked();
  await expect(page.getByLabel(/장애인 전용 주차구역/)).toHaveCount(0);
});

test("어르신을 고르면 걸을 수 있는 거리를 묻는다", async ({ page }) => {
  await page.goto("/plan/when");
  await pickDay(page, 21);
  await page.getByRole("radio", { name: "강릉역" }).click();
  await page.getByRole("radio", { name: "택시" }).click();
  await page.getByRole("link", { name: "다음 · 누구와 가나요" }).click();
  await page.getByRole("button", { name: /보행이 불편한 어르신/ }).click();
  await page.getByRole("link", { name: "다음 · 꼭 필요한 조건" }).click();

  await expect(page.getByRole("radiogroup", { name: /한 번에 걸을 수 있는 거리/ })).toBeVisible();
});

test("1단계를 건너뛰고 2단계로 바로 들어오면 앞 단계를 먼저 채우라고 안내한다", async ({ page }) => {
  await page.goto("/plan/who");
  await page.getByRole("button", { name: /휠체어 이용/ }).click();
  await expect(page.getByRole("link", { name: "다음 · 꼭 필요한 조건" })).toHaveCount(0);
});

// ---- 03-07: 입력 공통 틀·1·2단계 정리 ----------------------------------------------------
test.describe("입력 틀·1·2단계 정리", () => {
  test("h1은 고운바탕 28px이고 개인정보 줄은 보인다 @p0307", async ({ page }) => {
    await page.goto("/plan/who");
    const h1 = page.getByRole("heading", { level: 1 });
    const css = await h1.evaluate((el) => ({ family: getComputedStyle(el).fontFamily, size: getComputedStyle(el).fontSize }));
    expect(css.family.replace(/["']/g, "").startsWith("Gowun Batang")).toBe(true);
    expect(css.size).toBe("28px");
    await expect(page.getByText("이름·연락처는 받지 않아요")).toBeVisible();
  });

  test("아래 고정 버튼 줄은 불투명 흰 바탕 + 위쪽 그림자다 @p0307", async ({ page }) => {
    await page.goto("/plan/when");
    const bar = page.locator("[data-bottom-bar]");
    await expect(bar).toHaveCount(1);
    await expect(bar).toHaveCSS("background-color", "rgb(255, 255, 255)");
    await expect(bar).toHaveCSS("backdrop-filter", "none");
    const shadow = await bar.evaluate((el) => getComputedStyle(el).boxShadow);
    expect(shadow).not.toBe("none");
  });

  test("선택지는 흰 바탕 + 회색 윤곽이고 고르면 파란 테두리 + ✓ 기호가 보인다 @p0307", async ({ page }) => {
    await page.goto("/plan/when");
    const station = page.getByRole("radio", { name: "강릉역" });
    const other = page.getByRole("radio", { name: "동해역" });
    await expect(station).toHaveCSS("background-color", "rgb(255, 255, 255)");
    await expect(station).toHaveCSS("border-top-color", "rgb(139, 149, 161)");
    await expect(station.locator('span[aria-hidden="true"]', { hasText: "✓" })).not.toBeVisible();

    await station.click();
    await expect(station).toHaveCSS("border-top-color", "rgb(30, 111, 208)");
    await expect(station).toHaveCSS("background-color", "rgb(234, 242, 253)");
    await expect(station).toHaveCSS("border-top-width", "2px");
    await expect(station.locator('span[aria-hidden="true"]', { hasText: "✓" })).toBeVisible();
    await expect(other.locator('span[aria-hidden="true"]', { hasText: "✓" })).not.toBeVisible();

    // 타일 모양(이동수단)도 같은 규칙이다
    const taxi = page.getByRole("radio", { name: "택시" });
    await expect(taxi).toHaveCSS("border-top-color", "rgb(139, 149, 161)");
    await expect(taxi).toHaveCSS("background-color", "rgb(255, 255, 255)");
    await taxi.click();
    await expect(taxi).toHaveCSS("border-top-color", "rgb(30, 111, 208)");
    await expect(taxi).toHaveCSS("border-top-width", "2px");
    await expect(taxi.locator('span[aria-hidden="true"]', { hasText: "✓" })).toBeVisible();
  });

  test("선택 버튼의 글자는 고르기 전·후 모두 버튼 가운데에 있다(✓가 글자를 밀지 않는다) @p0314", async ({ page }) => {
    // 글자 칸(마지막 span)의 가운데와 버튼 가운데가 ±2px 안에 있어야 한다.
    const centerGap = (btn: import("@playwright/test").Locator) =>
      btn.evaluate((el) => {
        const label = el.querySelector(":scope > span:last-of-type") as HTMLElement;
        const b = el.getBoundingClientRect();
        const l = label.getBoundingClientRect();
        return Math.abs(l.left + l.width / 2 - (b.left + b.width / 2));
      });
    await page.goto("/plan/when");
    const station = page.getByRole("radio", { name: "강릉역" });
    expect(await centerGap(station)).toBeLessThanOrEqual(2);
    await station.click();
    expect(await centerGap(station)).toBeLessThanOrEqual(2);

    await seedPlan(page, { categories: ["바다·해변"] });
    await page.goto("/plan/taste");
    const group = page.getByRole("radiogroup", { name: "하루에 얼마나 돌아볼까요?" });
    const calm = group.getByRole("radio", { name: /^여유롭게/ });
    const normal = group.getByRole("radio", { name: /^보통/ });
    expect(await centerGap(calm)).toBeLessThanOrEqual(2);
    await normal.click();
    expect(await centerGap(normal)).toBeLessThanOrEqual(2);
    expect(await centerGap(calm)).toBeLessThanOrEqual(2);
    // ✓는 글자와 겹치지 않는다(보일 때 ✓의 오른쪽 끝이 글자 왼쪽 끝보다 왼쪽)
    const overlap = await normal.evaluate((el) => {
      const mark = el.querySelector(':scope > span[aria-hidden="true"]') as HTMLElement;
      const label = el.querySelector(":scope > span:last-of-type") as HTMLElement;
      return mark.getBoundingClientRect().right - label.getBoundingClientRect().left;
    });
    expect(overlap).toBeLessThanOrEqual(0);
  });

  test("1단계: 시각·떠나는 곳은 한 줄 요약 뒤에 접혀 있다 @p0307 @p0307-steps", async ({ page }) => {
    await page.goto("/plan/when");
    await expect(page.getByText(/^\d{2}:\d{2} 시작 · \d{2}:\d{2} 마침 · /)).toBeVisible();
    await expect(page.getByLabel(/시작 시각/)).toHaveCount(0);
    const toggle = page.getByRole("button", { name: "시각·떠나는 곳 설정 바꾸기" });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    const start = page.getByLabel(/시작 시각/);
    await expect(start).toBeVisible();
    await start.selectOption("11:00");
    await expect(page.getByText(/^11:00 시작 · /)).toBeVisible(); // 요약이 저장된 값을 그대로 보여 준다
  });

  test("1박이면 숙소 안내는 한 줄 + '숙소는 이렇게 짜요' 펼치기다 @p0307 @p0307-steps", async ({ page }) => {
    await page.goto("/plan/when");
    await pickDay(page, 21);
    await pickDay(page, 22);
    await expect(page.getByRole("radiogroup", { name: "숙소 지역" })).toBeVisible(); // 숙소는 접지 않는다
    const more = page.locator("summary", { hasText: "숙소는 이렇게 짜요" });
    await expect(more).toBeVisible();
    const sentence = page.getByText("둘째 날부터 숙소 근처에서 출발해요");
    await expect(sentence).not.toBeVisible();
    await more.click();
    await expect(sentence).toBeVisible();
  });

  test("글자 200%: 달력 숫자·누구와 타일이 잘리지 않고 문서 가로 스크롤 없음 @p0307 @p0307-steps", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "글자 확대는 휴대폰 폭에서만 본다");
    const zoom = "html{font-size:200% !important}";
    await page.goto("/plan/when");
    await page.addStyleTag({ content: zoom });
    await expect(page.getByRole("button", { name: /^2026년 11월 \d+ 일/ }).first()).toBeVisible();
    const days = await page.getByRole("button", { name: /^2026년 11월 \d+ 일/ }).evaluateAll((els) =>
      els
        .filter((el) => !(el as HTMLButtonElement).disabled)
        .map((el) => ({ t: el.textContent, w: el.scrollWidth - el.clientWidth, h: el.scrollHeight - el.clientHeight })),
    );
    expect(days.length).toBeGreaterThan(0);
    expect(days.filter((d) => d.w > 1 || d.h > 1), JSON.stringify(days)).toEqual([]);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(over).toBeLessThanOrEqual(0);

    await page.goto("/plan/who");
    await page.addStyleTag({ content: zoom });
    await expect(page.getByRole("button", { name: /휠체어 이용/ })).toBeVisible();
    const tiles = await page.locator("button[aria-pressed]").evaluateAll((els) => els.map((el) => ({ t: (el.textContent ?? "").slice(0, 8), w: el.scrollWidth - el.clientWidth })));
    expect(tiles.length).toBe(3);
    expect(tiles.filter((t) => t.w > 1), JSON.stringify(tiles)).toEqual([]);
    const overWho = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overWho).toBeLessThanOrEqual(0);
  });
});

// ---- 03-08: 입력 3·4단계 정리 ----------------------------------------------------------
/** 앞 단계를 채운 입력값을 탭 보관소에 미리 넣는다(화면 흐름 대신 3·4단계만 바로 본다) */
async function seedPlan(page: Page, patch: Record<string, unknown>) {
  await page.addInitScript((p) => {
    sessionStorage.setItem(
      "ieumgil-plan",
      JSON.stringify({ startDate: "2026-12-12", endDate: "2026-12-12", arrival: "gangneung-station", transport: "taxi", travelers: ["stroller"], categories: [], mustVisit: [], ...p }),
    );
  }, patch);
}

const MARK = 'span[aria-hidden="true"]';

test.describe("입력 3·4단계 정리", () => {
  test("3단계 유형은 글자 한 줄, 바꾸기 이름은 '여행 유형 바꾸기' @p0308", async ({ page }) => {
    await seedPlan(page, { travelers: ["stroller"] });
    await page.goto("/plan/conditions");
    const change = page.getByRole("link", { name: "여행 유형 바꾸기" });
    await expect(change).toBeVisible();
    await expect(change).toHaveAttribute("href", "/plan/who");
    const line = page.getByText(/유모차 동반/).first();
    await expect(line).toContainText(/유모차 동반.* · 바꾸기/);
    await expect(line).toHaveCSS("background-color", "rgba(0, 0, 0, 0)"); // 알약 면이 아니라 글자
  });

  test("있으면 좋아요는 켜진 개수와 함께 접혀 있다 @p0308", async ({ page }) => {
    await seedPlan(page, { travelers: ["stroller"] });
    await page.goto("/plan/conditions");
    const summary = page.locator("summary", { hasText: /있으면 좋아요 · \d+개 켜짐/ });
    await expect(summary).toBeVisible();
    const row = page.getByLabel(/수유실/);
    await expect(row).not.toBeVisible();
    await summary.click();
    await expect(row).toBeVisible();
  });

  test("4단계: 꼭 가고 싶은 곳은 접혀 있다 @p0308 @p0308-taste", async ({ page }) => {
    await seedPlan(page, { categories: ["바다·해변"] });
    await page.goto("/plan/taste");
    const summary = page.locator("summary", { hasText: "꼭 가고 싶은 곳 · 선택" });
    await expect(summary).toBeVisible();
    const browse = page.getByRole("link", { name: /관광지 둘러보고 고르기/ });
    await expect(browse).not.toBeVisible();
    await openDisclosure(summary);
    await expect(browse).toBeVisible();
  });

  test("4단계: 담은 곳이 있으면 요약에 개수, 이름 칩은 접혀도 보인다 @p0308 @p0308-taste", async ({ page }) => {
    await seedPlan(page, { categories: ["바다·해변"], mustVisit: ["DH01"] });
    await page.goto("/plan/taste");
    await expect(page.locator("summary", { hasText: "1곳 담음" })).toBeVisible();
    await expect(page.getByRole("link", { name: /관광지 둘러보고 고르기/ })).not.toBeVisible(); // 접힘
    await expect(page.getByRole("list", { name: "꼭 가고 싶은 곳" })).toBeVisible(); // 칩은 접혀도 보임
  });

  test("분야 썸네일은 또렷한 56px @p0308 @p0308-taste", async ({ page }) => {
    await seedPlan(page, {});
    await page.goto("/plan/taste");
    const img = page.locator("button[aria-pressed]").first().locator("img");
    await expect(img).toHaveCount(1);
    await expect(img).toHaveCSS("opacity", "1");
    const width = await img.evaluate((el) => (el as HTMLImageElement).getBoundingClientRect().width);
    expect(Math.round(width)).toBe(56);
    await expect(page.getByText("사진: 한국관광공사 · 공공누리 제1유형")).toBeVisible();
  });

  test("글자 200%: 분야·밀도 타일이 잘리지 않는다 @p0308 @p0308-taste", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "글자 확대는 휴대폰 폭에서만 본다");
    await seedPlan(page, {});
    await page.goto("/plan/taste");
    await page.addStyleTag({ content: "html{font-size:200% !important}" });
    const tiles = page.locator("button[aria-pressed]");
    await expect(tiles).toHaveCount(6);
    const radios = page.getByRole("radiogroup", { name: "하루에 얼마나 돌아볼까요?" }).getByRole("radio");
    await expect(radios).toHaveCount(3);
    const measure = (els: Element[]) => els.map((el) => ({ t: (el.textContent ?? "").slice(0, 8), w: el.scrollWidth - el.clientWidth, h: el.scrollHeight - el.clientHeight }));
    const cut = [...(await tiles.evaluateAll(measure)), ...(await radios.evaluateAll(measure))];
    expect(cut.filter((c) => c.w > 1 || c.h > 1), JSON.stringify(cut)).toEqual([]);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(over).toBeLessThanOrEqual(0);
  });

  test("걷는 거리 고른 칸은 ✓로도 구분된다 @p0308", async ({ page }) => {
    await seedPlan(page, { travelers: ["elder"] });
    await page.goto("/plan/conditions");
    const group = page.getByRole("radiogroup", { name: /한 번에 걸을 수 있는 거리/ });
    await group.getByRole("radio", { name: "300m" }).click();
    await expect(group.getByRole("radio", { name: "300m" }).locator(MARK, { hasText: "✓" })).toBeVisible();
    await expect(group.getByRole("radio", { name: "100m" }).locator(MARK, { hasText: "✓" })).not.toBeVisible();
  });

  test("밀도 고른 칸은 ✓로도 구분된다 @p0308 @p0308-taste", async ({ page }) => {
    await seedPlan(page, { categories: ["바다·해변"] });
    await page.goto("/plan/taste");
    const group = page.getByRole("radiogroup", { name: "하루에 얼마나 돌아볼까요?" });
    await group.getByRole("radio", { name: /^보통/ }).click();
    await expect(group.getByRole("radio", { name: /^보통/ }).locator(MARK, { hasText: "✓" })).toBeVisible();
    await expect(group.getByRole("radio", { name: /^여유롭게/ }).locator(MARK, { hasText: "✓" })).not.toBeVisible();
  });
});
