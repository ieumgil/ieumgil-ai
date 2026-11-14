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
  const photo = page.locator("article").first().getByRole("button", { name: /사진 \d+장 크게 보기/ });
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
  const photo = page.locator("article").first().getByRole("button", { name: /사진 \d+장 크게 보기/ });
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
  const btn = page.getByRole("button", { name: /^지도에서 1번 / }).first();
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
