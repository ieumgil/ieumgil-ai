// 날씨 문구는 코드의 고정 문구만(D-06). LLM이 쓰지 않는다.
import { describe, expect, it } from "vitest";
import { MISSING_TEXT, OUT_OF_RANGE_TEXT, PAST_TEXT, precipWord, sourceLine, weatherIcon, weatherLine } from "../../src/lib/weather/labels";
import type { DayForecast, WeatherPayload } from "../../src/lib/weather/types";

const day = (over: Partial<DayForecast> = {}): DayForecast => ({ sky: 4, precip: null, pop: 20, tmin: 8, tmax: 14, source: "short", ...over });

describe("weatherLine", () => {
  it("시 · 하늘 · 강수확률 · 기온 한 줄", () => {
    expect(weatherLine("강릉", day())).toBe("강릉 · 흐림 · 비 20% · 8~14℃");
  });

  it("하늘 상태 이름", () => {
    expect(weatherLine("속초", day({ sky: 1 }))).toContain("속초 · 맑음");
    expect(weatherLine("동해", day({ sky: 3 }))).toContain("동해 · 구름많음");
  });

  it("강수확률이 없으면 확률 조각을 뺀다", () => {
    expect(weatherLine("강릉", day({ pop: null }))).toBe("강릉 · 흐림 · 8~14℃");
  });

  it("기온이 둘 다 없으면 기온을 빼고, 하나만 있으면 최저/최고로 쓴다", () => {
    expect(weatherLine("강릉", day({ tmin: null, tmax: null }))).toBe("강릉 · 흐림 · 비 20%");
    expect(weatherLine("강릉", day({ tmin: 5, tmax: null }))).toBe("강릉 · 흐림 · 비 20% · 최저 5℃");
    expect(weatherLine("강릉", day({ tmin: null, tmax: 14 }))).toBe("강릉 · 흐림 · 비 20% · 최고 14℃");
  });

  it("눈·비눈은 확률 앞 낱말이 바뀐다", () => {
    expect(weatherLine("강릉", day({ precip: "눈", pop: 70 }))).toBe("강릉 · 흐림 · 눈 70% · 8~14℃");
    expect(weatherLine("강릉", day({ precip: "비/눈", pop: 70 }))).toBe("강릉 · 흐림 · 비·눈 70% · 8~14℃");
  });

  it("기온은 반올림한다(13.6 → 14)", () => {
    expect(weatherLine("강릉", day({ tmin: 7.6, tmax: 13.6 }))).toBe("강릉 · 흐림 · 비 20% · 8~14℃");
  });

  it("하늘 정보가 없어도 시와 나머지는 나온다", () => {
    expect(weatherLine("강릉", day({ sky: null }))).toBe("강릉 · 비 20% · 8~14℃");
  });
});

describe("precipWord / weatherIcon", () => {
  it("낱말", () => {
    expect(precipWord("눈")).toBe("눈");
    expect(precipWord("비/눈")).toBe("비·눈");
    expect(precipWord("비")).toBe("비");
    expect(precipWord(null)).toBe("비");
  });

  it("아이콘 이름: 눈·비가 하늘보다 앞선다", () => {
    expect(weatherIcon(day({ precip: "눈" }))).toBe("snow");
    expect(weatherIcon(day({ precip: "비/눈" }))).toBe("snow");
    expect(weatherIcon(day({ precip: "비", sky: 1 }))).toBe("rain");
    expect(weatherIcon(day({ sky: 1 }))).toBe("sun");
    expect(weatherIcon(day({ sky: 3 }))).toBe("cloud-sun");
    expect(weatherIcon(day({ sky: 4 }))).toBe("cloud");
    expect(weatherIcon(day({ sky: null }))).toBeNull();
  });
});

describe("날짜 상태 문구(D-09)", () => {
  it("고정 문구", () => {
    expect(PAST_TEXT).toBe("지난 일정이라 예보를 보여 주지 않아요");
    expect(OUT_OF_RANGE_TEXT).toBe("아직 예보 없음 · 출발 약 10일 전부터 나와요");
    expect(MISSING_TEXT).toBe("예보 없음");
  });
});

describe("sourceLine(D-11)", () => {
  const payload = (asOf: WeatherPayload["asOf"]): WeatherPayload => ({ available: true, today: "2026-11-18", asOf, regions: {} });

  it("단기·중기 둘 다: 늦은 발표 시각", () => {
    expect(sourceLine(payload({ short: { baseDate: "20261118", baseTime: "1700" }, mid: "202611180600" }))).toBe(
      "날씨: 기상청 단기·중기예보(11월 18일 17시 발표). 예보는 바뀔 수 있어요.",
    );
  });

  it("단기만", () => {
    expect(sourceLine(payload({ short: { baseDate: "20261118", baseTime: "0200" } }))).toBe("날씨: 기상청 단기예보(11월 18일 2시 발표). 예보는 바뀔 수 있어요.");
  });

  it("중기만(앞자리 0 없이)", () => {
    expect(sourceLine(payload({ mid: "202611180600" }))).toBe("날씨: 기상청 중기예보(11월 18일 6시 발표). 예보는 바뀔 수 있어요.");
  });

  it("둘 다 없거나 날씨가 없으면 null", () => {
    expect(sourceLine(payload({}))).toBeNull();
    expect(sourceLine(null)).toBeNull();
  });
});
