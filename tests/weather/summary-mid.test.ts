// 중기예보(육상·기온) → 날짜별 하루 값. 픽스처는 공식 활용가이드 필드 이름으로 손으로 만든 값([ASSUMED])이다.
// 필드 이름의 N일은 오늘이 아니라 발표(tmFc) 날짜 기준이다(연구 Pitfall 4).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { mergeDays, parseMidWf, summarizeMid } from "../../src/lib/weather/mid";
import type { DayForecast } from "../../src/lib/weather/types";

function loadItem(name: string): Record<string, unknown> {
  const json = JSON.parse(readFileSync(resolve(__dirname, `../fixtures/weather/${name}`), "utf8")) as {
    response: { body: { items: { item: Record<string, unknown>[] } } };
  };
  return json.response.body.items.item[0];
}

const land0600 = loadItem("mid-land-0600.json");
const land1800 = loadItem("mid-land-1800.json");
const ta0600 = loadItem("mid-ta-0600.json");

const TMFC_0600 = "202611150600";
const TMFC_1800 = "202611141800";

describe("parseMidWf: 가이드의 닫힌 값 표만 해석한다", () => {
  it("맑음·구름많음·흐림은 하늘만", () => {
    expect(parseMidWf("맑음")).toEqual({ sky: 1, precip: null });
    expect(parseMidWf("구름많음")).toEqual({ sky: 3, precip: null });
    expect(parseMidWf("흐림")).toEqual({ sky: 4, precip: null });
  });

  it("(구름많|흐리)고 + 비·눈·비/눈·소나기", () => {
    expect(parseMidWf("구름많고 비")).toEqual({ sky: 3, precip: "비" });
    expect(parseMidWf("흐리고 눈")).toEqual({ sky: 4, precip: "눈" });
    expect(parseMidWf("흐리고 비/눈")).toEqual({ sky: 4, precip: "비/눈" });
    expect(parseMidWf("구름많고 소나기")).toEqual({ sky: 3, precip: "비" });
  });

  it("공백 없는 '구름많고비'도 같다", () => {
    expect(parseMidWf("구름많고비")).toEqual({ sky: 3, precip: "비" });
    expect(parseMidWf("흐리고비/눈")).toEqual({ sky: 4, precip: "비/눈" });
  });

  it("표에 없는 문장·빈 값·숫자는 null", () => {
    expect(parseMidWf("가끔 비")).toBeNull();
    expect(parseMidWf("")).toBeNull();
    expect(parseMidWf(30)).toBeNull();
    expect(parseMidWf(undefined)).toBeNull();
    expect(parseMidWf("맑고 비")).toBeNull();
  });
});

