// 유형별 조건 계산 (docs/planning.md '사용자 유형과 필수 조건' 표)
import { describe, expect, it } from "vitest";
import { conditionRows, resolveConditions, type ConditionInput } from "@/lib/engine/conditions";

const input = (over: Partial<ConditionInput>): ConditionInput => ({
  travelers: [],
  transport: "car",
  disabledPermit: false,
  conditionOverrides: {},
  walkLimit: 300,
  ...over,
});

describe("조건 계산", () => {
  it("휠체어 + 자가용 + 표지 차량이면 장애인 주차가 필수다 (시나리오 1)", () => {
    const r = resolveConditions(input({ travelers: ["wheelchair"], disabledPermit: true }));
    expect(r.must).toEqual(
      expect.arrayContaining(["step_free_entrance", "elevator", "slope", "surface", "accessible_toilet", "disabled_parking"]),
    );
  });

  it("휠체어 + 택시면 장애인 주차 조건이 꺼져 있다 (시나리오 2)", () => {
    const r = resolveConditions(input({ travelers: ["wheelchair"], transport: "taxi", disabledPermit: true }));
    expect(r.must).not.toContain("disabled_parking");
    expect(r.prefer).not.toContain("disabled_parking");
  });

  it("자가용이어도 표지가 없으면 장애인 주차는 조건이 아니다", () => {
    const r = resolveConditions(input({ travelers: ["wheelchair"], disabledPermit: false }));
    expect(r.must).not.toContain("disabled_parking");
  });

  it("고령자만 고르면 걷는 거리가 필수이고 단차·경사·노면은 주의다 (시나리오 3)", () => {
    const r = resolveConditions(input({ travelers: ["elder"], walkLimit: 300 }));
    expect(r.walkLimitM).toBe(300);
    expect(r.must).toEqual([]);
    expect(r.caution).toEqual(expect.arrayContaining(["step_free_entrance", "slope", "surface"]));
    expect(r.prefer).toEqual(expect.arrayContaining(["elevator", "accessible_toilet", "rest_area"]));
  });

  it("고령자가 없으면 걷는 거리 제한이 없다", () => {
    expect(resolveConditions(input({ travelers: ["wheelchair"], walkLimit: 100 })).walkLimitM).toBeNull();
  });

  it("유모차는 엘리베이터 필수, 수유실은 선호, 장애인 주차는 대상이 아니다", () => {
    const r = resolveConditions(input({ travelers: ["stroller"], disabledPermit: true }));
    expect(r.must).toEqual(["elevator"]);
    expect(r.prefer).toContain("diaper_nursing");
    expect(r.caution).toContain("step_free_entrance");
    expect([...r.must, ...r.prefer, ...r.caution]).not.toContain("disabled_parking");
  });

  it("여러 유형이면 항목마다 가장 엄격한 값을 쓴다 (시나리오 5)", () => {
    const r = resolveConditions(input({ travelers: ["wheelchair", "elder"], disabledPermit: true, walkLimit: 300 }));
    // 단차: 휠체어 필수 > 고령자 주의
    expect(r.must).toContain("step_free_entrance");
    expect(r.caution).not.toContain("step_free_entrance");
    // 엘리베이터: 휠체어 필수 > 고령자 선호
    expect(r.prefer).not.toContain("elevator");
    expect(r.walkLimitM).toBe(300);
    // 한 항목은 한 등급에만 들어간다
    const all = [...r.must, ...r.prefer, ...r.caution];
    expect(new Set(all).size).toBe(all.length);
  });

  it("고령자 + 표지 차량이면 장애인 주차가 필수다(장애 등록 시)", () => {
    const r = resolveConditions(input({ travelers: ["elder"], disabledPermit: true }));
    expect(r.must).toContain("disabled_parking");
  });

  it("사용자가 끈 필수 조건은 필수에서 빠지고 선호로 내려간다", () => {
    const r = resolveConditions(
      input({ travelers: ["wheelchair"], conditionOverrides: { slope: false } }),
    );
    expect(r.must).not.toContain("slope");
    expect(r.prefer).toContain("slope");
  });

  it("사용자가 끈 선호 조건은 점수에서 빠진다", () => {
    const r = resolveConditions(
      input({ travelers: ["elder"], conditionOverrides: { rest_area: false } }),
    );
    expect(r.prefer).not.toContain("rest_area");
  });

  it("아무 유형도 고르지 않으면 조건이 없다", () => {
    const r = resolveConditions(input({}));
    expect(r).toMatchObject({ must: [], prefer: [], caution: [], walkLimitM: null });
  });
});

describe("3단계 화면용 조건 목록", () => {
  it("필수 목록에 어느 유형 때문인지 표시한다", () => {
    const rows = conditionRows(input({ travelers: ["wheelchair", "elder"], disabledPermit: true }));
    const surface = rows.must.find((r) => r.key === "surface");
    expect(surface).toMatchObject({ label: "포장길·데크 노면", who: "휠체어", on: true });
    const parking = rows.must.find((r) => r.key === "disabled_parking");
    expect(parking?.who).toBe("표지 차량");
  });

  it("끈 항목은 목록에 남고 on=false로 표시된다", () => {
    const rows = conditionRows(input({ travelers: ["wheelchair"], conditionOverrides: { slope: false } }));
    expect(rows.must.find((r) => r.key === "slope")).toMatchObject({ on: false });
  });

  it("선호 목록은 주의 항목을 포함하지 않는다", () => {
    const rows = conditionRows(input({ travelers: ["elder"] }));
    expect(rows.prefer.map((r) => r.key)).not.toContain("step_free_entrance");
    expect(rows.showWalkLimit).toBe(true);
  });
});
