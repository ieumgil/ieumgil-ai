// 결과 화면: 저장해 둔 실제 AI 결과(tests/e2e/fixtures/trip-view.json)로 확인한다(LLM 호출 없음).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

const trip = readFileSync(resolve(__dirname, "fixtures/trip-view.json"), "utf8");
const view = JSON.parse(trip) as { options: { id: string; title: string }[] };

test.beforeEach(async ({ page }) => {
  // 안 비교 화면에도 지도가 있다: 카카오 지도 SDK·경로선은 가짜로 막는다(외부 호출 없음)
  await page.route("https://dapi.kakao.com/**", (r) => r.abort());
  await page.route("**/api/route-line", (r) => r.fulfill({ json: { days: [null] } }));
  await page.route("**/api/legs", (r) => r.fulfill({ json: { days: [] } })); // 실제 이동시간 없음 → 추정 그대로
  // 관광공사 원본 사진(3유형·크게 보기)도 막는다 → 못 불러오면 분류 아이콘. 1유형 작은 사진은 저장소 파일(/photos)
  await page.route("https://tong.visitkorea.or.kr/**", (r) => r.abort());
  await page.addInitScript((t) => sessionStorage.setItem("ieumgil-trip", t), trip);
  await page.goto("/trip/new");
});

test("장소 카드에 사진이 있고, 누르면 크게 보기에 출처(공공누리)가 나온다", async ({ page }) => {
  const photo = page.locator("article").first().getByRole("button", { name: /사진 \d+ 장 크게 보기/ });
  await expect(photo).toBeVisible();
  await expect(photo.locator("img")).toHaveAttribute("src", /^\/photos\/.+\.webp$/); // 1유형은 미리 줄여 둔 작은 사진
  await photo.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: /사진$/ })).toBeVisible();
  await expect(dialog.getByText(/사진: 한국관광공사 · 공공누리 제[13]유형/)).toBeVisible();
  await dialog.getByRole("button", { name: "다음 사진" }).click();
  await expect(dialog.getByText(/^2 \/ \d+$/)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("크게 보기 사진은 밀어서·마우스 휠로 넘기고, 번호가 따라 바뀐다", async ({ page }) => {
  const photo = page.locator("article").first().getByRole("button", { name: /사진 \d+ 장 크게 보기/ });
  await expect(photo.getByText(/^\d+$/)).toBeVisible(); // 누를 수 있다는 표시(돋보기 + 장수)
  await photo.click();
  const dialog = page.getByRole("dialog");
  const track = dialog.getByRole("list");
  // 손가락으로 민 것처럼 옆으로 스크롤 → 번호와 이전 버튼이 따라온다
  await track.evaluate((el) => el.scrollTo({ left: el.clientWidth }));
  await expect(dialog.getByText(/^2 \/ \d+$/)).toBeVisible();
  await expect(dialog.getByRole("button", { name: "이전 사진" })).toBeEnabled();
  // 마우스 휠(위아래)로도 한 장씩
  const box = (await track.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, 120);
  await expect(dialog.getByText(/^3 \/ \d+$/)).toBeVisible();
});

test("안을 바꾸면 그 안의 일정이 보인다", async ({ page }) => {
  await expect(page.getByRole("heading", { level: 1 })).toContainText(`일정 ${view.options.length}가지`);
  const second = view.options[1];
  await page.getByRole("radio").nth(1).click();
  await expect(page.getByRole("radio").nth(1)).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("heading", { level: 2, name: second.title })).toBeVisible();
});

test("장소 카드는 핵심만 보이고, [자세히]를 누르면 판단 이유·확인할 것이 펼쳐진다", async ({ page }) => {
  const more = page.getByRole("button", { name: /자세히/ }).first();
  await expect(more).toHaveAttribute("aria-expanded", "false");
  await more.click();
  await expect(more).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText(/근거: 한국관광공사 무장애 여행정보/).first()).toBeVisible();
});

