// 단기예보 항목 → 날짜별 하루 값. 픽스처는 공식 활용가이드 예제 모양으로 손으로 만든 값([ASSUMED])이다.
// 오늘은 KST 2026-11-15 17시(가짜 시계 17:30)로 둔다: 오늘의 지난 시각은 빠지고, 오늘 전 날짜는 없다.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { summarizeShort } from "../../src/lib/weather/summary";
import type { ShortItem } from "../../src/lib/weather/types";

const fixture = JSON.parse(readFileSync(resolve(__dirname, "../fixtures/weather/short-gangneung.json"), "utf8")) as {
  response: { body: { items: { item: ShortItem[] } } };
};
const items = fixture.response.body.items.item;

const TODAY = "2026-11-15";
const NOW_HOUR = 17;
const run = (list: ShortItem[]) => summarizeShort(list, TODAY, NOW_HOUR);
const row = (category: string, fcstTime: string, fcstValue: string, fcstDate = "20261116"): ShortItem => ({ category, fcstDate, fcstTime, fcstValue });

describe("summarizeShort: 픽스처 날짜별 하루 값", () => {
  const out = run(items);

  it("2026-11-14(오늘 전 날짜)는 결과에 없다", () => {
    expect(Object.keys(out)).not.toContain("2026-11-14");
  });

  it("2026-11-15(오늘): 16시 행은 지난 시각이라 빠지고 TMN/TMX가 없어 TMP로 채워 approxTemp", () => {
    // 1600(POP 80, SKY 4, TMP 12)이 들어갔다면 pop 80·sky 4·tmax 12가 됐을 것
    expect(out["2026-11-15"]).toEqual({ sky: 1, precip: null, pop: 20, tmin: 5, tmax: 10, source: "short", approxTemp: true });
  });

  it("오늘 오후에 연 화면: 이미 지난 TMN·TMX 행은 쓰지 않고 남은 시각의 TMP로 채우되 approxTemp로 표시한다(WR-01)", () => {
    const list = [
      row("TMN", "0600", "3.0", "20261115"),
      row("TMX", "1500", "18.0", "20261115"),
      row("POP", "1800", "20", "20261115"),
      row("TMP", "1800", "11", "20261115"),
      row("TMP", "2100", "8", "20261115"),
    ];
    expect(run(list)["2026-11-15"]).toMatchObject({ tmin: 8, tmax: 11, approxTemp: true });
  });

  it("2026-11-16: 낮 창(06~21시) 강수확률 최댓값 30, 하늘 4(동률이면 더 흐림), 기온 3~11, approxTemp 없음", () => {
    expect(out["2026-11-16"]).toEqual({ sky: 4, precip: null, pop: 30, tmin: 3, tmax: 11, source: "short" });
  });

  it("2026-11-17: 비(PTY 1), 강수확률 최댓값 70", () => {
    expect(out["2026-11-17"]).toEqual({ sky: 4, precip: "비", pop: 70, tmin: 5, tmax: 13, source: "short" });
  });

  it("2026-11-18: 눈(PTY 3), 결측(-999) 기온은 무시", () => {
    expect(out["2026-11-18"]).toMatchObject({ precip: "눈", pop: 80, tmin: -1, tmax: 4 });
    expect(out["2026-11-18"]).not.toHaveProperty("approxTemp");
  });

  it("2026-11-19(그글피, 3시간 간격): PTY는 모두 0이어도 강수확률 60%면 안전 쪽으로 '비'", () => {
    expect(out["2026-11-19"]).toEqual({ sky: 3, precip: "비", pop: 60, tmin: 2, tmax: 9, source: "short" });
  });
});

describe("summarizeShort: 낮 창·하늘·기온 기본 규칙", () => {
  it("새벽 3시의 강수확률 90과 하늘은 하루 값에 들어가지 않는다", () => {
    expect(run(items)["2026-11-16"].pop).toBe(30);
  });

  it("하늘 상태 동률이면 더 흐린 코드(4 > 3 > 1)", () => {
    const tie = [row("SKY", "0600", "1"), row("SKY", "0900", "1"), row("SKY", "1200", "3"), row("SKY", "1500", "3")];
    expect(run(tie)["2026-11-16"].sky).toBe(3);
    const tie2 = [row("SKY", "0600", "3"), row("SKY", "0900", "4"), row("SKY", "1200", "4"), row("SKY", "1500", "3")];
    expect(run(tie2)["2026-11-16"].sky).toBe(4);
  });

  it("TMN·TMX가 없으면 TMP 최솟값·최댓값을 쓰고 approxTemp를 켠다", () => {
    const day = run([row("SKY", "0900", "1"), row("TMP", "0900", "6.0"), row("TMP", "1500", "12.0")])["2026-11-16"];
    expect(day.tmin).toBe(6);
    expect(day.tmax).toBe(12);
    expect(day.approxTemp).toBe(true);
  });

  it("TMN만 있고 TMX가 없으면 최고 기온만 TMP로 채우고 approxTemp", () => {
    const day = run([row("TMN", "0600", "2.0"), row("TMP", "1200", "9.0"), row("POP", "1200", "10")])["2026-11-16"];
    expect(day).toMatchObject({ tmin: 2, tmax: 9, approxTemp: true });
  });

  it("TMN·TMX가 둘 다 있으면 approxTemp가 없다", () => {
    const day = run([row("TMN", "0600", "2.0"), row("TMX", "1500", "9.0"), row("POP", "1200", "10")])["2026-11-16"];
    expect(day).not.toHaveProperty("approxTemp");
  });

  it("기온이 하나도 없으면 null이고 approxTemp는 없다", () => {
    const day = run([row("POP", "1200", "10")])["2026-11-16"];
    expect(day).toMatchObject({ tmin: null, tmax: null });
    expect(day).not.toHaveProperty("approxTemp");
  });

  it("낮 창 안에 행이 없는 날은 넣지 않고, 날짜마다 따로 묶는다", () => {
    const out = run([row("POP", "0300", "80"), row("POP", "1200", "40", "20261117")]);
    expect(Object.keys(out)).toEqual(["2026-11-17"]);
    expect(out["2026-11-17"].pop).toBe(40);
  });
});

