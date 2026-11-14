// 날짜 하나의 날씨 화면 값(D-08~D-10): 시마다 줄 / 지난 날 / 범위 밖 / 예보 없음, 바깥 장소 주의.
// 확정 화면(TripView)과 공유 화면(shareToTripView) 양쪽에서 같은 값이 나와야 한다.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { toShareDoc } from "../../src/lib/share/doc";
import { shareToTripView } from "../../src/lib/share/view";
import type { TripView } from "../../src/lib/trip/view";
import type { Place } from "../../src/lib/types";
import { FORECAST_MAX_DAYS, classifyDay, dayCautions, dayRegions, dayWeatherView, hasShownWeather, type DayWeatherView } from "../../src/lib/weather/day-view";
import { readPayload, type WeatherPayload } from "../../src/lib/weather/types";

const read = (p: string) => JSON.parse(readFileSync(resolve(__dirname, p), "utf8")) as unknown;
const trip = read("../e2e/fixtures/trip-view.json") as TripView;
const allPlaces = read("../../data/places.json") as Place[];
const weatherJson = read("../e2e/fixtures/weather.json") as Record<string, unknown>;

const payloadFor = (today: string): WeatherPayload => readPayload({ ...weatherJson, today })!;
const payload = payloadFor("2026-11-18");
const o = trip.options[0];
const day1 = o.days[0];
const day2 = o.days[1];

describe("classifyDay", () => {
  it("지난 날 / 10일 안 / 10일 넘게 남음", () => {
    expect(FORECAST_MAX_DAYS).toBe(10);
    expect(classifyDay("2026-11-17", "2026-11-18")).toBe("past");
    expect(classifyDay("2026-11-18", "2026-11-18")).toBe("near");
    expect(classifyDay("2026-11-28", "2026-11-18")).toBe("near"); // 정확히 10일 뒤
    expect(classifyDay("2026-11-29", "2026-11-18")).toBe("far"); // 11일 뒤
  });
});

describe("dayRegions", () => {
  it("그날 방문 장소의 시를 첫 방문 순서로 중복 없이", () => {
    expect(dayRegions(day1, trip.places)).toEqual(["강릉"]);
    const places = { ...trip.places, GN33: { ...trip.places.GN33, region: "속초" as const } };
    expect(dayRegions(day1, places)).toEqual(["강릉", "속초"]);
  });

  it("방문이 없으면 빈 배열", () => {
    expect(dayRegions({ ...day1, items: day1.items.filter((i) => i.kind !== "visit") }, trip.places)).toEqual([]);
  });
});

describe("dayWeatherView", () => {
  it("1일째: 시 하나면 줄 하나", () => {
    const v = dayWeatherView(day1, trip.places, payload);
    expect(v).toEqual({ kind: "lines", lines: [{ region: "강릉", text: "강릉 · 흐림 · 비 70% · 8~14℃", icon: "rain", hasForecast: true }] });
  });

  it("시가 둘이면 두 줄(첫 방문 순서)", () => {
    const places = { ...trip.places, GN33: { ...trip.places.GN33, region: "속초" as const } };
    const v = dayWeatherView(day1, places, payload);
    expect(v).toEqual({
      kind: "lines",
      lines: [
        { region: "강릉", text: "강릉 · 흐림 · 비 70% · 8~14℃", icon: "rain", hasForecast: true },
        { region: "속초", text: "속초 · 맑음 · 비 10% · 5~12℃", icon: "sun", hasForecast: true },
      ],
    });
  });

  it("2일째: 그날 값이 없으면 '예보 없음'으로 숨기지 않고 알린다", () => {
    expect(dayWeatherView(day2, trip.places, payload)).toEqual({ kind: "lines", lines: [{ region: "강릉", text: "강릉 · 예보 없음", icon: null, hasForecast: false }] });
  });

  it("출발까지 10일보다 많이 남으면 안내 한 줄", () => {
    expect(dayWeatherView(day1, trip.places, payloadFor("2026-11-05"))).toEqual({ kind: "note", text: "아직 예보 없음 · 출발 약 10일 전부터 나와요" });
    expect(dayWeatherView(day2, trip.places, payloadFor("2026-11-05"))).toEqual({ kind: "note", text: "아직 예보 없음 · 출발 약 10일 전부터 나와요" });
  });

  it("지난 날짜는 안내 한 줄", () => {
    expect(dayWeatherView(day1, trip.places, payloadFor("2026-11-25"))).toEqual({ kind: "note", text: "지난 일정이라 예보를 보여 주지 않아요" });
    expect(dayWeatherView(day2, trip.places, payloadFor("2026-11-25"))).toEqual({ kind: "note", text: "지난 일정이라 예보를 보여 주지 않아요" });
  });

  it("날씨를 못 받았거나(null) 방문이 없으면 null", () => {
    expect(dayWeatherView(day1, trip.places, null)).toBeNull();
    expect(dayWeatherView({ ...day1, items: [] }, trip.places, payload)).toBeNull();
  });
});

