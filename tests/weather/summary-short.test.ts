// 단기예보 항목 → 날짜별 하루 값. 픽스처는 공식 활용가이드 예제 모양으로 손으로 만든 값([ASSUMED])이다.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { summarizeShort } from "../../src/lib/weather/summary";
import type { ShortItem } from "../../src/lib/weather/types";

const fixture = JSON.parse(readFileSync(resolve(__dirname, "../fixtures/weather/short-gangneung.json"), "utf8")) as {
  response: { body: { items: { item: ShortItem[] } } };
};
const items = fixture.response.body.items.item;

const row = (category: string, fcstTime: string, fcstValue: string, fcstDate = "20261116"): ShortItem => ({ category, fcstDate, fcstTime, fcstValue });

describe("summarizeShort", () => {
  it("2026-11-16 하루 값: 낮 창(06~21시) 강수확률 최댓값 30, 하늘 4(동률이면 더 흐림), 기온 3~11", () => {
    expect(summarizeShort(items)["2026-11-16"]).toEqual({ sky: 4, precip: null, pop: 30, tmin: 3, tmax: 11, source: "short" });
  });

  it("새벽 3시의 강수확률 90과 하늘은 하루 값에 들어가지 않는다", () => {
    const day = summarizeShort(items)["2026-11-16"];
    expect(day.pop).toBe(30);
  });

  it("하늘 상태 동률이면 더 흐린 코드(4 > 3 > 1)", () => {
    const tie = [row("SKY", "0600", "1"), row("SKY", "0900", "1"), row("SKY", "1200", "3"), row("SKY", "1500", "3")];
    expect(summarizeShort(tie)["2026-11-16"].sky).toBe(3);
    const tie2 = [row("SKY", "0600", "3"), row("SKY", "0900", "4"), row("SKY", "1200", "4"), row("SKY", "1500", "3")];
    expect(summarizeShort(tie2)["2026-11-16"].sky).toBe(4);
  });

  it("TMN·TMX가 없으면 TMP 최솟값·최댓값을 쓴다", () => {
    const day = summarizeShort([row("SKY", "0900", "1"), row("TMP", "0900", "6.0"), row("TMP", "1500", "12.0")])["2026-11-16"];
    expect(day.tmin).toBe(6);
    expect(day.tmax).toBe(12);
  });

  it("낮 창 안에 행이 없는 날은 넣지 않고, 날짜마다 따로 묶는다", () => {
    const out = summarizeShort([row("POP", "0300", "80"), row("POP", "1200", "40", "20261117")]);
    expect(Object.keys(out)).toEqual(["2026-11-17"]);
    expect(out["2026-11-17"].pop).toBe(40);
  });
});