test("장소 카드를 펼치면 공중화장실 공공데이터 값과 출처가 보이고, 접힌 카드에는 출처 문구가 없다", async ({ page }) => {
  // 저장해 둔 결과의 대도호부 관아(GN05)를 지금 places.json 값(공공데이터 장애인 화장실)으로 바꾸고, 근거에 공공데이터를 더해 다시 연다
  const t = JSON.parse(trip);
  const places = JSON.parse(readFileSync(resolve(__dirname, "../../data/places.json"), "utf8"));
  t.placeData.GN05 = (Array.isArray(places) ? places : places.places).find((p: { id: string }) => p.id === "GN05");
  t.judgments.GN05.evidence = [...t.judgments.GN05.evidence, { id: "public-화장실-1", label: "공공데이터·공중화장실" }];
  await page.addInitScript((v) => sessionStorage.setItem("ieumgil-trip", v), JSON.stringify(t));
  await page.reload();
  const card = page.locator("article:visible").filter({ hasText: t.places.GN05.name }).first();
  await expect(card).toBeVisible();
  await expect(card).not.toContainText("공공데이터"); // 접힌 상태
  await card.getByRole("button", { name: /자세히/ }).click();
  await expect(card.getByText("공공데이터로 확인한 것")).toBeVisible();
  await expect(card.getByText(/장애인 칸 2/)).toBeVisible();
  await expect(card.getByText("공공데이터(2024-12 기준)")).toBeVisible();
  await expect(card.getByText("근거: 한국관광공사 무장애 여행정보", { exact: false })).toContainText("행정안전부 공중화장실 정보(공공데이터)");
});

test("'이 일정으로 정하기'를 누르면 확인할 것 모음이 열리고, 정한 상태가 남는다", async ({ page }) => {
  await page.getByRole("button", { name: /일정으로 정하기/ }).last().click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toContainText("정했어요");
  await expect(sheet).toContainText(/출발 전 전화로 확인할 곳 \d+곳/);
  await expect(sheet.getByRole("link", { name: "확정 일정 보기" })).toHaveAttribute("href", "/trip/new/final");
  await sheet.getByRole("button", { name: "닫기" }).last().click();
  await expect(page.getByRole("link", { name: /정한 일정/ }).last()).toBeVisible();
  await page.reload();
  await expect(page.getByRole("link", { name: /정한 일정/ }).last()).toHaveAttribute("href", "/trip/new/final");
});

test("[바꾸기]로 근처 후보로 바꾸면 시각을 다시 계산해 보여주고, 원래대로 되돌릴 수 있다", async ({ page }) => {
  await expect(page.getByRole("link", { name: "조건 바꿔 다시 만들기" })).toHaveCount(0);
  const swap = page.getByRole("button", { name: /다른 곳으로 바꾸기/ }).first();
  const fromName = ((await swap.getAttribute("aria-label")) ?? "").replace(/ 다른 곳으로 바꾸기$/, "");
  await swap.click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toContainText(`${fromName} 대신 갈 곳`);
  const toName = (await sheet.locator("li p.text-lg").first().textContent())!.trim();
  await sheet.getByRole("button", { name: "이곳으로 바꾸기" }).first().click();
  await expect(sheet).toBeHidden();

  const card = page.getByRole("heading", { level: 3, name: new RegExp(toName.replace(/[()]/g, "\\$&")) }).first();
  await expect(card).toBeVisible();
  await expect(page.getByText(`바꾼 장소 · 원래 ${fromName}`).first()).toBeVisible();

  await page.reload(); // 바꾼 일정은 이 탭에 남는다
  await expect(page.getByText(`바꾼 장소 · 원래 ${fromName}`).first()).toBeVisible();

  await page.getByRole("button", { name: `${toName} 다른 곳으로 바꾸기` }).first().click();
  await page.getByRole("dialog").getByRole("button", { name: "원래 장소로 되돌리기" }).click();
  await expect(page.getByText(/바꾼 장소 · 원래/)).toHaveCount(0);
});

test("결과 화면도 누를 수 있는 요소는 높이 44px 이상", async ({ page }) => {
  await page.waitForLoadState("networkidle");
  const small = await page.locator("main a, main button, main summary").evaluateAll((els) =>
    els
      .filter((el) => (el as HTMLElement).offsetParent !== null)
      .map((el) => ({ text: (el.textContent ?? "").trim().slice(0, 20), h: el.getBoundingClientRect().height }))
      .filter((r) => r.h < 43.5), // 소수점 반올림 오차 허용
  );
  expect(small, JSON.stringify(small)).toEqual([]);
});

