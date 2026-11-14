// 기상청 응답 봉투 읽기: 정상·포털 오류·API허브 오류·데이터 없음·형식 이상을 모두 KmaError 코드로 구분한다.
// 오류 메시지·코드에는 키·URL이 없어야 한다(원칙 4).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchShort, KmaError, kmaGet, readEnvelope } from "../../src/lib/weather/kma";

const fx = (name: string) => JSON.parse(readFileSync(resolve(__dirname, "../fixtures/weather", name), "utf8")) as unknown;
const normal = fx("short-gangneung.json");

const codeOf = (fn: () => unknown): string => {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(KmaError);
    return (e as KmaError).code;
  }
  throw new Error("KmaError가 나오지 않았다");
};

const envelope = (resultCode: string, item?: unknown) => ({
  response: { header: { resultCode, resultMsg: "x" }, body: { items: item === undefined ? "" : { item }, totalCount: Array.isArray(item) ? item.length : 1 } },
});

describe("readEnvelope", () => {
  it("정상: 00 + item 배열 → 항목", () => {
    const { items, totalCount } = readEnvelope(normal);
    expect(items.length).toBeGreaterThan(10);
    expect(totalCount).toBe(items.length);
    expect(items[0]).toHaveProperty("category");
  });

  it("정상: item이 객체 하나면 길이 1 배열로 감싼다", () => {
    expect(readEnvelope(envelope("00", { category: "POP", fcstValue: "30" })).items).toEqual([{ category: "POP", fcstValue: "30" }]);
  });

  it("포털 오류 봉투(returnReasonCode 30) → 코드 30", () => {
    expect(codeOf(() => readEnvelope(fx("error-portal-30.json")))).toBe("30");
  });

  it("API허브 오류 봉투(result.status 401) → HTTP401", () => {
    expect(codeOf(() => readEnvelope(fx("error-apihub-401.json")))).toBe("HTTP401");
  });

  it("resultCode 03(데이터 없음) → 03", () => {
    expect(codeOf(() => readEnvelope(fx("no-data-03.json")))).toBe("03");
  });

  it("00인데 item이 없거나 빈 배열이면 03", () => {
    expect(codeOf(() => readEnvelope(envelope("00")))).toBe("03");
    expect(codeOf(() => readEnvelope(envelope("00", [])))).toBe("03");
  });

  it("그 밖의 resultCode는 그 코드(예: 22 호출 한도)", () => {
    expect(codeOf(() => readEnvelope(envelope("22")))).toBe("22");
  });

  it("문자열·null·배열·모르는 모양은 ENVELOPE", () => {
    expect(codeOf(() => readEnvelope("오류"))).toBe("ENVELOPE");
    expect(codeOf(() => readEnvelope(null))).toBe("ENVELOPE");
    expect(codeOf(() => readEnvelope([]))).toBe("ENVELOPE");
    expect(codeOf(() => readEnvelope({ hello: 1 }))).toBe("ENVELOPE");
  });

  it("코드로 못 쓰는 값(긴 글·공백)은 ENVELOPE로 바꾼다(외부 글을 그대로 옮기지 않는다)", () => {
    const evil = { OpenAPI_ServiceResponse: { cmmMsgHeader: { returnReasonCode: "serviceKey=abc 와 긴 글이 섞인 값" } } };
    expect(codeOf(() => readEnvelope(evil))).toBe("ENVELOPE");
  });
});

describe("kmaGet", () => {
  const KEY = "test-key/abc+==";
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  const run = async (res: Response | Error) => {
    vi.stubEnv("KMA_API_KEY", KEY);
    vi.stubGlobal("fetch", vi.fn(async () => (res instanceof Error ? Promise.reject(res) : res)));
    try {
      await kmaGet("VilageFcstInfoService_2.0/getVilageFcst", { nx: "92" });
    } catch (e) {
      return e as KmaError;
    }
    throw new Error("KmaError가 나오지 않았다");
  };

  it("HTTP 403이어도 JSON 오류 봉투면 봉투 코드(30)를 살린다", async () => {
    const e = await run(new Response(JSON.stringify(fx("error-portal-30.json")), { status: 403, headers: { "content-type": "application/json" } }));
    expect(e.code).toBe("30");
  });

  it("HTTP 502 + JSON 아님 → HTTP502", async () => {
    expect((await run(new Response("Bad Gateway", { status: 502 }))).code).toBe("HTTP502");
  });

  it("HTTP 200인데 JSON이 아니면 PARSE", async () => {
    expect((await run(new Response("<html>", { status: 200 }))).code).toBe("PARSE");
  });

  it("fetch가 거부(시간 초과·네트워크)되면 NETWORK, 원래 오류 글(URL·키 포함 가능)은 버린다", async () => {
    const e = await run(new TypeError(`fetch failed https://apis.data.go.kr/x?serviceKey=${encodeURIComponent(KEY)}`));
    expect(e.code).toBe("NETWORK");
  });

  it("어떤 KmaError에도 키·serviceKey·URL이 없다", async () => {
    const errors = [
      await run(new Response(JSON.stringify(fx("error-portal-30.json")), { status: 403 })),
      await run(new Response("x", { status: 500 })),
      await run(new TypeError(`fail ${KEY}`)),
    ];
    for (const e of errors) {
      const text = `${e.message} ${e.code}`;
      expect(text).not.toContain(KEY);
      expect(text).not.toContain(encodeURIComponent(KEY));
      expect(text.toLowerCase()).not.toContain("servicekey");
      expect(text).not.toContain("http");
    }
  });
});