describe("summarizeShort: 강수 종류(PTY)", () => {
  const withPty = (...values: string[]) => [...values.map((v, i) => row("PTY", ["0600", "0900", "1200", "1500", "1800", "2100"][i], v)), row("POP", "1200", "30")];

  it("PTY 2(비/눈) → '비/눈'", () => {
    expect(run(withPty("0", "2", "0"))["2026-11-16"].precip).toBe("비/눈");
  });

  it("PTY 3(눈)과 1(비)이 섞이면 '비/눈'", () => {
    expect(run(withPty("3", "0", "1"))["2026-11-16"].precip).toBe("비/눈");
  });

  it("PTY 4(소나기)만 → '비'", () => {
    expect(run(withPty("0", "4", "0"))["2026-11-16"].precip).toBe("비");
  });

  it("PTY 3만 → '눈', PTY 1만 → '비'", () => {
    expect(run(withPty("0", "3"))["2026-11-16"].precip).toBe("눈");
    expect(run(withPty("1", "0"))["2026-11-16"].precip).toBe("비");
  });

  it("모두 0이고 강수확률이 60 미만이면 null, 60 이상이면 '비'(안전 쪽)", () => {
    expect(run([...withPty("0", "0")])["2026-11-16"].precip).toBeNull();
    expect(run([row("PTY", "1200", "0"), row("POP", "1200", "60")])["2026-11-16"].precip).toBe("비");
    expect(run([row("PTY", "1200", "0"), row("POP", "1200", "59")])["2026-11-16"].precip).toBeNull();
  });

  it("창 밖(새벽)의 PTY는 종류를 정하지 않는다", () => {
    expect(run([row("PTY", "0300", "1"), row("POP", "1200", "10")])["2026-11-16"].precip).toBeNull();
  });
});

describe("summarizeShort: 범위 밖·결측 값 무시", () => {
  it("POP 150, SKY 2, 숫자가 아닌 값은 무시하고 남은 값으로 정한다", () => {
    const out = run([row("POP", "1200", "150"), row("POP", "1500", "20"), row("SKY", "1200", "2"), row("SKY", "1500", "3"), row("PTY", "1200", "abc"), row("TMP", "1200", "x")]);
    expect(out["2026-11-16"]).toMatchObject({ pop: 20, sky: 3, precip: null, tmin: null, tmax: null });
  });

  it("절댓값 900 이상은 결측으로 버린다(-999, 999)", () => {
    const day = run([row("TMP", "0900", "-999"), row("TMP", "1200", "999"), row("TMP", "1500", "8.0"), row("POP", "1200", "10")])["2026-11-16"];
    expect(day).toMatchObject({ tmin: 8, tmax: 8 });
  });

  it("창 안 행이 모두 무시되면 그날은 없다", () => {
    const out = run([row("POP", "1200", "150"), row("SKY", "1500", "2"), row("TMP", "0900", "-999"), row("POP", "0300", "30")]);
    expect(Object.keys(out)).toEqual([]);
  });
});

describe("summarizeShort: 오늘의 지난 시각", () => {
  it("오늘은 지금 시(17)보다 이른 행을 모든 카테고리에서 뺀다(17시 행은 남는다)", () => {
    const list = [row("POP", "1600", "90", "20261115"), row("POP", "1700", "40", "20261115"), row("TMN", "0600", "1.0", "20261115"), row("TMP", "1700", "9.0", "20261115")];
    expect(run(list)["2026-11-15"]).toEqual({ sky: null, precip: null, pop: 40, tmin: 9, tmax: 9, source: "short", approxTemp: true });
  });

  it("지난 시각만 있는 오늘은 결과에 없다", () => {
    expect(Object.keys(run([row("POP", "1200", "50", "20261115")]))).toEqual([]);
  });

  it("오늘이 아닌 날(내일 이후)은 시각을 자르지 않는다", () => {
    expect(run([row("POP", "0900", "55")])["2026-11-16"].pop).toBe(55);
  });
});

describe("summarizeShort: 실제 응답에만 있던 모양(2026-11-15 프로브)", () => {
  it('시간별 기온이 정수 문자열("12")이어도 읽고, 쓰지 않는 카테고리(PCP·SNO·UUU·WSD 등)와 글자 값은 결과에 영향이 없다', () => {
    const base = [row("POP", "0900", "30"), row("SKY", "0900", "3"), row("PTY", "0900", "0"), row("TMP", "0900", "12"), row("TMP", "1500", "16")];
    const noise = [
      row("PCP", "0900", "1mm 미만"),
      row("PCP", "1200", "강수없음"),
      row("PCP", "1500", "1.0mm"),
      row("SNO", "0900", "적설없음"),
      row("SNO", "1200", "0"),
      row("UUU", "0900", "-0.5"),
      row("VVV", "0900", "-1.2"),
      row("VEC", "0900", "350"),
      row("WSD", "0900", "1.4"),
      row("WAV", "0900", "0"),
      row("REH", "0900", "90"),
    ];
    const clean = run(base)["2026-11-16"];
    expect(clean).toEqual({ sky: 3, precip: null, pop: 30, tmin: 12, tmax: 16, source: "short", approxTemp: true });
    expect(run([...base, ...noise])["2026-11-16"]).toEqual(clean);
  });
});
