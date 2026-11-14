// 비·눈 주의(D-10, D-13): 강수확률 60% 이상이고 바깥 장소일 때만. 코드 규칙이고 LLM이 쓰지 않는다.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CATEGORIES, type Category, type Place } from "../../src/lib/types";
import { OUTDOOR_CATEGORIES, RAIN_POP_THRESHOLD, isOutdoorPlace, rainCaution } from "../../src/lib/weather/caution";
import type { DayForecast } from "../../src/lib/weather/types";

const day = (over: Partial<DayForecast> = {}): DayForecast => ({ sky: 4, precip: "비", pop: 60, tmin: 8, tmax: 14, source: "short", ...over });

describe("rainCaution", () => {
  it("기준은 60%다", () => {
    expect(RAIN_POP_THRESHOLD).toBe(60);
  });

  it("59%는 주의가 없고 60%부터 있다", () => {
    expect(rainCaution(day({ pop: 59 }))).toBeNull();
    expect(rainCaution(day({ pop: 60 }))).toBe("비 예보 — 데크·경사로가 미끄러울 수 있어요");
  });

  it("눈·비/눈은 낱말이 바뀐다", () => {
    expect(rainCaution(day({ pop: 70, precip: "눈" }))).toBe("눈 예보 — 데크·경사로가 미끄러울 수 있어요");
    expect(rainCaution(day({ pop: 80, precip: "비/눈" }))).toBe("비·눈 예보 — 데크·경사로가 미끄러울 수 있어요");
  });

  it("강수 종류를 모르면(precip 없음) 비로 쓴다", () => {
    expect(rainCaution(day({ pop: 90, precip: null }))).toBe("비 예보 — 데크·경사로가 미끄러울 수 있어요");
  });

  it("값이 없으면 주의도 없다(지어내지 않는다)", () => {
    expect(rainCaution(day({ pop: null }))).toBeNull();
    expect(rainCaution(undefined)).toBeNull();
  });
});

describe("isOutdoorPlace", () => {
  it("바다·해변, 자연·산책만 바깥이다", () => {
    expect([...OUTDOOR_CATEGORIES]).toEqual(["바다·해변", "자연·산책"]);
    const outdoor = CATEGORIES.filter((c: Category) => isOutdoorPlace({ category: c }));
    expect(outdoor).toEqual(["바다·해변", "자연·산책"]);
    expect(CATEGORIES.filter((c: Category) => !isOutdoorPlace({ category: c }))).toHaveLength(4);
  });
});

// D-13 불변식: 카테고리로 정한 바깥 장소 = 관광공사 분류 '야외 시설'(근거 class-1 글 끝). 데이터가 바뀌어 어긋나면 여기서 알린다.
describe("바깥 장소 판정은 관광공사 '야외 시설' 분류와 같다", () => {
  const places = JSON.parse(readFileSync(resolve(__dirname, "../../data/places.json"), "utf8")) as Place[];
  const evidence = JSON.parse(readFileSync(resolve(__dirname, "../../data/evidence.json"), "utf8")) as Record<string, { id: string; text: string }[]>;

  it("152곳 모두 같고 바깥은 70곳이다", () => {
    expect(places).toHaveLength(152);
    const mismatched: string[] = [];
    let outdoor = 0;
    for (const p of places) {
      const cls = evidence[p.id]?.find((e) => e.id === "class-1")?.text ?? "";
      const official = cls.includes("야외 시설");
      if (isOutdoorPlace(p)) outdoor++;
      if (isOutdoorPlace(p) !== official) mismatched.push(`${p.id} ${p.name_ko} ${p.category}`);
    }
    expect(mismatched).toEqual([]);
    expect(outdoor).toBe(70);
  });
});
