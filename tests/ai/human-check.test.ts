// AI 읽기 정확도(사람 확인과 비교): 사람이 직접 확인한 값(가능/부분가능/불가)과 AI가 원문에서 읽은 값을 항목마다 맞춰 본다.
// 사람이 '모름'이거나 비운 칸은 세지 않는다. 가장 위험한 경우(AI 가능 ↔ 사람 불가)는 따로 센다. AI '모름'은 틀림이 아니라 '빈칸'으로 센다.
import { describe, expect, it } from "vitest";
import { compareHuman, HUMAN_CHECK_KEYS } from "@/lib/ai/eval";
import type { AccessStatus } from "@/lib/types";

const ai = (v: Partial<Record<(typeof HUMAN_CHECK_KEYS)[number], AccessStatus>>) => ({
  step_free_entrance: "모름",
  elevator: "모름",
  accessible_toilet: "모름",
  disabled_parking: "모름",
  ...v,
}) as Record<(typeof HUMAN_CHECK_KEYS)[number], AccessStatus>;

describe("사람 확인과 AI 읽기 비교", () => {
  it("항목마다 맞음·다름·AI 빈칸·위험한 다름을 센다", () => {
    const r = compareHuman(
      [
        { id: "A", human: { step_free_entrance: "가능", elevator: "불가", accessible_toilet: "가능" } },
        { id: "B", human: { step_free_entrance: "불가", elevator: "가능", disabled_parking: "모름" } },
      ],
      new Map([
        ["A", ai({ step_free_entrance: "가능", elevator: "가능", accessible_toilet: "모름" })],
        ["B", ai({ step_free_entrance: "부분가능", elevator: "가능" })],
      ]),
    );
    expect(r.byKey.step_free_entrance).toEqual({ compared: 2, match: 1, differ: 1, aiUnknown: 0, dangerous: 0 });
    expect(r.byKey.elevator).toEqual({ compared: 2, match: 1, differ: 1, aiUnknown: 0, dangerous: 1 }); // A: AI 가능 ↔ 사람 불가
    expect(r.byKey.accessible_toilet).toEqual({ compared: 1, match: 0, differ: 0, aiUnknown: 1, dangerous: 0 });
    expect(r.byKey.disabled_parking.compared).toBe(0); // 사람 '모름'은 세지 않음
    expect(r.total).toEqual({ compared: 5, match: 2, differ: 2, aiUnknown: 1, dangerous: 1 });
    expect(r.places).toBe(2);
  });

  it("AI 값이 없는 장소(데이터에 없는 id)는 건너뛴다", () => {
    const r = compareHuman([{ id: "X", human: { elevator: "가능" } }], new Map());
    expect(r.total.compared).toBe(0);
    expect(r.places).toBe(0);
  });
});