// 하루치가 1000행을 넘으면 쪽을 이어 받는다(최대 5쪽). 쪽이 비면 멈추고, 쪽 사이 오류는 그대로 던진다.
describe("fetchShort: 페이지 반복", () => {
  const KEY = "test-key/abc+==";
  const BASE = { baseDate: "20261115", baseTime: "1700" };
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  const rows = (n: number, page: number) =>
    Array.from({ length: n }, (_, i) => ({ category: "TMP", fcstDate: "20261116", fcstTime: "0900", fcstValue: String(page * 1000 + i) }));
  const page = (n: number, page: number, totalCount: number) =>
    Response.json({ response: { header: { resultCode: "00" }, body: { items: n === 0 ? "" : { item: rows(n, page) }, totalCount } } });

  function stub(handler: (pageNo: number) => Response) {
    vi.stubEnv("KMA_API_KEY", KEY);
    const mock = vi.fn(async (url: string | URL) => handler(Number(new URL(String(url)).searchParams.get("pageNo"))));
    vi.stubGlobal("fetch", mock);
    return mock;
  }
  const pageNos = (mock: ReturnType<typeof stub>) => mock.mock.calls.map(([u]) => new URL(String(u)).searchParams.get("pageNo"));

  it("totalCount 1500: 1쪽 1000개 + 2쪽 500개 = 1500개, pageNo 1·2 두 번 부른다", async () => {
    const mock = stub((n) => (n === 1 ? page(1000, 1, 1500) : page(500, 2, 1500)));
    const items = await fetchShort(92, 131, BASE);
    expect(items).toHaveLength(1500);
    expect(pageNos(mock)).toEqual(["1", "2"]);
    expect(new URL(String(mock.mock.calls[0][0])).searchParams.get("numOfRows")).toBe("1000");
  });

  it("totalCount가 1쪽에 다 들어오면 한 번만 부른다", async () => {
    const mock = stub(() => page(300, 1, 300));
    expect(await fetchShort(92, 131, BASE)).toHaveLength(300);
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it("쪽이 비면(데이터 없음 03) 거기서 멈추고 모은 것을 돌려준다", async () => {
    const mock = stub((n) => (n === 1 ? page(1000, 1, 3000) : page(0, n, 3000)));
    const items = await fetchShort(92, 131, BASE);
    expect(items).toHaveLength(1000);
    expect(pageNos(mock)).toEqual(["1", "2"]);
  });

  it("totalCount가 매우 커도 MAX_PAGES(5)번에서 멈춘다", async () => {
    const mock = stub((n) => page(1000, n, 999_999));
    const items = await fetchShort(92, 131, BASE);
    expect(items).toHaveLength(5000);
    expect(pageNos(mock)).toEqual(["1", "2", "3", "4", "5"]);
  });

  it("쪽 사이에서 오류가 나면 부분 결과로 굳히지 않고 그대로 던진다", async () => {
    stub((n) => (n === 1 ? page(1000, 1, 3000) : new Response(JSON.stringify(fx("error-portal-30.json")), { status: 403 })));
    await expect(fetchShort(92, 131, BASE)).rejects.toMatchObject({ code: "30" });
  });

  it("첫 쪽이 비면 그대로 데이터 없음(03)", async () => {
    stub(() => page(0, 1, 0));
    await expect(fetchShort(92, 131, BASE)).rejects.toMatchObject({ code: "03" });
  });
});
