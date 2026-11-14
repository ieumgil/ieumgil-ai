// 한국 시간(KST) 계산: 서버가 UTC여도 같은 값이 나와야 한다(기기 시간대에 기대지 않는다).
import { describe, expect, it } from "vitest";
import { addDaysISO, daysBetweenISO, kstDate, kstHour, pickShortBase } from "../../src/lib/weather/kst";

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
