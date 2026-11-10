import { defineConfig, devices } from "@playwright/test";

// 실제 브라우저로 화면 흐름을 검사한다(E2E). 단위 테스트(vitest)는 tests/, 브라우저 테스트는 e2e/.
// 로컬: 이미 켜 둔 `npm run dev`가 있으면 그대로 쓰고, 없으면 새로 켠다.
// CI: `npm run build` 뒤에 `npm run start`로 배포용 빌드를 검사한다.
const PORT = 3000;
const isCI = !!process.env.CI;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
    trace: "on-first-retry",
  },
  projects: [
    // 시안 기준: 모바일 390px, PC 1440px
    { name: "mobile", use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 }, hasTouch: true } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: isCI ? "npm run start" : "npm run dev",
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
});
