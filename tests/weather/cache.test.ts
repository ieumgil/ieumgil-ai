// 'use cache' 안쪽 처리(WR-03): 다시 불러도 소용없는 결정적 오류(12·20·22·30·31·32)는 값으로 내보내 짧게 캐시하고,
// 서비스에서 다시 던진다. 재시도 가능한 오류(네트워크 등)는 그대로 던져 캐시에 굳지 않는다.
// vitest에는 캐시가 없으므로 cacheLife 호출만 기록해, 어떤 수명을 골랐는지 확인한다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const cacheLife = vi.fn();
vi.mock("next/cache", () => ({ cacheLife: (profile: unknown) => cacheLife(profile) }));

import { KmaError } from "../../src/lib/weather/kma";
import { buildWeatherPayload, cachedDeps } from "../../src/lib/weather/service";

const KEY = "test-key/abc+==";
const SHORT_LIVED = { stale: 30, revalidate: 30, expire: 60 };
const NORMAL = { stale: 300, revalidate: 900, expire: 1800 };

const header = (resultCode: string) => ({ response: { header: { resultCode, resultMsg: "x" } } });
const portal = (code: string) => ({ OpenAPI_ServiceResponse: { cmmMsgHeader: { returnReasonCode: code } } });
const stubJson = (json: unknown) => {
  const mock = vi.fn(async () => Response.json(json));
  vi.stubGlobal("fetch", mock);
  return mock;
};

beforeEach(() => {
  cacheLife.mockClear();
  vi.stubEnv("KMA_API_KEY", KEY);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("결정적 오류는 짧게 캐시하고 서비스가 다시 던진다", () => {
  const cases: [string, unknown][] = [
    ["12", header("12")],
    ["20", header("20")],
    ["22", header("22")],
    ["30", portal("30")],
    ["31", portal("31")],
    ["32", portal("32")],
  ];

  for (const [code, json] of cases) {
    it(`오류 ${code}: 단기·중기 육상·중기 기온 모두 짧은 수명(30초 다시 확인, 60초 만료)을 고르고 KmaError(${code})로 던진다`, async () => {
      stubJson(json);
      for (const call of [
        () => cachedDeps.short(92, 131, "20261115", "1700"),
        () => cachedDeps.midLand("11D20000", "202611150600"),
        () => cachedDeps.midTa("11D20201", "202611150600"),
      ]) {
        cacheLife.mockClear();
        await expect(call()).rejects.toMatchObject({ code });
        await expect(call()).rejects.toBeInstanceOf(KmaError);
        expect(cacheLife).toHaveBeenCalledWith(SHORT_LIVED);
        expect(cacheLife).not.toHaveBeenCalledWith(NORMAL);
      }
    });
  }

  it("메시지에도 키·URL이 없다", async () => {
    stubJson(portal("30"));
    let message = "";
    try {
      await cachedDeps.short(92, 131, "20261115", "1700");
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).not.toBe("");
    expect(message).not.toContain(KEY);
    expect(message.toLowerCase()).not.toContain("servicekey");
    expect(message).not.toContain("http");
  });

  it("22(호출 한도)는 다시 부르지 않는다: 요청 한 번에 단기 3 + 중기 4 = 7번뿐이고 재시도가 없다", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-11-15T08:30:00Z") });
    const mock = stubJson(header("22"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await buildWeatherPayload(new Date(), cachedDeps)).toEqual({ available: false });
    expect(mock).toHaveBeenCalledTimes(7);
    expect(warn.mock.calls.map((c) => c.map(String).join(" ")).join(" | ")).toContain("22");
    warn.mockRestore();
  });
});

describe("재시도할 수 있는 실패와 정상은 그대로", () => {
  it("정상: 기본 수명(15분 다시 확인, 30분 만료)", async () => {
    stubJson({ response: { header: { resultCode: "00" }, body: { items: { item: [{ category: "POP", fcstDate: "20261116", fcstTime: "0900", fcstValue: "30" }] }, totalCount: 1 } } });
    await cachedDeps.short(92, 131, "20261115", "1700");
    expect(cacheLife).toHaveBeenCalledWith(NORMAL);
  });

  it("네트워크 오류는 값으로 내보내지 않고 던진다(짧은 수명도 정하지 않아 캐시에 굳지 않는다)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("fetch failed"))));
    await expect(cachedDeps.midLand("11D20000", "202611150600")).rejects.toMatchObject({ code: "NETWORK" });
    expect(cacheLife).not.toHaveBeenCalled();
  });

  it("데이터 없음(03)은 예전처럼 1~2분만 캐시하고 서비스가 직전 발표로 한 번 더 부른다", async () => {
    stubJson(header("03"));
    await expect(cachedDeps.short(92, 131, "20261115", "1700")).resolves.toEqual([]);
    expect(cacheLife).toHaveBeenCalledWith({ stale: 30, revalidate: 60, expire: 120 });
    await expect(cachedDeps.midLand("11D20000", "202611150600")).resolves.toBeNull();
  });
});
