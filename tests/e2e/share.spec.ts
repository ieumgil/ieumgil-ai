// 공유 링크 화면(/s/[id]): 없는 주소·기간 지난 주소면 이유와 '내 일정 만들기'를 보여준다. 검색 엔진에 올리지 않는다.
// (저장된 일정을 실제로 여는 흐름은 서버가 Supabase를 읽어서 브라우저 쪽에서 가짜로 막을 수 없다 → 화면 값 변환은 단위 테스트 tests/share/view.test.ts)
import { expect, test } from "@playwright/test";

test("없는 공유 주소면 찾지 못했다고(또는 불러오지 못했다고) 알리고 처음 화면으로 안내한다", async ({ page }) => {
  const requested: string[] = [];
  page.on("request", (req) => requested.push(req.url()));
  await page.goto("/s/NotAReal00");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/공유 링크를 찾지 못했어요|지금은 일정을 불러오지 못했어요/);
  await expect(page.getByRole("link", { name: "이음길에서 내 일정 만들기" })).toHaveAttribute("href", "/");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  // 없는 주소 화면은 일정을 그리지 않으므로 날씨도 부르지 않는다(D-07)
  await page.waitForLoadState("networkidle");
  expect(requested.filter((u) => u.includes("/api/weather"))).toEqual([]);
});
