// GET /api/weather: 서버에서 기상청 단기·중기예보를 3개 시 기준으로 불러 하루 값 표로 돌려준다.
// vitest에는 요청 저장소가 없어 connection()·cacheLife()가 던지므로 둘 다 무해한 함수로 바꾼다.
// 시각은 KST 2026-11-15 17:30(UTC 08:30)으로 고정한다(Date만 가짜 — AbortSignal.timeout은 그대로). 이때 중기 발표는 202611150600.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("next/cache", () => ({ cacheLife: () => {} }));

import { GET } from "../../src/app/api/weather/route";
import { readPayload } from "../../src/lib/weather/types";

const fixture = (name: string) => JSON.parse(readFileSync(resolve(__dirname, `../fixtures/weather/${name}`), "utf8")) as unknown;
const shortFixture = fixture("short-gangneung.json");
const land0600 = fixture("mid-land-0600.json");
const land1800 = fixture("mid-land-1800.json");
const ta0600 = fixture("mid-ta-0600.json");
const KEY = "test-key/abc+==";
const req = (path = "/api/weather") => new Request(`http://localhost${path}`);

type FetchMock = ReturnType<typeof vi.fn<(url: string | URL | Request, init?: RequestInit) => Promise<Response>>>;
type Handler = (url: URL) => Response | Promise<Response>;

/**
 * 경로(getVilageFcst·getMidLandFcst·getMidTa)로 응답을 고른다.
 * short는 단기 경로만, mid.land·mid.ta는 중기 경로만 맡는다. 안 주면 정상 픽스처(중기 육상은 tmFc 시각에 맞는 것).
 */
function stubFetch(short: Handler = () => Response.json(shortFixture), mid: { land?: Handler; ta?: Handler } = {}): FetchMock {
  const land: Handler = mid.land ?? ((url) => Response.json(url.searchParams.get("tmFc")?.endsWith("1800") ? land1800 : land0600));
  const ta: Handler = mid.ta ?? (() => Response.json(ta0600));
  const mock: FetchMock = vi.fn(async (u) => {
    const url = new URL(String(u));
    if (url.pathname.endsWith("/getVilageFcst")) return short(url);
    if (url.pathname.endsWith("/getMidLandFcst")) return land(url);
    if (url.pathname.endsWith("/getMidTa")) return ta(url);
    throw new Error(`예상 밖 경로 ${url.pathname}`);
  });
  vi.stubGlobal("fetch", mock);
  return mock;
}

/** 단기·중기 모두 같은 응답 */
const stubAll = (handler: Handler) => stubFetch(handler, { land: handler, ta: handler });

