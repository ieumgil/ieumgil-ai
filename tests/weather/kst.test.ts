// 한국 시간(KST) 계산: 서버가 UTC여도 같은 값이 나와야 한다(기기 시간대에 기대지 않는다).
import { describe, expect, it } from "vitest";
import { addDaysISO, daysBetweenISO, kstDate, kstHour, pickMidTmFc, pickShortBase, prevMidTmFc, prevShortBase } from "../../src/lib/weather/kst";

describe("kstDate / kstHour", () => {
  it("UTC 15:30은 한국 시간으로 다음 날 0시 30분", () => {
    const now = new Date("2026-11-14T15:30:00Z");
    expect(kstDate(now)).toBe("2026-11-15");
    expect(kstHour(now)).toBe(0);
  });

  it("UTC 08:30은 같은 날 17시", () => {
    const now = new Date("2026-11-15T08:30:00Z");
    expect(kstDate(now)).toBe("2026-11-15");
    expect(kstHour(now)).toBe(17);
  });
});

describe("pickShortBase: 발표 +15분 지난 가장 늦은 발표", () => {
  const at = (kst: string) => new Date(new Date(`${kst}+09:00`).getTime());

  it("02:09, 02:14는 아직 02시 발표가 없어 전날 2300", () => {
    expect(pickShortBase(at("2026-11-16T02:09:00"))).toEqual({ baseDate: "20261115", baseTime: "2300" });
    expect(pickShortBase(at("2026-11-16T02:14:00"))).toEqual({ baseDate: "20261115", baseTime: "2300" });
  });

  it("02:15부터 당일 0200", () => {
    expect(pickShortBase(at("2026-11-16T02:15:00"))).toEqual({ baseDate: "20261116", baseTime: "0200" });
  });

  it("자정 직후(00:30)는 전날 2300", () => {
    expect(pickShortBase(at("2026-11-16T00:30:00"))).toEqual({ baseDate: "20261115", baseTime: "2300" });
  });

  it("17:30은 1700", () => {
    expect(pickShortBase(at("2026-11-15T17:30:00"))).toEqual({ baseDate: "20261115", baseTime: "1700" });
  });

  it("서버가 UTC여도 같은 값(UTC 08:30 = KST 17:30)", () => {
    expect(pickShortBase(new Date("2026-11-15T08:30:00Z"))).toEqual({ baseDate: "20261115", baseTime: "1700" });
  });

  it("여유 분을 바꿀 수 있다(0분이면 02:10에도 0200)", () => {
    expect(pickShortBase(at("2026-11-16T02:00:00"), 0)).toEqual({ baseDate: "20261116", baseTime: "0200" });
  });
});

describe("prevShortBase: 한 칸 앞 발표(발표 직후 데이터 없음(03)일 때 재시도용)", () => {
  it("1700의 앞은 같은 날 1400", () => {
    expect(prevShortBase({ baseDate: "20261115", baseTime: "1700" })).toEqual({ baseDate: "20261115", baseTime: "1400" });
  });

  it("0200의 앞은 전날 2300", () => {
    expect(prevShortBase({ baseDate: "20261115", baseTime: "0200" })).toEqual({ baseDate: "20261114", baseTime: "2300" });
  });

  it("달을 넘긴다(12월 1일 0200 → 11월 30일 2300)", () => {
    expect(prevShortBase({ baseDate: "20261201", baseTime: "0200" })).toEqual({ baseDate: "20261130", baseTime: "2300" });
  });

  it("해를 넘긴다(1월 1일 0200 → 전년 12월 31일 2300)", () => {
    expect(prevShortBase({ baseDate: "20270101", baseTime: "0200" })).toEqual({ baseDate: "20261231", baseTime: "2300" });
  });
});

describe("날짜 문자열 계산", () => {
  it("월말을 넘겨 더한다", () => {
    expect(addDaysISO("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDaysISO("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysISO("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("두 날짜 사이 일수", () => {
    expect(daysBetweenISO("2026-11-15", "2026-11-25")).toBe(10);
    expect(daysBetweenISO("2026-11-25", "2026-11-15")).toBe(-10);
    expect(daysBetweenISO("2026-11-15", "2026-11-15")).toBe(0);
  });
});

describe("pickMidTmFc: 06·18시 발표를 30분 지난 뒤에 쓴다", () => {
  const at = (kst: string) => new Date(`${kst}+09:00`);

  it("05:59는 전날 1800", () => {
    expect(pickMidTmFc(at("2026-11-15T05:59:00"))).toBe("202611141800");
  });

  it("06:29도 아직 전날 1800", () => {
    expect(pickMidTmFc(at("2026-11-15T06:29:00"))).toBe("202611141800");
  });

  it("06:30부터 당일 0600", () => {
    expect(pickMidTmFc(at("2026-11-15T06:30:00"))).toBe("202611150600");
  });

  it("18:29까지 당일 0600", () => {
    expect(pickMidTmFc(at("2026-11-15T18:29:00"))).toBe("202611150600");
  });

  it("18:30부터 당일 1800", () => {
    expect(pickMidTmFc(at("2026-11-15T18:30:00"))).toBe("202611151800");
  });

  it("새벽 03:00은 전날 1800", () => {
    expect(pickMidTmFc(at("2026-11-15T03:00:00"))).toBe("202611141800");
  });

  it("UTC로 준 시각도 한국 시간으로 바꿔 계산한다(UTC 21:30 = KST 다음 날 06:30)", () => {
    expect(pickMidTmFc(new Date("2026-11-14T21:30:00Z"))).toBe("202611150600");
    expect(pickMidTmFc(new Date("2026-11-14T18:00:00Z"))).toBe("202611141800"); // KST 11-15 03:00
  });

  it("달을 넘긴다(12월 1일 03:00 → 11월 30일 1800)", () => {
    expect(pickMidTmFc(at("2026-12-01T03:00:00"))).toBe("202611301800");
  });
});

describe("prevMidTmFc: 한 칸 앞 발표(발표 직후 데이터 없음(03)일 때 재시도용)", () => {
  it("0600의 앞은 전날 1800", () => {
    expect(prevMidTmFc("202611150600")).toBe("202611141800");
  });

  it("1800의 앞은 같은 날 0600", () => {
    expect(prevMidTmFc("202611151800")).toBe("202611150600");
  });
});