test("적합이어도 전화로 물어볼 것이 있으면 칩에 함께 적고, 안을 바꾸면 그 안이라고 알려준다", async ({ page }) => {
  // A안 2일째의 GN98은 엘리베이터가 '모름'(전화로 물을 것) → 적합이어도 함께 적는다
  await page.getByRole("tab", { name: /2일째/ }).click();
  await expect(page.getByText(/적합 · 전화로 확인할 것 있음/).filter({ visible: true }).first()).toBeVisible();
  const other = page.getByRole("radio").nth(0);
  const id = (await other.textContent())!.trim().charAt(0);
  if ((await other.getAttribute("aria-checked")) !== "true") {
    await other.click();
    await expect(page.getByRole("status").first()).toContainText(`${id}안 일정을 보여 드려요`);
  }
  await expect(page.getByRole("button", { name: `${id}안 일정으로 정하기` }).last()).toBeVisible();
});

test("버튼 모양 링크도 키보드 포커스 테두리가 보인다", async ({ page }) => {
  await page.getByRole("button", { name: /일정으로 정하기/ }).last().click();
  const link = page.getByRole("dialog").getByRole("link", { name: "확정 일정 보기" });
  await link.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  const style = await link.evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(style).not.toBe("none");
});

test("열면 카카오 실제 이동시간을 받아 시각을 다시 계산하고 '추정'을 뗀다(탭에는 저장 안 함)", async ({ page }) => {
  const asked: string[] = [];
  await page.route("**/api/legs", (r) => {
    const body = JSON.parse(r.request().postData() ?? "{}") as { days: { points: unknown[] }[] };
    asked.push(r.request().postData() ?? "");
    return r.fulfill({ json: { days: body.days.map((d) => d.points.slice(1).map(() => ({ minutes: 7, km: 2.5 }))) } });
  });
  await page.reload();
  const detail = page.locator("section[aria-label$='일정']").first();
  await expect(detail.getByText("차량 약 7분 · 2.5km").first()).toBeVisible();
  await expect(detail.getByText(/· 추정$/)).toHaveCount(0);
  await expect(page.getByText("열 때마다 새로 받아요")).toBeVisible();
  expect(asked.length).toBeGreaterThan(0);
  const stored = await page.evaluate(() => JSON.stringify(sessionStorage));
  expect(stored).not.toContain('"km":2.5');
});