const callsTo = (mock: FetchMock, op: "getVilageFcst" | "getMidLandFcst" | "getMidTa") =>
  mock.mock.calls.map(([u]) => new URL(String(u))).filter((u) => u.pathname.endsWith(`/${op}`));

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
  it("3개 시를 단기 한 번씩 불러 하루 값 표를 돌려준다", async () => {
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
    expect(callsTo(fetchMock, "getVilageFcst")).toHaveLength(3);
    expect(readPayload(body)).not.toBeNull();
  });

  it("강릉 호출: 포털 호스트·단기예보 경로·발표 시각·격자·JSON 형식·1000행", async () => {
    const fetchMock = stubFetch();
    await GET(req());
    const urls = callsTo(fetchMock, "getVilageFcst");
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

type Body = {
  available: boolean;
  asOf: { short?: unknown; mid?: string };
  regions: Record<string, Record<string, { source: string; pop: number | null; tmin: number | null; tmax: number | null; sky: number | null; precip: string | null }>>;
};
const json = async (res: Response) => (await res.json()) as Body;

describe("GET /api/weather (중기 병합 — 단기 우선 D-01, 한쪽 실패는 그 범위만 D-15)", () => {
  it("모두 성공: 11-15~19는 단기, 11-20~25는 중기, 겹치는 11-19는 단기 값, asOf.mid는 발표 시각", async () => {
    stubFetch();
    const body = await json(await GET(req()));
    const days = body.regions.강릉;
    const bySource = (s: string) => Object.keys(days).filter((d) => days[d].source === s);
    expect(bySource("short")).toEqual(["2026-11-15", "2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19"]);
    expect(bySource("mid")).toEqual(["2026-11-20", "2026-11-21", "2026-11-22", "2026-11-23", "2026-11-24", "2026-11-25"]);
    expect(days["2026-11-19"].source).toBe("short"); // 중기 4일째(11-19)와 겹치지만 단기가 이긴다
    expect(days["2026-11-20"]).toEqual({ sky: 4, precip: "비", pop: 70, tmin: 4, tmax: 9, source: "mid" });
    expect(body.asOf.mid).toBe("202611150600");
    expect(readPayload(body)).not.toBeNull();
  });

  it("중기 호출 수: 육상은 요청당 1번(regId 11D20000, tmFc 202611150600), 기온은 3번(강릉·속초·동해)", async () => {
    const fetchMock = stubFetch();
    await GET(req());
    const land = callsTo(fetchMock, "getMidLandFcst");
    expect(land).toHaveLength(1);
    expect(land[0].host).toBe("apis.data.go.kr");
    expect(land[0].pathname).toBe("/1360000/MidFcstInfoService/getMidLandFcst");
    expect(land[0].searchParams.get("regId")).toBe("11D20000");
    expect(land[0].searchParams.get("tmFc")).toBe("202611150600");
    expect(land[0].searchParams.get("dataType")).toBe("JSON");
    expect(land[0].searchParams.get("serviceKey")).toBe(KEY);
    const ta = callsTo(fetchMock, "getMidTa");
    expect(ta.map((u) => u.searchParams.get("regId")).sort()).toEqual(["11D20401", "11D20501", "11D20601"]);
    expect(ta.every((u) => u.searchParams.get("tmFc") === "202611150600")).toBe(true);
  });

  it("중기 육상이 포털 30 오류: 단기 날짜만 나오고 asOf.mid는 없고 available true", async () => {
    stubFetch(undefined, { land: () => portalError() });
    const body = await json(await GET(req()));
    expect(body.available).toBe(true);
    expect(Object.keys(body.regions.강릉)).toEqual(["2026-11-15", "2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19"]);
    expect(Object.values(body.regions.강릉).every((d) => d.source === "short")).toBe(true);
    expect(body.asOf.mid).toBeUndefined();
    expect(body.asOf.short).toBeDefined();
  });

  it("단기가 모두 30 오류: 중기 날짜만 나오고 asOf.short는 없고 available true", async () => {
    stubFetch(() => portalError());
    const body = await json(await GET(req()));
    expect(body.available).toBe(true);
    expect(Object.keys(body.regions).sort()).toEqual(["강릉", "동해", "속초"]);
    expect(Object.keys(body.regions.강릉)).toEqual(["2026-11-19", "2026-11-20", "2026-11-21", "2026-11-22", "2026-11-23", "2026-11-24", "2026-11-25"]);
    expect(Object.values(body.regions.강릉).every((d) => d.source === "mid")).toBe(true);
    expect(body.asOf.short).toBeUndefined();
    expect(body.asOf.mid).toBe("202611150600");
    expect(readPayload(body)).not.toBeNull();
  });

  it("육상이 03이면 전날 1800 발표로 한 번 더 불러, 그 결과 날짜는 11-14 + N일", async () => {
    const fetchMock = stubFetch(undefined, { land: (url) => (url.searchParams.get("tmFc") === "202611150600" ? noData() : Response.json(land1800)) });
    const body = await json(await GET(req()));
    const land = callsTo(fetchMock, "getMidLandFcst");
    expect(land.map((u) => u.searchParams.get("tmFc"))).toEqual(["202611150600", "202611141800"]);
    // 18시 발표는 5일째(11-19)부터 10일째(11-24)까지: 11-20은 6일째(오후 20% 구름많음), 11-23은 9일째(60%, 비 쪽으로), 11-25는 없다
    expect(body.regions.강릉["2026-11-20"]).toMatchObject({ source: "mid", pop: 20, sky: 3, precip: null });
    expect(body.regions.강릉["2026-11-23"]).toMatchObject({ source: "mid", pop: 60, sky: 4, precip: "비" });
    expect(body.regions.강릉["2026-11-24"]).toMatchObject({ source: "mid", pop: 20, sky: 1, precip: null });
    expect(Object.keys(body.regions.강릉)).not.toContain("2026-11-25");
    expect(body.asOf.mid).toBe("202611141800");
  });

  it("재시도도 03이면 중기 없이 단기만(육상 총 2번)", async () => {
    const fetchMock = stubFetch(undefined, { land: () => noData() });
    const body = await json(await GET(req()));
    expect(callsTo(fetchMock, "getMidLandFcst")).toHaveLength(2);
    expect(body.available).toBe(true);
    expect(Object.values(body.regions.강릉).every((d) => d.source === "short")).toBe(true);
    expect(body.asOf.mid).toBeUndefined();
  });

  it("호출 한도(22)·키 오류는 중기도 재시도하지 않는다(육상 1번, 기온 3번)", async () => {
    const limit = { response: { header: { resultCode: "22", resultMsg: "LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS_ERROR" } } };
    const fetchMock = stubFetch(undefined, { land: () => Response.json(limit), ta: () => portalError() });
    await GET(req());
    expect(callsTo(fetchMock, "getMidLandFcst")).toHaveLength(1);
    expect(callsTo(fetchMock, "getMidTa")).toHaveLength(3);
  });

  it("기온만 실패하면 중기 날짜는 있고 tmin/tmax가 null", async () => {
    stubFetch(undefined, { ta: () => portalError() });
    const body = await json(await GET(req()));
    expect(body.regions.강릉["2026-11-20"]).toEqual({ sky: 4, precip: "비", pop: 70, tmin: null, tmax: null, source: "mid" });
    expect(body.regions.강릉["2026-11-16"].tmin).toBe(3); // 단기 값은 그대로
    expect(body.asOf.mid).toBe("202611150600");
  });

  it("한 시의 기온만 03(두 발표 모두)이면 그 시만 기온이 비고 다른 시는 그대로", async () => {
    stubFetch(undefined, { ta: (url) => (url.searchParams.get("regId") === "11D20401" ? noData() : Response.json(ta0600)) });
    const body = await json(await GET(req()));
    expect(body.regions.속초["2026-11-20"]).toMatchObject({ source: "mid", pop: 70, tmin: null, tmax: null });
    expect(body.regions.강릉["2026-11-20"]).toMatchObject({ tmin: 4, tmax: 9 });
  });

  it("단기가 오류, 중기는 03(두 발표 모두)이면 { available: false }, no-store", async () => {
    stubFetch(() => portalError(), { land: () => noData(), ta: () => noData() });
    const res = await GET(req());
    expect(await res.json()).toEqual({ available: false });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("중기 응답에 원문 날씨 문장이 그대로 나가지 않는다(고정 필드만)", async () => {
    stubFetch();
    const text = await (await GET(req())).text();
    expect(text).not.toContain("흐리고 비");
    expect(text).not.toContain("구름많고");
    expect(text).not.toContain("rnSt");
    expect(text).not.toContain("wf8");
  });
});

const portal30 = fixture("error-portal-30.json");
const portalError = () => new Response(JSON.stringify(portal30), { status: 403, headers: { "content-type": "application/json" } });

describe("GET /api/weather (실패해도 화면은 그대로 — D-05)", () => {
  it("키가 비어 있으면 200 { available: false }, no-store, 기상청을 부르지 않는다", async () => {
    vi.stubEnv("KMA_API_KEY", "");
    const fetchMock = stubFetch();
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ available: false });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("키가 공백뿐이어도 없는 것으로 본다", async () => {
    vi.stubEnv("KMA_API_KEY", "   ");
    const fetchMock = stubFetch();
    expect(await (await GET(req())).json()).toEqual({ available: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("단기·중기 모든 호출이 포털 오류(30)면 200 { available: false }, no-store", async () => {
    stubAll(portalError);
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ available: false });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("fetch가 던져도(시간 초과·연결 끊김) 5xx가 아니라 200 { available: false }", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("fetch failed"))));
    const res = await GET(req());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ available: false });
  });

  it("기상청이 JSON이 아닌 글을 줘도 200 { available: false }", async () => {
    stubAll(() => new Response("<html>점검 중</html>", { status: 200 }));
    expect(await (await GET(req())).json()).toEqual({ available: false });
  });

  it("세 시 중 속초만 실패하면(단기·기온 모두) 강릉·동해만 담는다", async () => {
    stubFetch((url) => (url.searchParams.get("nx") === "87" ? portalError() : Response.json(shortFixture)), {
      land: () => portalError(),
      ta: () => portalError(),
    });
    const body = (await (await GET(req())).json()) as { available: boolean; regions: Record<string, unknown> };
    expect(body.available).toBe(true);
    expect(Object.keys(body.regions).sort()).toEqual(["강릉", "동해"]);
  });

  it("쿼리가 붙은 요청은 400 { available: false }, no-store, 기상청을 부르지 않는다(CDN 캐시 우회 막기)", async () => {
    const fetchMock = stubFetch();
    const res = await GET(req("/api/weather?x=1"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ available: false });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

const noData03 = fixture("no-data-03.json");
const noData = () => Response.json(noData03);

describe("GET /api/weather (발표 직후 데이터 없음(03)이면 직전 발표로 한 번만 — T-02-10)", () => {
  it("1700 발표가 아직 03이면 1400 발표로 시마다 한 번 더 불러(단기 총 6번) 세 시가 다 채워진다", async () => {
    const fetchMock = stubFetch((url) => (url.searchParams.get("base_time") === "1700" ? noData() : Response.json(shortFixture)));
    const body = (await (await GET(req())).json()) as { available: boolean; asOf: { short: unknown }; regions: Record<string, unknown> };
    expect(callsTo(fetchMock, "getVilageFcst")).toHaveLength(6);
    expect(body.available).toBe(true);
    expect(body.asOf.short).toEqual({ baseDate: "20261115", baseTime: "1400" });
    expect(Object.keys(body.regions).sort()).toEqual(["강릉", "동해", "속초"]);
    const times = callsTo(fetchMock, "getVilageFcst").map((u) => u.searchParams.get("base_time"));
    expect(times.filter((t) => t === "1700")).toHaveLength(3);
    expect(times.filter((t) => t === "1400")).toHaveLength(3);
  });

  it("포털 30(키 미등록) 오류면 재시도하지 않는다(단기 총 3번, 중기 육상 1번·기온 3번, available false)", async () => {
    const fetchMock = stubAll(portalError);
    const res = await GET(req());
    expect(await res.json()).toEqual({ available: false });
    expect(callsTo(fetchMock, "getVilageFcst")).toHaveLength(3);
    expect(callsTo(fetchMock, "getMidLandFcst")).toHaveLength(1);
    expect(callsTo(fetchMock, "getMidTa")).toHaveLength(3);
  });

  it("직전 발표도 03이면 그 시만 빠진다(단기 총 6번, 나머지 시는 정상)", async () => {
    const fetchMock = stubFetch(
      (url) => {
        if (url.searchParams.get("nx") === "87") return noData(); // 속초는 두 발표 모두 없음
        return url.searchParams.get("base_time") === "1700" ? noData() : Response.json(shortFixture);
      },
      { land: () => portalError(), ta: () => portalError() },
    );
    const body = (await (await GET(req())).json()) as { available: boolean; regions: Record<string, unknown> };
    expect(callsTo(fetchMock, "getVilageFcst")).toHaveLength(6);
    expect(body.available).toBe(true);
    expect(Object.keys(body.regions).sort()).toEqual(["강릉", "동해"]);
  });

  it("호출 한도(22)나 네트워크 오류도 재시도하지 않는다(단기 총 3번)", async () => {
    const limit = { response: { header: { resultCode: "22", resultMsg: "LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS_ERROR" } } };
    const fetchMock = stubAll(() => Response.json(limit));
    expect(await (await GET(req())).json()).toEqual({ available: false });
    expect(callsTo(fetchMock, "getVilageFcst")).toHaveLength(3);
  });

  it("03이 아닌 시는 재시도 없이 한 번만 불러, 한 시만 03이면 단기 총 4번이고 asOf는 쓴 발표 중 가장 늦은 것", async () => {
    const fetchMock = stubFetch((url) => (url.searchParams.get("nx") === "87" && url.searchParams.get("base_time") === "1700" ? noData() : Response.json(shortFixture)));
    const body = (await (await GET(req())).json()) as { asOf: { short: unknown }; regions: Record<string, unknown> };
    expect(callsTo(fetchMock, "getVilageFcst")).toHaveLength(4);
    expect(Object.keys(body.regions).sort()).toEqual(["강릉", "동해", "속초"]);
    expect(body.asOf.short).toEqual({ baseDate: "20261115", baseTime: "1700" });
  });
});

describe("GET /api/weather (키가 새지 않는다 — 원칙 4)", () => {
  it("응답 본문과 console 출력 어디에도 키와 그 URL 인코딩 형태가 없다", async () => {
    const logs: unknown[][] = [];
    for (const m of ["log", "info", "warn", "error", "debug"] as const) vi.spyOn(console, m).mockImplementation((...a: unknown[]) => void logs.push(a));
    const bodies: string[] = [];
    const scenarios: (() => void)[] = [
      () => stubFetch(),
      () => stubAll(portalError),
      () => stubAll(() => new Response(`장애 serviceKey=${encodeURIComponent(KEY)}`, { status: 500 })),
      () => vi.stubGlobal("fetch", vi.fn(async (url: unknown) => Promise.reject(new TypeError(`fetch failed ${String(url)} ${KEY}`)))),
    ];
    for (const setup of scenarios) {
      setup();
      bodies.push(await (await GET(req())).text());
    }
    const seen = JSON.stringify([bodies, logs, logs.map((a) => a.map(String))]);
    expect(seen).not.toContain(KEY);
    expect(seen).not.toContain(encodeURIComponent(KEY));
    expect(seen.toLowerCase()).not.toContain("servicekey");
    expect(seen).not.toContain("apis.data.go.kr");
  });

  it("호출이 실패하면 코드만 남긴다(console.warn 한 줄, 이름·코드뿐)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    stubAll(portalError);
    await GET(req());
    expect(warn).toHaveBeenCalled();
    const args = warn.mock.calls.map((c) => c.map(String).join(" ")).join(" | ");
    expect(args).toContain("30");
  });
});