describe("summarizeMid: 06시 발표(2026-11-15)", () => {
  const out = summarizeMid({ item: land0600, tmFc: TMFC_0600 }, { item: ta0600, tmFc: TMFC_0600 });

  it("날짜는 4일째(2026-11-19)부터 10일째(2026-11-25)까지 일곱 날", () => {
    expect(Object.keys(out)).toEqual(["2026-11-19", "2026-11-20", "2026-11-21", "2026-11-22", "2026-11-23", "2026-11-24", "2026-11-25"]);
  });

  it("2026-11-19: 오전 20·오후 30 → 강수확률 큰 쪽(오후)의 '흐림', 기온 3~11, source mid", () => {
    expect(out["2026-11-19"]).toEqual({ sky: 4, precip: null, pop: 30, tmin: 3, tmax: 11, source: "mid" });
  });

  it("2026-11-20: 60/70, 흐리고 비 → 비", () => {
    expect(out["2026-11-20"]).toMatchObject({ sky: 4, precip: "비", pop: 70 });
  });

  it("2026-11-21: 10/10 동률이면 오후 쪽 '맑음'", () => {
    expect(out["2026-11-21"]).toMatchObject({ sky: 1, precip: null, pop: 10 });
  });

  it("2026-11-22: 0/20 → 오후 쪽, 강수확률 0도 값으로 남는다", () => {
    expect(out["2026-11-22"]).toMatchObject({ sky: 3, pop: 20, tmin: 1, tmax: 12 });
  });

  it("2026-11-23(8일째): 하루 한 값 rnSt8·wf8", () => {
    expect(out["2026-11-23"]).toMatchObject({ sky: 3, precip: null, pop: 40, tmin: 0, tmax: 8 });
  });

  it("2026-11-24(9일째): 흐리고 눈 → 눈, 영하 기온", () => {
    expect(out["2026-11-24"]).toMatchObject({ sky: 4, precip: "눈", pop: 80, tmin: -2, tmax: 3 });
  });

  it("2026-11-25(10일째): '구름많고비' → 비", () => {
    expect(out["2026-11-25"]).toMatchObject({ sky: 3, precip: "비", pop: 30, tmin: 1, tmax: 7 });
  });

  it("taMin4Low 같은 범위 필드는 읽지 않는다(2026-11-19 기온이 3·11)", () => {
    expect(out["2026-11-19"].tmin).toBe(3);
    expect(out["2026-11-19"].tmax).toBe(11);
  });

  it("원문 문장은 값에 남지 않는다(정해진 필드만)", () => {
    for (const day of Object.values(out)) {
      expect(Object.keys(day).sort()).toEqual(["pop", "precip", "sky", "source", "tmax", "tmin"]);
    }
  });
});

describe("summarizeMid: 18시 발표(2026-11-14)는 4일 필드가 없다", () => {
  const out = summarizeMid({ item: land1800, tmFc: TMFC_1800 }, null);

  it("첫 날짜가 2026-11-19(14일 + 5)이고 2026-11-18은 없다", () => {
    const dates = Object.keys(out);
    expect(dates[0]).toBe("2026-11-19");
    expect(dates).not.toContain("2026-11-18");
    expect(dates).toEqual(["2026-11-19", "2026-11-20", "2026-11-21", "2026-11-22", "2026-11-23", "2026-11-24"]);
  });

  it("2026-11-19: 50/40 → 오전(큰 쪽) '흐리고 비'", () => {
    expect(out["2026-11-19"]).toMatchObject({ sky: 4, precip: "비", pop: 50, tmin: null, tmax: null, source: "mid" });
  });

  it("옛 필드(rnSt3Am·wf3Am)가 있어도 읽지 않는다", () => {
    const withOld = { ...land1800, rnSt3Am: 90, rnSt3Pm: 90, wf3Am: "흐리고 눈", wf3Pm: "흐리고 눈" };
    expect(Object.keys(summarizeMid({ item: withOld, tmFc: TMFC_1800 }, null))).toEqual(Object.keys(out));
  });
});