test("장소 카드의 번호는 '지도에서 보기' 버튼이다(누를 수 있고 44px 이상)", async ({ page }) => {
  const btn = page.getByRole("button", { name: /^1 .* 지도에서 보기$/ }).first();
  await expect(btn).toBeVisible();
  const box = (await btn.boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(44);
  await btn.click(); // 시험 환경은 카카오 지도가 없어 안내 문구가 나오지만, 눌러도 오류 없이 그대로
  await expect(page.locator("article").first()).toBeVisible();
});

test("노면만 모르는 곳은 전화 질문이 아니라 '가서 보고 확인할 것'으로 보여준다", async ({ page }) => {
  // 첫 장소(GN12)는 노면만 '모름' → 칩은 그냥 '적합', 자세히에 바닥 안내
  const card = page.locator("article").first();
  await expect(card).toContainText("적합");
  await expect(card).not.toContainText("전화로 확인할 것 있음");
  await card.getByRole("button", { name: /자세히/ }).click();
  await expect(card.getByText("가서 보고 확인할 것")).toBeVisible();
  await expect(card.getByText(/^바닥: /)).toBeVisible();
  await expect(card.getByText("전화로 물어볼 것")).toHaveCount(0);
  await expect(page.getByText(/노면 .*재질/)).toHaveCount(0);
});

test("이번 조건으로 가기 어려운 곳: 이유(✕)와 대신 갈 만한 가까운 곳을 정보로 보여준다", async ({ page }) => {
  // 저장해 둔 결과에 어려운 곳 하나를 넣어 다시 연다(강문해변 → 대안 경포해수욕장)
  const t = JSON.parse(trip);
  const places = JSON.parse(readFileSync(resolve(__dirname, "../../data/places.json"), "utf8"));
  const gn27 = (Array.isArray(places) ? places : places.places).find((p: { id: string }) => p.id === "GN27");
  t.places.GN27 = { id: "GN27", name: gn27.name_ko, category: gn27.category, region: gn27.region, phone: gn27.phone, address: gn27.address };
  t.placeData.GN27 = gn27;
  t.hard = [{ placeId: "GN27", kind: "조건", reasons: ["장애인 화장실: 어려워요"], mustVisit: false, altId: "GN33" }];
  await page.addInitScript((v) => sessionStorage.setItem("ieumgil-trip", v), JSON.stringify(t));
  await page.reload();
  const box = page.getByText(/이번 조건으로 가기 어려운 곳 1곳/);
  await box.click();
  const item = page.locator("details li").filter({ hasText: "강문해변" }).first();
  await expect(item).toContainText("꼭 필요한 조건이 맞지 않아요");
  await expect(item).toContainText("장애인 화장실: 어려워요");
  await expect(item).toContainText("대신 갈 만한 곳: 경포해수욕장");
  await expect(item.getByRole("button", { name: /바꾸기|넣기|추가/ })).toHaveCount(0); // 정보만(사진 크게 보기만 누를 수 있음)
});

test("[순서 고치기]로 위·아래로 옮기고 빼면 시각을 다시 계산하고, [처음 일정으로] 되돌린다", async ({ page }) => {
  const names = async () => (await page.locator("article:visible h3").allTextContents()).map((t) => t.replace(/^\d+번째 장소: /, "").trim());
  await expect(page.locator("article:visible").first()).toBeVisible();
  const before = await names();
  await page.getByRole("button", { name: "순서 고치기" }).first().click();
  const panel = page.getByRole("region", { name: /1일째 순서 고치기/ });
  await expect(panel).toBeVisible();
  // 첫 장소는 위로 옮길 수 없다
  await expect(panel.getByRole("button", { name: `${before[0]} 위로 옮기기` })).toBeDisabled();
  await panel.getByRole("button", { name: `${before[0]} 아래로 옮기기` }).click();
  await expect(panel).toContainText("시각을 다시 계산했어요");
  await expect.poll(names).toEqual([before[1], before[0], ...before.slice(2)]);
  // 누를 수 있는 것은 44px 이상
  for (const b of await panel.getByRole("button").all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await panel.getByRole("button", { name: `${before[0]} 일정에서 빼기` }).click();
  await expect.poll(names).not.toContain(before[0]);
  // 새로고침해도 고친 일정이 남는다(이 탭에만)
  await page.reload();
  await expect.poll(names).not.toContain(before[0]);
  await page.getByRole("button", { name: "순서 고치기" }).first().click();
  await page.getByRole("button", { name: "처음 일정으로" }).click();
  await expect.poll(names).toEqual(before);
  await page.getByRole("button", { name: "다 고쳤어요" }).click();
  await expect(page.getByRole("region", { name: /순서 고치기/ })).toHaveCount(0);
});

// ---- 안 비교 첫 화면(03-03): 꼬리표·알약·아이콘·유리 효과 없이 한눈에 비교 ----
test.describe("안 비교 첫 화면", () => {
  test("꼬리표 없이 h1 + 한 줄 조건만 보인다 @p0303", async ({ page }) => {
    await expect(page.getByText("AI 추천 일정", { exact: true })).toHaveCount(0);
    const meta = page.getByText(/^AI 추천 · /);
    await expect(meta).toBeVisible();
    for (const word of ["1박 2일", "휠체어", "택시", "숙소 강릉"]) await expect(meta).toContainText(word);
    await expect(page.getByRole("list", { name: "여행 조건" })).toHaveCount(0); // 알약 목록 없음
  });

  test("안 카드는 아이콘 없는 네 줄이다 @p0303 @p0303-card", async ({ page }) => {
    const radios = page.getByRole("radio");
    await expect(radios).toHaveCount(view.options.length);
    for (const radio of await radios.all()) {
      await expect(radio.locator("svg")).toHaveCount(0);
      await expect(radio).toHaveText(/\d+곳 · 이동 약 \d+분 · (! 전화 확인 [1-9]\d*곳|전화 확인 0곳)/);
    }
    await expect(radios.first()).toHaveText(/^A안/);
  });

  test("고른 안은 2px primary 테두리, 안 고른 안은 1.5px 회색 윤곽이다 @p0303 @p0303-card", async ({ page }) => {
    const css = (loc: ReturnType<typeof page.getByRole>) =>
      loc.evaluate((el) => {
        const s = getComputedStyle(el);
        return { w: s.borderTopWidth, c: s.borderTopColor, bg: s.backgroundColor };
      });
    const on = page.locator("[role=radio][aria-checked=true]");
    const off = page.locator("[role=radio][aria-checked=false]").first();
    expect(await css(on)).toEqual({ w: "2px", c: "rgb(30, 111, 208)", bg: "rgb(234, 242, 253)" });
    // 1.5px로 그리지만 화면 배율 1배에서는 브라우저가 1px로 맞춘다 → 고른 안(2px)보다 얇은 윤곽이면 된다
    const offStyle = await css(off);
    expect(parseFloat(offStyle.w)).toBeGreaterThanOrEqual(1);
    expect(parseFloat(offStyle.w)).toBeLessThan(2);
    expect({ c: offStyle.c, bg: offStyle.bg }).toEqual({ c: "rgb(139, 149, 161)", bg: "rgb(255, 255, 255)" });
  });

  test("390x844: 두 안이 아래 확정 바 위에 모두 보인다 @p0303 @p0303-card", async ({ page }, info) => {
    test.skip(info.project.name !== "mobile", "아래 고정 바는 휴대폰 폭에서만");
    const bar = (await page.locator("[data-bottom-bar]").boundingBox())!;
    for (const radio of await page.getByRole("radio").all()) {
      const box = (await radio.boundingBox())!;
      expect(box.y + box.height, `카드 아래 끝 ${box.y + box.height} / 확정 바 위 ${bar.y}`).toBeLessThanOrEqual(bar.y);
    }
  });

  test("아래 확정 바는 불투명 흰 바탕 + 위쪽 그림자이다 @p0303", async ({ page }, info) => {
    test.skip(info.project.name !== "mobile", "아래 고정 바는 휴대폰 폭에서만");
    const style = await page.locator("[data-bottom-bar]").evaluate((el) => {
      const s = getComputedStyle(el);
      return { bg: s.backgroundColor, backdrop: s.backdropFilter, shadow: s.boxShadow };
    });
    expect(style.bg).toBe("rgb(255, 255, 255)");
    expect(style.backdrop).toBe("none");
    expect(style.shadow).not.toBe("none");
  });
});

// ---- 장소 카드(03-04): S2 한 겹, 접힌 상태에도 원칙 문구가 남고, 이름·번호는 잘리지 않는다 ----
test.describe("장소 카드", () => {
  const day1 = (view as unknown as { options: { days: { items: { kind: string; placeId?: string }[] }[] }[] }).options[0].days[0].items;
  const unknowns = (view as unknown as { unknowns: Record<string, string[]> }).unknowns;
  const withUnknown = day1.filter((i) => i.kind === "visit" && (unknowns[i.placeId!] ?? []).length > 0).map((i) => i.placeId!);

  test("접힌 카드에 판정·모름 한 줄·전화·바꾸기가 보인다 @p0304", async ({ page }) => {
    expect(withUnknown.length).toBeGreaterThan(0);
    for (const id of withUnknown) await expect(page.locator(`#stop-${id}`).getByText(/공식 정보 없음:/)).toBeVisible();
    const cards = page.locator("article:visible");
    expect(await cards.count()).toBeGreaterThan(0);
    for (const card of await cards.all()) {
      await expect(card.getByRole("link", { name: /공식 전화 .* 걸기/ })).toBeVisible();
      await expect(card.getByRole("button", { name: /다른 곳으로 바꾸기/ })).toBeVisible();
    }
  });

  test("펼침 줄 이름은 '자세히' 또는 '자세히 · 물어볼 것 N'이고 장소 이름을 가리킨다 @p0304", async ({ page }) => {
    const buttons = page.locator("article:visible button[aria-controls^='place-']");
    const names: string[] = [];
    // 1일째에는 물어볼 것이 하나도 없으므로(공통 질문은 따로 모음) 2일째도 함께 본다
    for (const tab of [null, /2일째/]) {
      if (tab) await page.getByRole("tab", { name: tab }).click();
      for (const b of await buttons.all()) {
        const name = (await b.evaluate((el) => (el.textContent ?? "").replace(/\s+/g, " ").trim())) as string;
        expect(name).toMatch(/^자세히( · 물어볼 것 \d+)?$/);
        names.push(name);
        const target = await b.getAttribute("aria-describedby");
        expect(target).toBeTruthy();
        await expect(b.locator("xpath=ancestor::article").locator(`h3[id='${target}']`)).toHaveCount(1);
      }
    }
    expect(names.some((n) => n.includes("물어볼 것"))).toBe(true);
    const style = await buttons.first().evaluate((el) => {
      const s = getComputedStyle(el);
      return { bg: s.backgroundColor, top: s.borderTopWidth, h: el.getBoundingClientRect().height };
    });
    expect(style.bg).toBe("rgba(0, 0, 0, 0)");
    expect(style.top).toBe("1px");
    expect(style.h).toBeGreaterThanOrEqual(44);
  });

  test("카드는 그림자 없는 한 겹이다 @p0304", async ({ page }) => {
    const s = await page.locator("article:visible").first().evaluate((el) => {
      const c = getComputedStyle(el);
      return { shadow: c.boxShadow, top: c.borderTopWidth };
    });
    expect(s).toEqual({ shadow: "none", top: "1px" });
  });

  test("이름은 20px 700 sans이다 @p0304", async ({ page }) => {
    const s = await page.locator("article:visible h3").first().evaluate((el) => {
      const c = getComputedStyle(el);
      return { size: c.fontSize, weight: c.fontWeight, family: c.fontFamily };
    });
    expect(s.size).toBe("20px");
    expect(s.weight).toBe("700");
    expect(s.family.startsWith("Gowun")).toBe(false);
  });

  test("펼치면 지역·분류가 솔숲 초록 meta로 맨 위에 온다 @p0304 @p0304-open", async ({ page }) => {
    const more = page.locator("article:visible button[aria-controls^='place-']").first();
    await more.click();
    const panel = page.locator(`[id='${await more.getAttribute("aria-controls")}']`);
    await expect(panel).toBeVisible();
    const first = panel.locator("> *").first();
    await expect(first).toContainText(" · ");
    expect(await first.evaluate((el) => getComputedStyle(el).color)).toBe("rgb(42, 106, 80)");
  });

  test("전화번호는 하이픈 뒤에서만 줄바꿈된다 @p0304", async ({ page }) => {
    const tel = page.locator("article:visible").first().locator("a[href^='tel:']");
    expect(await tel.evaluate((el) => el.querySelectorAll("wbr").length)).toBeGreaterThan(0);
    await expect(tel).toHaveText(/^전화 \d{2,3}-\d{3,4}-\d{4}$/); // 글자는 그대로(wbr은 글자가 아님)
  });

  test("320px·글자 150%: 이름이 카드 밖으로 넘치지 않는다 @p0304", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 740 });
    await page.addStyleTag({ content: "html{font-size:150% !important}" });
    await expect(page.locator("article:visible").first()).toBeVisible();
    const over = await page.locator("article:visible h3").evaluateAll((els) =>
      els.map((el) => ({ t: (el.textContent ?? "").trim(), sw: el.scrollWidth, cw: el.clientWidth })).filter((r) => r.sw > r.cw + 1),
    );
    expect(over, JSON.stringify(over)).toEqual([]);
  });

  test("글자 200%: 번호 숫자가 잘리지 않는다 @p0304", async ({ page }) => {
    await page.addStyleTag({ content: "html{font-size:200% !important}" });
    const buttons = page.getByRole("button", { name: /지도에서 보기$/ });
    await expect(buttons.first()).toBeVisible();
    const bad = await buttons.evaluateAll((els) =>
      els
        .filter((el) => (el as HTMLElement).offsetParent !== null)
        .map((el) => {
          const circle = el.querySelector("span") as HTMLElement;
          return { sw: circle.scrollWidth, cw: circle.clientWidth, sh: circle.scrollHeight, ch: circle.clientHeight, h: el.getBoundingClientRect().height };
        })
        .filter((r) => r.sw > r.cw + 1 || r.sh > r.ch + 1 || r.h < 44),
    );
    expect(bad, JSON.stringify(bad)).toEqual([]);
  });
});

test("AI 설계 과정 보기는 44px 펼치기 줄이고, 누르면 과정이 보이며, 안전 안내 문장은 펼치기 전에도 보인다", async ({ page }) => {
  const summary = page.locator("summary", { hasText: "AI 설계 과정 보기" });
  await summary.scrollIntoViewIfNeeded();
  await expect(summary).toBeVisible();
  expect((await summary.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  // 원칙 6: 일반 차량 경로 안내는 접힌 상태에서도 보인다
  await expect(page.getByText("휠체어 안전 경로를 뜻하지 않아요")).toBeVisible();
  await expect(page.getByText(/이동 시간은 카카오 일반 차량 길찾기 값/)).toBeVisible(); // 실제 이동시간을 못 받은 상태(추정 안내)
  const calls = page.getByText(/AI 호출 \d+회/);
  await expect(calls).toBeHidden();
  await summary.click();
  await expect(calls).toBeVisible();
});
