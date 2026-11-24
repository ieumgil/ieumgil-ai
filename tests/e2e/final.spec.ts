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
  // 날씨는 이 테스트 대상이 아님 — 실제 기상청을 부르지 않는다
  await page.route("**/api/weather", (r) => r.fulfill({ json: { available: false } }));
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
  // 지도를 못 불러오면 경로선이 없다. 맨 아래 보관 안내는 그대로 보인다(이동 시간·경로 문장은 11/24 뺐다)
  await expect(page.getByText("이 일정은 이 탭에만 보관돼요.")).toBeVisible();

  await page.getByRole("link", { name: "다른 안 보기" }).click();
  await expect(page).toHaveURL(/\/trip\/new$/);
});

test("장소를 바꾼 일정이면 확정 페이지에도 바꾼 장소가 나온다 @swap-name", async ({ page }) => {
  await setup(page, view.options[0].id);
  await page.goto("/trip/new");
  const swap = page.getByRole("button", { name: /다른 곳으로 바꾸기/ }).first();
  await swap.click();
  const sheet = page.getByRole("dialog");
  const toName = (await sheet.locator("li h3").first().textContent())!.trim();
  await sheet.getByRole("button", { name: "이곳으로 바꾸기" }).first().click();
  await page.goto("/trip/new/final");
  await expect(page.getByRole("heading", { level: 2, name: new RegExp(toName.replace(/[()]/g, "\$&")) })).toBeVisible();
});

