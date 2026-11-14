// IN-01: 라우트의 예기치 않은 오류는 말없이 삼키지 않고 한 줄만 남긴다(오류 이름·코드뿐, 키·URL·메시지·스택 없음).
// 사용자 화면은 그대로 200 { available: false }, no-store (D-05).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("next/cache", () => ({ cacheLife: () => {} }));
const build = vi.fn();
vi.mock("../../src/lib/weather/service", () => ({ buildWeatherPayload: (...a: unknown[]) => build(...a), cachedDeps: {} }));

import { GET } from "../../src/app/api/weather/route";
import { KmaError } from "../../src/lib/weather/kma";

const KEY = "test-key/abc+==";
const req = () => new Request("http://localhost/api/weather");

beforeEach(() => vi.stubEnv("KMA_API_KEY", KEY));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  build.mockReset();
});

const warnText = (spy: ReturnType<typeof vi.spyOn>) => spy.mock.calls.map((c: unknown[]) => c.map(String).join(" "));

describe("GET /api/weather: 예기치 않은 오류", () => {
  it("[weather] 한 줄 경고에 오류 이름만 남고, 메시지의 키·URL은 나가지 않는다", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    build.mockRejectedValue(new TypeError(`bad https://apis.data.go.kr/x?serviceKey=${encodeURIComponent(KEY)} ${KEY}`));
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ available: false });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const lines = warnText(warn);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("[weather]");
    expect(lines[0]).toContain("TypeError");
    expect(lines[0]).not.toContain(KEY);
    expect(lines[0]).not.toContain(encodeURIComponent(KEY));
    expect(lines[0].toLowerCase()).not.toContain("servicekey");
    expect(lines[0]).not.toContain("apis.data.go.kr");
  });

  it("KmaError면 코드를 남긴다", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    build.mockRejectedValue(new KmaError("22"));
    await GET(req());
    expect(warnText(warn)[0]).toContain("22");
  });

  it("Error가 아닌 값이 던져져도 고정 문자열만 남는다", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    build.mockRejectedValue(`secret ${KEY}`);
    const res = await GET(req());
    expect(await res.json()).toEqual({ available: false });
    const line = warnText(warn)[0];
    expect(line).toContain("[weather]");
    expect(line).not.toContain(KEY);
  });
});