describe("dayCautions", () => {
  it("1일째: 바깥 장소(GN33 경포해수욕장)에만 붙고 실내(GN12·GN05)에는 없다", () => {
    const m = dayCautions(day1, trip.places, payload);
    expect([...m.keys()]).toEqual(["GN33"]);
    expect(m.get("GN33")).toBe("비 예보 — 데크·경사로가 미끄러울 수 있어요");
  });

  it("GN33이 속초면 그 시는 비 10%라 주의가 없다", () => {
    const places = { ...trip.places, GN33: { ...trip.places.GN33, region: "속초" as const } };
    expect(dayCautions(day1, places, payload).size).toBe(0);
  });

  it("예보 없는 날·범위 밖·지난 날·날씨 없음은 주의도 없다", () => {
    expect(dayCautions(day2, trip.places, payload).size).toBe(0);
    expect(dayCautions(day1, trip.places, payloadFor("2026-11-05")).size).toBe(0);
    expect(dayCautions(day1, trip.places, payloadFor("2026-11-25")).size).toBe(0);
    expect(dayCautions(day1, trip.places, null).size).toBe(0);
  });
});

describe("공유 화면 값(WX-02 공유)", () => {
  it("같은 줄·같은 주의가 나온다", () => {
    const shared = shareToTripView(toShareDoc(trip, o), "Ab3dE5gH9k", allPlaces);
    const d = shared.options[0].days[0];
    expect(d.date).toBe("2026-11-21");
    expect(dayWeatherView(d, shared.places, payload)).toEqual(dayWeatherView(day1, trip.places, payload));
    expect([...dayCautions(d, shared.places, payload)]).toEqual([...dayCautions(day1, trip.places, payload)]);
    expect(dayCautions(d, shared.places, payload).get("GN33")).toBe("비 예보 — 데크·경사로가 미끄러울 수 있어요");
  });
});

describe("hasShownWeather", () => {
  const lines: DayWeatherView = { kind: "lines", lines: [{ region: "강릉", text: "강릉 · 흐림", icon: "cloud", hasForecast: true }] };
  const missing: DayWeatherView = { kind: "lines", lines: [{ region: "강릉", text: "강릉 · 예보 없음", icon: null, hasForecast: false }] };
  const note: DayWeatherView = { kind: "note", text: "아직 예보 없음 · 출발 약 10일 전부터 나와요" };

  it("예보가 있는 줄이 하나라도 있으면 참", () => {
    expect(hasShownWeather([note, lines])).toBe(true);
    expect(hasShownWeather([missing, lines])).toBe(true);
  });

  it("안내·예보 없음·null뿐이면 거짓", () => {
    expect(hasShownWeather([note, missing, null])).toBe(false);
    expect(hasShownWeather([])).toBe(false);
  });
});
