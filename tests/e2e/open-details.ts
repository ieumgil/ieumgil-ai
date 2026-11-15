// 펼치기(<details>)를 확실히 연다. 서버가 그린 화면이 hydration될 때 입력값에 따라 트리가 다시 그려지면
// 그 전에 누른 펼치기가 도로 닫힌다(클릭이 클라이언트 처리기가 붙기 전에 들어가는 경쟁). 그래서 '닫혀 있으면 누르고, 열렸는지 확인'을
// 열릴 때까지 되풀이한다. 단언을 약하게 하지 않는다: 마지막에 열려 있음을 반드시 확인한다.
import { expect, type Locator } from "@playwright/test";

export async function openDisclosure(summary: Locator) {
  const details = summary.locator("xpath=..");
  await expect(async () => {
    const open = await details.evaluate((el) => (el as HTMLDetailsElement).open);
    if (!open) await summary.click();
    await expect(details).toHaveJSProperty("open", true, { timeout: 1000 });
  }).toPass({ timeout: 10_000 });
  // 연 뒤 다시 닫히지 않는지(늦게 도는 hydration) 한 번 더 본다
  await expect(details).toHaveJSProperty("open", true);
}
