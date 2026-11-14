// GET /api/weather: 서버에서 기상청 단기예보를 3개 시 격자로 불러 하루 값 표로 돌려준다.
// vitest에는 요청 저장소가 없어 connection()·cacheLife()가 던지므로 둘 다 무해한 함수로 바꾼다.
// 시각은 KST 2026-11-15 17:30(UTC 08:30)으로 고정한다(Date만 가짜 — AbortSignal.timeout은 그대로).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("next/cache", () => ({ cacheLife: () => {} }));

import { GET } from "../../src/app/api/weather/route";
import { readPayload } from "../../src/lib/weather/types";

const shortFixture = JSON.parse(readFileSync(resolve(__dirname, "../fixtures/weather/short-gangneung.json"), "utf8")) as unknown;
const KEY = "test-key/abc+==";
const req = (path = "/api/weather") => new Request(`http://localhost${path}`);

type FetchMock = ReturnType<typeof vi.fn<(url: string | URL | Request, init?: RequestInit) => Promise<Response>>>;

function stubFetch(handler: (url: URL) => Response | Promise<Response> = () => Response.json(shortFixture)): FetchMock {
  const mock: FetchMock = vi.fn(async (url) => handler(new URL(String(url))));
  vi.stubGlobal("fetch", mock);
  return mock;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-11-15T08:30:00Z") });
  vi.stubEnv("KMA_API_KEY", KEY);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("GET /api/weather (정상)", () => {
  it("3개 시를 한 번씩 불러 하루 값 표를 돌려준다", async () => {
    const fetchMock = stubFetch();
    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toMatchObject({
      available: true,
      today: "2026-11-15",
      asOf: { short: { baseDate: "20261115", baseTime: "1700" } },
    });
    const regions = body.regions as Record<string, Record<string, unknown>>;
    expect(Object.keys(regions).sort()).toEqual(["강릉", "동해", "속초"]);
    expect(regions.강릉["2026-11-16"]).toEqual({ sky: 4, precip: null, pop: 30, tmin: 3, tmax: 11, source: "short" });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(readPayload(body)).not.toBeNull();
  });

  it("강릉 호출: 포털 호스트·단기예보 경로·발표 시각·격자·JSON 형식·1000행", async () => {
    const fetchMock = stubFetch();
    await GET(req());
    const urls = fetchMock.mock.calls.map(([u]) => new URL(String(u)));
    const gn = urls.find((u) => u.searchParams.get("nx") === "92");
    expect(gn).toBeDefined();
    expect(gn!.host).toBe("apis.data.go.kr");
    expect(gn!.pathname).toBe("/1360000/VilageFcstInfoService_2.0/getVilageFcst");
    expect(gn!.searchParams.get("base_date")).toBe("20261115");
    expect(gn!.searchParams.get("base_time")).toBe("1700");
    expect(gn!.searchParams.get("ny")).toBe("131");
    expect(gn!.searchParams.get("dataType")).toBe("JSON");
    expect(gn!.searchParams.get("numOfRows")).toBe("1000");
    expect(gn!.searchParams.get("serviceKey")).toBe(KEY); // 한 번만 인코딩돼 같은 값으로 읽힌다
    // 속초·동해 격자
    expect(urls.map((u) => `${u.searchParams.get("nx")},${u.searchParams.get("ny")}`).sort()).toEqual(["87,141", "92,131", "97,127"]);
  });

  it("성공 응답은 CDN이 30분 쥘 수 있다(s-maxage=1800)", async () => {
    stubFetch();
    const res = await GET(req());
    expect(res.headers.get("Cache-Control")).toContain("s-maxage=1800");
  });
});
