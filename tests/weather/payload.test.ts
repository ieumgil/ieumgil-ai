// 클라이언트가 /api/weather 응답을 다시 검사한다(readPayload). 모르는 모양은 버리고, 틀린 날 항목만 뺀다.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { readPayload } from "../../src/lib/weather/types";

const e2eFixture = JSON.parse(readFileSync(resolve(__dirname, "../e2e/fixtures/weather.json"), "utf8")) as unknown;

const ok = { sky: 4, precip: "비", pop: 70, tmin: 8, tmax: 14, source: "short" };
const payload = (regions: unknown) => ({ available: true, today: "2026-11-18", asOf: {}, regions });

describe("readPayload", () => {
  it("화면 테스트용 가짜 응답을 받아들인다", () => {
    const p = readPayload(e2eFixture);
    expect(p?.today).toBe("2026-11-18");
    expect(p?.regions.강릉?.["2026-11-21"]).toEqual(ok);
    expect(p?.regions.속초?.["2026-11-21"].precip).toBeNull();
    expect(p?.asOf.short).toEqual({ baseDate: "20261118", baseTime: "1700" });
  });

  it("available:false·배열·문자열·null·today 형식 틀림은 null", () => {
    expect(readPayload({ available: false })).toBeNull();
    expect(readPayload([])).toBeNull();
    expect(readPayload("날씨")).toBeNull();
    expect(readPayload(null)).toBeNull();
    expect(readPayload({ ...payload({}), today: "2026/11/18" })).toBeNull();
    expect(readPayload({ ...payload({}), today: 20261118 })).toBeNull();
  });

  it("틀린 날 항목(강수확률 150·하늘 2·모르는 시·날짜 형식)은 그 항목만 버린다", () => {
    const p = readPayload(
      payload({
        강릉: { "2026-11-21": ok, "2026-11-22": { ...ok, pop: 150 }, "2026-11-23": { ...ok, sky: 2 }, "11-24": ok, "2026-11-25": { ...ok, source: "long" } },
        부산: { "2026-11-21": ok },
        속초: { "2026-11-21": { ...ok, tmin: 999 } },
      }),
    );
    expect(Object.keys(p?.regions.강릉 ?? {})).toEqual(["2026-11-21"]);
    expect(p?.regions).not.toHaveProperty("부산");
    expect(p?.regions.속초).toEqual({});
  });

  it("값이 null인 칸은 받아들인다(기온·확률 없음)", () => {
    const p = readPayload(payload({ 강릉: { "2026-11-21": { sky: null, precip: null, pop: null, tmin: null, tmax: null, source: "mid" } } }));
    expect(p?.regions.강릉?.["2026-11-21"].source).toBe("mid");
  });

  it("regions가 객체가 아니면 null", () => {
    expect(readPayload({ available: true, today: "2026-11-18", asOf: {}, regions: [] })).toBeNull();
    expect(readPayload({ available: true, today: "2026-11-18", asOf: {} })).toBeNull();
  });
});
