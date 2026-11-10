// guards.ts: 안전 하한·근거 검사·3회 판단 합치기. LLM이 무엇을 내도 코드가 지키는 선.
import { describe, expect, it } from "vitest";
import { combineSamples, applyGuards, safetyFloor, type RawJudgment } from "@/lib/ai/guards";
import { resolveConditions } from "@/lib/engine/conditions";
import { EMPTY_PLAN, type PlanInput } from "@/lib/plan/types";
import type { Place } from "@/lib/types";
import { loadSamplePlaces } from "../helpers";

const cond = (patch: Partial<PlanInput>) => resolveConditions({ ...EMPTY_PLAN, ...patch });
const wheelchair = cond({ travelers: ["wheelchair"], transport: "taxi" });
const elder300 = cond({ travelers: ["elder"], transport: "taxi", walkLimit: 300 });

function placeB(): Place {
  return loadSamplePlaces()[1]; // GN92: 모든 항목 가능(화장실은 사람 확인)
}

describe("안전 하한 (코드가 강제)", () => {
  it("필수 항목이 '불가'면 부적합", () => {
    const p = placeB();
    p.access.step_free_entrance.value = "불가";
    expect(safetyFloor(p, wheelchair)).toMatchObject({ verdict: "부적합", keys: ["step_free_entrance"] });
  });

  it("필수 항목이 '모름'이면 확인 필요(질문 포함)", () => {
    const p = placeB();
    p.access.elevator = { value: "모름", ask: "2층에 엘리베이터가 있나요?", grade: "ai", method: "관광공사 API", verified_at: "2026-11-10" };
    expect(safetyFloor(p, wheelchair)).toMatchObject({ verdict: "확인 필요", asks: ["2층에 엘리베이터가 있나요?"] });
  });

  it("필수 항목이 '부분가능'이면 최소 주의", () => {
    const p = placeB();
    p.access.surface = { value: "부분가능", note: "데크까지만", evidence: ["route-1"], grade: "ai", method: "관광공사 API", verified_at: "2026-11-10" };
    expect(safetyFloor(p, wheelchair).verdict).toBe("주의");
  });

  it("선호 항목은 하한을 만들지 않는다", () => {
    const p = placeB();
    p.access.rental_wheelchair.value = "불가";
    expect(safetyFloor(p, wheelchair).verdict).toBe("적합");
  });

  it("어르신: 걸을 거리를 넘으면 부적합, 거리를 모르면 확인 필요", () => {
    const p = placeB();
    p.parking_to_entrance = { meters: 450 };
    expect(safetyFloor(p, elder300).verdict).toBe("부적합");
    p.parking_to_entrance = {};
    delete p.route_length;
    expect(safetyFloor(p, elder300).verdict).toBe("확인 필요");
  });
});

describe("LLM 판단에 가드 적용", () => {
  const allowed = { GN92: ["route-1", "restroom-1", "exit-1"] };

  it("근거가 맞으면 LLM 판단을 쓰되, 하한보다 낙관적일 수는 없다", () => {
    const p = placeB();
    p.access.elevator = { value: "모름", ask: "엘리베이터가 있나요?", grade: "ai", method: "관광공사 API", verified_at: "2026-11-10" };
    const raw: RawJudgment = { placeId: "GN92", verdict: "적합", reasons: ["경사로가 있어요"], evidence: ["route-1"] };
    const out = applyGuards(raw, p, wheelchair, allowed.GN92);
    expect(out).toMatchObject({ verdict: "확인 필요", source: "ai", floorApplied: true });
    expect(out.checkBeforeGo).toContain("엘리베이터가 있나요?");
  });

  it("LLM이 더 보수적이면 그대로 둔다", () => {
    const raw: RawJudgment = { placeId: "GN92", verdict: "주의", reasons: ["화장실이 멀어요"], evidence: ["restroom-1"] };
    expect(applyGuards(raw, placeB(), wheelchair, allowed.GN92)).toMatchObject({ verdict: "주의", floorApplied: false });
  });

  it("근거가 비었거나 넘겨준 목록 밖이면 LLM 판단을 버리고 규칙 판단을 쓴다", () => {
    for (const evidence of [[], ["route-9"], ["[route-1] 출입구까지 경사로"]]) {
      const raw: RawJudgment = { placeId: "GN92", verdict: "적합", reasons: ["좋아요"], evidence };
      expect(applyGuards(raw, placeB(), wheelchair, allowed.GN92)).toMatchObject({ source: "rule" });
    }
  });

  it("목록 밖 근거는 빼고, 남은 근거가 있으면 쓴다", () => {
    const raw: RawJudgment = { placeId: "GN92", verdict: "적합", reasons: ["좋아요"], evidence: ["route-1", "made-up-1"] };
    expect(applyGuards(raw, placeB(), wheelchair, allowed.GN92)).toMatchObject({ source: "ai", evidence: ["route-1"] });
  });
});

describe("3회 판단 합치기(자기 일관성)", () => {
  it("셋 다 같으면 확신 높음", () => {
    expect(combineSamples(["주의", "주의", "주의"])).toEqual({ verdict: "주의", confidence: "높음" });
  });
  it("2:1이면 보수적인 쪽, 확신 보통", () => {
    expect(combineSamples(["적합", "적합", "주의"])).toEqual({ verdict: "주의", confidence: "보통" });
    expect(combineSamples(["부적합", "주의", "주의"])).toEqual({ verdict: "부적합", confidence: "보통" });
  });
  it("셋 다 다르면 확인 필요, 확신 낮음", () => {
    expect(combineSamples(["적합", "주의", "부적합"])).toEqual({ verdict: "확인 필요", confidence: "낮음" });
  });
  it("판단이 하나도 없으면(모두 실패) null", () => {
    expect(combineSamples([])).toBeNull();
  });
});
