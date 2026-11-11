// PC 입력 단계 오른쪽 '고른 조건' 요약 줄
import { describe, expect, it } from "vitest";
import { summaryLines } from "@/lib/plan/summary";
import { EMPTY_PLAN } from "@/lib/plan/types";

describe("고른 조건 요약", () => {
  it("아무것도 안 골랐으면 단계마다 빈 줄", () => {
    expect(summaryLines(EMPTY_PLAN)).toEqual([[], [], [], []]);
  });

  it("고른 값이 단계별로 쌓인다", () => {
    const [when, who, conditions, taste] = summaryLines({
      ...EMPTY_PLAN,
      startDate: "2026-11-21",
      endDate: "2026-11-22",
      arrival: "gangneung-station",
      transport: "car",
      disabledPermit: true,
      lodging: "강릉",
      travelers: ["wheelchair", "elder"],
      walkLimit: 100,
      categories: ["바다·해변"],
      pace: "slow",
      mustVisit: ["GN12"],
    });
    expect(when).toEqual([expect.stringContaining("1박 2일"), "강릉역 도착 · 10:00~17:00", "자가용 · 장애인 표지", "숙소 강릉"]);
    expect(who).toHaveLength(2);
    expect(conditions.at(-1)).toBe("한 번에 걷기 100m");
    expect(taste).toEqual(["바다·해변", "일정 여유롭게", "꼭 갈 곳 1곳"]);
  });

  it("2박 3일에 둘째 밤 숙소가 다르면 '강릉 → 속초', 1박이면 둘째 밤 값은 무시", () => {
    const two = { ...EMPTY_PLAN, startDate: "2026-11-21", endDate: "2026-11-23", lodging: "강릉" as const, lodging2: "속초" as const };
    expect(summaryLines(two)[0]).toContain("숙소 강릉 → 속초");
    expect(summaryLines({ ...two, lodging2: "same" })[0]).toContain("숙소 강릉");
    expect(summaryLines({ ...two, endDate: "2026-11-22" })[0]).toContain("숙소 강릉");
    expect(summaryLines({ ...two, endDate: "2026-11-22" })[0].join()).not.toContain("속초");
  });

  it("당일이면 숙소 줄이 없고, 끈 조건은 빠진다", () => {
    const [when, , conditions] = summaryLines({
      ...EMPTY_PLAN,
      startDate: "2026-11-21",
      endDate: "2026-11-21",
      lodging: "강릉",
      travelers: ["stroller"],
      conditionOverrides: { elevator: false },
    });
    expect(when.some((l) => l.startsWith("숙소"))).toBe(false);
    expect(conditions.join()).not.toContain("엘리베이터");
  });
});