describe("summarizeMid: 표에 없는 문장·결측·실패", () => {
  const landWith = (fields: Record<string, unknown>) => ({ item: fields, tmFc: TMFC_0600 });

  it("표에 없는 문장은 sky null이고 pop 60 이상이면 비", () => {
    const out = summarizeMid(landWith({ rnSt8: 70, wf8: "가끔 비" }), null);
    expect(out["2026-11-23"]).toEqual({ sky: null, precip: "비", pop: 70, tmin: null, tmax: null, source: "mid" });
  });

  it("표에 없는 문장이고 pop이 60 미만이면 precip null", () => {
    const out = summarizeMid(landWith({ rnSt8: 50, wf8: "가끔 비" }), null);
    expect(out["2026-11-23"]).toMatchObject({ sky: null, precip: null, pop: 50 });
  });

  it("표에 없는 문장이고 pop도 없으면 그날은 없다", () => {
    const out = summarizeMid(landWith({ wf8: "가끔 비", rnSt9: 20, wf9: "맑음" }), null);
    expect(Object.keys(out)).toEqual(["2026-11-24"]);
  });

  it("맑음인데 pop이 60 이상이면 안전 쪽으로 비", () => {
    expect(summarizeMid(landWith({ rnSt8: 60, wf8: "구름많음" }), null)["2026-11-23"]).toMatchObject({ sky: 3, precip: "비", pop: 60 });
  });

  it("숫자 문자열은 받고, 결측(-999)·범위 밖 pop은 버린다", () => {
    const out = summarizeMid(landWith({ rnSt8: "40", wf8: "맑음", rnSt9: -999, wf9: "맑음", rnSt10: 130, wf10: "흐림" }), null);
    expect(out["2026-11-23"]).toMatchObject({ pop: 40, sky: 1 });
    expect(out["2026-11-24"]).toMatchObject({ pop: null, sky: 1 }); // 하늘만 있는 날은 남는다
    expect(out["2026-11-25"]).toMatchObject({ pop: null, sky: 4 });
  });

  it("기온 결측(-999)은 null", () => {
    const out = summarizeMid(landWith({ rnSt8: 40, wf8: "맑음" }), { item: { taMin8: -999, taMax8: "9" }, tmFc: TMFC_0600 });
    expect(out["2026-11-23"]).toMatchObject({ tmin: null, tmax: 9 });
  });

  it("기온 호출이 실패(ta null)하면 tmin/tmax null, 하늘·강수확률은 그대로", () => {
    const out = summarizeMid({ item: land0600, tmFc: TMFC_0600 }, null);
    expect(out["2026-11-19"]).toEqual({ sky: 4, precip: null, pop: 30, tmin: null, tmax: null, source: "mid" });
  });

  it("육상 호출이 실패(land null)하면 빈 결과(기온만으로는 날을 만들지 않는다)", () => {
    expect(summarizeMid(null, { item: ta0600, tmFc: TMFC_0600 })).toEqual({});
    expect(summarizeMid(null, null)).toEqual({});
  });

  it("육상·기온이 서로 다른 발표로 받아졌어도 각자의 발표 날짜로 날짜를 맞춘다", () => {
    // 육상은 11-14 1800(5일째 = 11-19), 기온은 11-15 0600(4일째 = 11-19, 5일째 = 11-20)
    const out = summarizeMid({ item: land1800, tmFc: TMFC_1800 }, { item: ta0600, tmFc: TMFC_0600 });
    expect(out["2026-11-19"]).toMatchObject({ pop: 50, tmin: 3, tmax: 11 }); // 기온 4일째(11-19)
    expect(out["2026-11-20"]).toMatchObject({ tmin: 4, tmax: 9 }); // 기온 5일째(11-20)
  });
});

describe("mergeDays: 단기 우선(D-01)", () => {
  const day = (source: DayForecast["source"], pop: number): DayForecast => ({ sky: 1, precip: null, pop, tmin: 1, tmax: 2, source });

  it("같은 날이면 단기 값, 단기에 없는 날은 중기 값", () => {
    const merged = mergeDays({ "2026-11-19": day("short", 10) }, { "2026-11-19": day("mid", 90), "2026-11-20": day("mid", 80) });
    expect(merged["2026-11-19"]).toEqual(day("short", 10));
    expect(merged["2026-11-20"]).toEqual(day("mid", 80));
  });

  it("날짜 순서로 돌려준다", () => {
    const merged = mergeDays({ "2026-11-21": day("short", 1) }, { "2026-11-19": day("mid", 2), "2026-11-23": day("mid", 3) });
    expect(Object.keys(merged)).toEqual(["2026-11-19", "2026-11-21", "2026-11-23"]);
  });

  it("한쪽이 비어도 다른 쪽이 그대로 나온다", () => {
    expect(mergeDays({}, { "2026-11-19": day("mid", 2) })).toEqual({ "2026-11-19": day("mid", 2) });
    expect(mergeDays({ "2026-11-19": day("short", 2) }, {})).toEqual({ "2026-11-19": day("short", 2) });
  });
});