test("확정 일정의 장소 번호 표시는 동그라미다(가로≈세로, 2rem 이상) @p0314", async ({ page }) => {
  await setup(page, view.options[0].id);
  await page.goto("/trip/new/final");
  const dots = page.locator("li > span.rounded-full.bg-primary");
  await expect(dots.first()).toBeVisible();
  const sizes = await dots.evaluateAll((els) =>
    els
      .filter((el) => (el as HTMLElement).offsetParent !== null)
      .map((el) => {
        const r = el.getBoundingClientRect();
        return { w: r.width, h: r.height };
      }),
  );
  expect(sizes.length).toBeGreaterThan(0);
  const bad = sizes.filter((s) => Math.abs(s.w - s.h) > 1 || s.w < 31.5);
  expect(bad, JSON.stringify(sizes)).toEqual([]);
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
  // 1곳뿐이면 하나 확인하면 모두 확인한 것
  const oneDone = calls > 1 ? `${calls}곳 중 1곳 확인했어요` : "모두 괜찮다고 확인했어요.";
  await page.getByRole("button", { name: "괜찮대요" }).first().click();
  await expect(page.getByText(oneDone)).toBeVisible();
  await page.reload();
  await expect(page.getByText(oneDone)).toBeVisible();
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

test("공유 링크 만들기: 고른 안만 보내고(이동시간·시각 없음) 주소와 열리는 기간을 보여준다", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await setup(page, view.options[1].id);
  let sent = "";
  await page.route("**/api/trips", (r) => {
    sent = r.request().postData() ?? "";
    return r.fulfill({ json: { id: "Ab3dE5gH9k", expiresAt: "2026-11-29T15:00:00.000Z" } });
  });
  await page.goto("/trip/new/final");
  await page.getByRole("button", { name: "공유 링크 만들기" }).click();
  const dialog = page.getByRole("dialog", { name: "일정 공유 링크" });
  await expect(dialog.getByRole("textbox", { name: "공유 주소" })).toHaveValue(/\/s\/Ab3dE5gH9k$/);
  await expect(dialog).toContainText("11월 29일까지 열려요");
  await expect(dialog).toContainText("이름·연락처는 저장하지 않아요");
  const doc = JSON.parse(sent) as { option: { id: string } };
  expect(doc.option.id).toBe(view.options[1].id);
  for (const key of ["arriveMin", "departMin", "travelMin", "createdAt"]) expect(sent).not.toContain(`"${key}"`);
  await dialog.getByRole("button", { name: "주소 복사" }).click();
  await expect(dialog.getByRole("button", { name: "복사했어요" })).toBeVisible();
});

test("공유 저장소가 준비되지 않았으면 그렇다고 알려 준다", async ({ page }) => {
  await setup(page, view.options[1].id);
  await page.route("**/api/trips", (r) => r.fulfill({ status: 503, json: { message: "공유 링크는 아직 준비 중이에요" } }));
  await page.goto("/trip/new/final");
  await page.getByRole("button", { name: "공유 링크 만들기" }).click();
  await expect(page.getByRole("dialog")).toContainText("공유 링크는 아직 준비 중이에요");
});

test("인쇄·PDF: 화면 배치 대신 한 장짜리 일정표(시간표 + 전화로 물어볼 것)만 나온다", async ({ page }) => {
  await setup(page, view.options[1].id);
  await page.goto("/trip/new/final");
  const sheet = page.locator(".print-sheet");
  await expect(sheet).toBeHidden(); // 화면에서는 숨김
  await page.emulateMedia({ media: "print" });
  await expect(sheet).toBeVisible();
  await expect(page.locator("main")).toBeHidden();
  await expect(sheet.getByRole("heading", { level: 1 })).toHaveText(view.options[1].title);
  await expect(sheet.locator("table")).toHaveCount((JSON.parse(trip) as { options: { days: unknown[] }[] }).options[1].days.length);
  await expect(sheet).toContainText("출발 전 전화로 물어볼 것");
  await expect(sheet.locator("img")).toHaveCount(0); // 사진·지도 없이
});

test.describe("확정 화면 정리", () => {
  test("꼬리표 대신 h1 아래 meta 한 줄이다 @p0306", async ({ page }) => {
    await setup(page, view.options[0].id);
    await page.goto("/trip/new/final");
    const tag = page.getByText("확정한 일정", { exact: true });
    await expect(tag).toBeVisible();
    const meta = tag.locator("xpath=..");
    await expect(meta).toContainText("1박 2일");
    await expect(meta).toContainText("6곳");
    const h1 = page.getByRole("heading", { level: 1 });
    const s = await h1.evaluate((el) => {
      const c = getComputedStyle(el);
      return { family: c.fontFamily.replace(/["']/g, ""), size: c.fontSize };
    });
    expect(s.family.toLowerCase().startsWith("pretendard")).toBe(true);
    expect(s.size).toBe("28px");
    // 머리 meta는 h1 아래에 있다(위 꼬리표 줄 없음)
    const order = await page.evaluate(() => {
      const h = document.querySelector("main h1")!;
      const t = [...document.querySelectorAll("main span")].find((e) => e.textContent === "확정한 일정")!;
      return !!(h.compareDocumentPosition(t) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    expect(order).toBe(true);
  });

  test("h1 아래 첫 줄은 날짜(20px 500, 화살표), 다음 줄은 16px 기간·곳 수·확정 표시다 @p0314", async ({ page }) => {
    await setup(page, view.options[0].id);
    await page.goto("/trip/new/final");
    const tag = page.getByText("확정한 일정", { exact: true });
    const meta = tag.locator("xpath=..");
    const dates = page.getByText(/^\d+월 \d+일\(.\) → /);
    await expect(dates).toBeVisible();
    await expect(dates).toHaveText(/^\d+월 \d+일\([월화수목금토일]\) → (\d+월 )?\d+일\([월화수목금토일]\)$/);
    const ds = await dates.evaluate((el) => ({ size: getComputedStyle(el).fontSize, weight: getComputedStyle(el).fontWeight }));
    expect(ds).toEqual({ size: "20px", weight: "500" });
    const ms = await meta.evaluate((el) => getComputedStyle(el).fontSize);
    expect(ms).toBe("16px");
    await expect(meta).toContainText("1박 2일 · 6곳");
    // 날짜 줄은 h1 아래, 기간 줄은 날짜 줄 아래
    const order = await page.evaluate(() => {
      const h = document.querySelector("main h1")!;
      const d = [...document.querySelectorAll("main p")].find((e) => /→/.test(e.textContent ?? ""))!;
      const m = [...document.querySelectorAll("main span")].find((e) => e.textContent === "확정한 일정")!.parentElement!;
      return !!(h.compareDocumentPosition(d) & Node.DOCUMENT_POSITION_FOLLOWING) && !!(d.compareDocumentPosition(m) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    expect(order).toBe(true);
  });

  test("지도는 작게(240px) 시작하고, 지도를 못 불러오면 '전체 화면' 버튼도 없다 @p0306", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "PC는 왼쪽 고정 지도");
    await setup(page, view.options[0].id);
    await page.goto("/trip/new/final");
    const map = page.getByRole("note").filter({ hasText: "지도를 불러오지 못했어요" });
    await expect(map).toBeVisible();
    expect(Math.abs((await map.evaluate((el) => el.getBoundingClientRect().height)) - 240)).toBeLessThanOrEqual(2);
    await expect(page.getByRole("button", { name: "전체 화면" })).toHaveCount(0);
  });

  test("가서 볼 것은 하루에 한 번, 공통 줄로 보인다 @p0306", async ({ page }) => {
    await setup(page, view.options[0].id);
    await page.goto("/trip/new/final");
    const day = page.locator('section[id^="day-"]').filter({ visible: true });
    await expect(day.getByText("가서 보고 확인할 것 · 공통")).toBeVisible();
    await expect(day.getByText(/^바닥: /)).toHaveCount(1);
    await expect(day.getByText(/^바닥: /)).toContainText("1·2·3번 장소");
  });

  test("장소 줄은 카드 없이 구분선이고 전화는 글자 링크다 @p0306", async ({ page }) => {
    await setup(page, view.options[0].id);
    await page.goto("/trip/new/final");
    const row = page.locator('li[id^="stop-"]').filter({ visible: true }).first();
    await expect(row).toBeVisible();
    const s = await row.evaluate((el) => {
      const c = getComputedStyle(el);
      return { shadow: c.boxShadow, bg: c.backgroundColor };
    });
    expect(s.shadow).toBe("none");
    expect(s.bg).toBe("rgba(0, 0, 0, 0)");
    const tel = row.locator('a[href^="tel:"]');
    const t = await tel.evaluate((el) => ({ h: el.getBoundingClientRect().height, border: getComputedStyle(el).borderTopWidth }));
    expect(t.h).toBeGreaterThanOrEqual(44);
    expect(t.border).toBe("0px");
    expect(await tel.locator("wbr").count()).toBeGreaterThanOrEqual(1);
  });

  test("날짜 탭은 밑줄형이고 고른 날은 솔숲 초록이다 @p0306", async ({ page }) => {
    await setup(page, view.options[0].id);
    await page.goto("/trip/new/final");
    await expect(page.getByRole("tablist")).toHaveAttribute("data-variant", "line");
    const color = await page.getByRole("tab", { selected: true }).evaluate((el) => getComputedStyle(el).color);
    expect(color).toBe("rgb(61, 170, 126)");
  });

  // 11/24: 이동 시간·경로 문장은 뺐다(지도 아래 '일반 차량 경로 · …'가 원칙 6을 맡는다). 출처와 보관 안내는 접지 않고 늘 보인다
  test("맨 아래 안내(보관 안내)는 접지 않고 늘 보이고, 뺀 이동 시간 문장은 없다 @p0306", async ({ page }) => {
    await setup(page, view.options[0].id);
    await page.goto("/trip/new/final");
    await expect(page.getByText("이 일정은 이 탭에만 보관돼요.")).toBeVisible();
    // 인쇄용 일정표(화면에서는 숨김)에는 종이라 출처 문장이 남는다 → 화면에 보이는 것만 센다
    await expect(page.getByText(/휠체어 안전 경로를 뜻하지 않아요/).filter({ visible: true })).toHaveCount(0);
    await expect(page.getByText(/일정의 이동 시간은 카카오 차량 길찾기 값/).filter({ visible: true })).toHaveCount(0);
  });
});

test.describe("체크리스트", () => {
  const list = (page: Page) => page.locator("section[aria-labelledby='checklist-title']");

  test("장소 행은 카드 없이 구분선이다 @p0306-check", async ({ page }) => {
    await setup(page, view.options[1].id);
    await page.goto("/trip/new/final");
    const row = list(page).locator("li").first();
    await expect(row).toBeVisible();
    const s = await row.evaluate((el) => {
      const c = getComputedStyle(el);
      return { shadow: c.boxShadow, bg: c.backgroundColor };
    });
    expect(s.shadow).toBe("none");
    expect(s.bg).toBe("rgba(0, 0, 0, 0)");
  });

  test("결과는 한 테두리 안 두 칸이다 @p0306-check", async ({ page }) => {
    await setup(page, view.options[1].id);
    await page.goto("/trip/new/final");
    const group = page.getByRole("group", { name: /전화 결과/ }).first();
    await expect(group).toBeVisible();
    const name = ((await group.getAttribute("aria-label")) ?? "").replace(/ 전화 결과$/, "");
    const buttons = group.getByRole("button");
    await expect(buttons).toHaveCount(2);
    // 1.5px로 그리지만 화면 배율 1배에서는 브라우저가 1px로 맞춘다 → 한 테두리(컨트롤 회색 실선)가 두 칸을 감싸면 된다
    const border = await group.evaluate((el) => {
      const c = getComputedStyle(el);
      return { w: parseFloat(c.borderTopWidth), style: c.borderTopStyle, color: c.borderTopColor };
    });
    expect(border.w).toBeGreaterThanOrEqual(1);
    expect(border.w).toBeLessThanOrEqual(1.5);
    expect(border.style).toBe("solid");
    expect(border.color).toBe("rgb(139, 149, 161)");
    for (const b of await buttons.all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    const ok = group.getByRole("button", { name: `${name} 괜찮대요` });
    const hard = group.getByRole("button", { name: `${name} 어렵대요` });
    await expect(ok).toContainText("괜찮대요");
    await expect(hard).toContainText("어렵대요");
    await ok.click();
    await expect(ok).toHaveAttribute("aria-pressed", "true");
    expect(await ok.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(235, 243, 252)");
    await hard.click();
    await expect(hard).toHaveAttribute("aria-pressed", "true");
    expect(await hard.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgb(255, 244, 229)");
  });

  test("체크리스트 전화는 글자 링크다 @p0306-check", async ({ page }) => {
    await setup(page, view.options[1].id);
    await page.goto("/trip/new/final");
    const tel = list(page).locator("li").first().locator('a[href^="tel:"]');
    await expect(tel).toBeVisible();
    const t = await tel.evaluate((el) => ({ h: el.getBoundingClientRect().height, border: getComputedStyle(el).borderTopWidth }));
    expect(t.border).toBe("0px");
    expect(t.h).toBeGreaterThanOrEqual(44);
  });

  test("제목은 제목 글꼴(Pretendard) 20px이다 @p0306-check", async ({ page }) => {
    await setup(page, view.options[1].id);
    await page.goto("/trip/new/final");
    const s = await page.locator("#checklist-title").evaluate((el) => {
      const c = getComputedStyle(el);
      return { family: c.fontFamily.replace(/["']/g, ""), size: c.fontSize };
    });
    expect(s.family.toLowerCase().startsWith("pretendard")).toBe(true);
    expect(s.size).toBe("20px");
  });
});
