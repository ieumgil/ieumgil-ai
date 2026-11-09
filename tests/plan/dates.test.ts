import { describe, expect, it } from "vitest";
import { formatRange, monthCells, nightsBetween, pickDate, tripLabel, weekdayOf } from "@/lib/plan/dates";

describe("날짜 계산", () => {
  it("박 수와 이름", () => {
    expect(nightsBetween("2026-11-21", "2026-11-21")).toBe(0);
    expect(nightsBetween("2026-11-30", "2026-12-02")).toBe(2);
    expect(tripLabel(0)).toBe("당일");
    expect(tripLabel(1)).toBe("1박 2일");
    expect(tripLabel(2)).toBe("2박 3일");
  });

  it("요일과 범위 표시", () => {
    expect(weekdayOf("2026-11-21")).toBe("토");
    expect(formatRange("2026-11-21", "2026-11-22")).toBe("11월 21일(토) ~ 22일(일)");
    expect(formatRange("2026-11-30", "2026-12-01")).toBe("11월 30일(월) ~ 12월 1일(화)");
    expect(formatRange("2026-11-21", "2026-11-21")).toBe("11월 21일(토)");
  });

  it("2026년 11월 달력은 일요일에 시작하고 7칸 단위다", () => {
    const cells = monthCells(2026, 11);
    expect(cells[0]).toBe("2026-11-01"); // 11월 1일은 일요일
    expect(cells.length % 7).toBe(0);
    expect(cells.filter(Boolean)).toHaveLength(30);
  });

  it("날짜 고르기: 시작 → 끝 → 다시 시작", () => {
    let r = pickDate({ start: null, end: null }, "2026-11-21");
    expect(r).toEqual({ start: "2026-11-21", end: "2026-11-21" });
    r = pickDate(r, "2026-11-22");
    expect(r).toEqual({ start: "2026-11-21", end: "2026-11-22" });
    r = pickDate(r, "2026-11-25");
    expect(r).toEqual({ start: "2026-11-25", end: "2026-11-25" });
  });

  it("시작보다 앞 날을 누르면 새 시작이 된다", () => {
    expect(pickDate({ start: "2026-11-21", end: "2026-11-21" }, "2026-11-19")).toEqual({
      start: "2026-11-19",
      end: "2026-11-19",
    });
  });

  it("2박 3일을 넘기면 범위를 바꾸지 않고 경고한다", () => {
    expect(pickDate({ start: "2026-11-21", end: "2026-11-21" }, "2026-11-24")).toEqual({
      start: "2026-11-21",
      end: "2026-11-21",
      warning: "too-long",
    });
  });
});
