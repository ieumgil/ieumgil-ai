// 엔진 시나리오 10개 (docs/planning.md '엔진 테스트 시나리오' 표, v3 기준으로 고침).
// 목표: 모든 시나리오에서 필수 조건 위반 0건 — 규칙 일정에 부적합 장소가 들어가지 않고, 검사를 통과한다.

import { describe, expect, it } from "vitest";
import { safetyFloor } from "@/lib/ai/guards";
import { checkPlan } from "@/lib/engine/check";
import { resolveConditions } from "@/lib/engine/conditions";
import { rulePlan, targetCount } from "@/lib/engine/fallback";
import { buildFrames } from "@/lib/engine/frames";
import { timelineOptions } from "@/lib/engine/timeline";
import { estimateLeg } from "@/lib/engine/travel";
import type { PlanInput, TravelerType } from "@/lib/plan/types";
import { input, scenarioPlaces } from "./fixture";

const places = scenarioPlaces();
const byId = new Map(places.map((p) => [p.id, p]));
const stopsOf = (r: ReturnType<typeof rulePlan>) => r.draft.days.flatMap((d) => d.stops.map((s) => s.placeId));
const plan = (patch: Partial<PlanInput>) => rulePlan(input(patch), places, estimateLeg);

describe("엔진 시나리오", () => {
  it("1. 휠체어 · 자가용 + 표지 차량 · 당일 — 장애인 주차가 필수 조건으로 반영된다", () => {
    const r = plan({ travelers: ["wheelchair"], transport: "car", disabledPermit: true });
    expect(r.filter.conditions.must).toContain("disabled_parking");
    expect(r.filter.excluded.map((e) => e.place.id)).toContain("GN92");
    expect(stopsOf(r)).not.toContain("GN92");
    expect(r.check.ok).toBe(true);
  });

  it("2. 휠체어 · 택시 · 당일 — 장애인 주차 조건이 꺼져 있다", () => {
    const r = plan({ travelers: ["wheelchair"], transport: "taxi" });
    expect(r.filter.conditions.must).not.toContain("disabled_parking");
    expect(r.filter.candidates.map((c) => c.place.id)).toContain("GN92");
  });

  it("3. 고령자(300m) · 자가용 · 당일 — 관람 동선이 300m를 넘는 곳은 빠진다", () => {
    const r = plan({ travelers: ["elder"], transport: "car", walkLimit: 300 });
    expect(r.filter.excluded.find((e) => e.place.id === "GN95")?.reasons.join()).toContain("600m");
    expect(stopsOf(r)).not.toContain("GN95");
  });

  it("4. 유모차 · 택시 · 1박 2일 — 수유실 선호 점수, 날짜 배분, 같은 장소 중복 없음", () => {
    const r = plan({ travelers: ["stroller"], endDate: "2026-11-22", lodging: "강릉", categories: ["전시·박물관"] });
    expect(r.draft.days).toHaveLength(2);
    const ids = stopsOf(r);
    expect(new Set(ids).size).toBe(ids.length);
    const score = (id: string) => r.filter.candidates.find((c) => c.place.id === id)!.score;
    expect(score("GN96")).toBeGreaterThan(score("GN97")); // 수유실 가능 vs 불가, 같은 카테고리
    expect(r.check.ok).toBe(true);
  });

  it("5. 휠체어 + 고령자 · 자가용 + 표지 차량 · 2박 3일 — 조건 합집합, 둘째 날 숙소 출발", () => {
    const r = plan({ travelers: ["wheelchair", "elder"], transport: "car", disabledPermit: true, endDate: "2026-11-23", lodging: "속초", walkLimit: 300 });
    expect(r.filter.conditions.must).toEqual(expect.arrayContaining(["step_free_entrance", "accessible_toilet", "disabled_parking"]));
    expect(r.filter.conditions.walkLimitM).toBe(300);
    expect(r.frames[1].start.id).toBe("lodging-속초");
    expect(r.draft.days[1].stops.every((s) => byId.get(s.placeId)!.region === "속초")).toBe(true);
    expect(r.check.ok).toBe(true);
  });

  it("6. 휠체어 · 택시 · 1박 2일, 숙소 미정 — 숙소 위치를 가정하고 표시한다", () => {
    const r = plan({ travelers: ["wheelchair"], endDate: "2026-11-22", lodging: "미정" });
    expect(r.notes.join()).toContain("가정");
    expect(r.frames[1].start.name).toContain("(가정)");
  });

  it("7. 고령자 + 유모차 · 자가용 · 반나절(4시간) — 개수 하한, 빠듯·부족 판정", () => {
    expect(targetCount(4 * 60, "normal")).toBe(2);
    const inp = input({ travelers: ["elder", "stroller"], transport: "car", startTime: "13:00", endTime: "17:00" });
    const frames = buildFrames(inp).frames;
    const ctx = { frames, placesById: byId, travel: estimateLeg, options: timelineOptions(inp) };
    const two = checkPlan({ days: [{ date: "2026-11-21", stops: [{ placeId: "GN91", stayMin: 50 }, { placeId: "GN96", stayMin: 50 }] }] }, ctx);
    expect(two.fits[0]).toBe("여유");
    const four = checkPlan({ days: [{ date: "2026-11-21", stops: ["GN91", "GN96", "GN97", "GN92"].map((placeId) => ({ placeId, stayMin: 50 })) }] }, ctx);
    expect(["빠듯", "부족"]).toContain(four.fits[0]);
  });

  it("8. 휠체어 · 자가용 · 동절기 날짜 — 동절기 운영시간·휴무 반영", () => {
    const at = (date: string) => {
      const inp = input({ travelers: ["wheelchair"], startDate: date, endDate: date, startTime: "15:00", endTime: "18:00" });
      const r = checkPlan({ days: [{ date, stops: [{ placeId: "GN97", stayMin: 40 }] }] }, { frames: buildFrames(inp).frames, placesById: byId, travel: estimateLeg, options: timelineOptions(inp) });
      return r.violations.map((v) => v.kind);
    };
    expect(at("2026-07-04")).toEqual([]); // 하절기: 17:30 입장 마감
    expect(at("2026-12-05")).toContain("운영시간"); // 동절기: 15:00 입장 마감, 16:00 폐장
    // 월요일 휴무(GN91)
    const mon = input({ travelers: ["wheelchair"], startDate: "2026-11-23", endDate: "2026-11-23" });
    expect(rulePlan(mon, places, estimateLeg).filter.excluded.map((e) => e.place.id)).toContain("GN91");
  });

  it("9. 휠체어 · 택시 · 꼭 가고 싶은 곳이 불가 — 경고 후 제외", () => {
    const r = plan({ travelers: ["wheelchair"], mustVisit: ["GN93"] });
    expect(stopsOf(r)).not.toContain("GN93");
    expect(r.notes.join()).toContain("꼭 가고 싶은 곳");
  });

  it("10. 휠체어 + 유모차 · 택시 · 후보가 적은 지역 — 하루 상한 자동 축소", () => {
    const few = scenarioPlaces().filter((p) => ["GN93", "GN94", "GN95"].includes(p.id));
    const r = rulePlan(input({ travelers: ["wheelchair", "stroller"], pace: "busy" }), few, estimateLeg);
    expect(r.draft.days[0].stops.length).toBeLessThan(targetCount(7 * 60, "busy"));
    expect(r.notes.join()).toContain("줄였어요");
  });
});

describe("모든 유형 조합에서 필수 조건 위반 0건", () => {
  const combos: TravelerType[][] = [["wheelchair"], ["elder"], ["stroller"], ["wheelchair", "elder"], ["wheelchair", "stroller"], ["elder", "stroller"], ["wheelchair", "elder", "stroller"]];
  const transports: Partial<PlanInput>[] = [{ transport: "taxi" }, { transport: "car", disabledPermit: true }];
  for (const travelers of combos) {
    for (const t of transports) {
      it(`${travelers.join("+")} · ${t.transport}${t.disabledPermit ? "+표지" : ""} · 2박 3일`, () => {
        const inp = input({ travelers, ...t, endDate: "2026-11-23", lodging: "강릉", walkLimit: 300 });
        const r = rulePlan(inp, places, estimateLeg);
        const cond = resolveConditions(inp);
        for (const id of stopsOf(r)) expect(safetyFloor(byId.get(id)!, cond).verdict).not.toBe("부적합");
        expect(new Set(stopsOf(r)).size).toBe(stopsOf(r).length);
        expect(r.check.violations).toEqual([]);
      });
    }
  }
});
