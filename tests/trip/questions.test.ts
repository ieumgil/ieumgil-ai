// 전화로 물어볼 것: 같은 주제의 질문은 장소마다 하나만, 세는 기준은 '질문이 있는 장소 수'(확정 화면과 같은 숫자).
import { describe, expect, it } from "vitest";
import { callPlaces, questionsByPlace } from "@/lib/trip/questions";
import type { OptionView } from "@/lib/trip/view";

const visit = (placeId: string) => ({ kind: "visit" as const, placeId, arriveMin: 600, departMin: 660, stayMin: 60, extraMin: 0 });
const o = {
  checkBeforeGo: [
    { placeId: "A", question: "장애인 화장실이 구비되어 있나요?" },
    { placeId: "A", question: "장애인 화장실이 있나요?" },
    { placeId: "A", question: "노면 포장 상태나 재질은 어떻게 되나요?" },
    { placeId: "B", question: "장애인 화장실이 있나요?" },
    { placeId: "C", question: "휠체어를 빌릴 수 있나요?" },
    { placeId: "C", question: "휠체어를 빌릴 수 있나요?" },
  ],
  days: [
    { items: [visit("C"), visit("A")] },
    { items: [visit("D"), visit("B")] },
  ],
} as unknown as OptionView;

describe("전화로 물어볼 것", () => {
  it("같은 주제의 질문은 장소마다 하나만 남긴다(장소가 다르면 따로)", () => {
    const qs = questionsByPlace(o);
    expect(qs.get("A")).toEqual(["장애인 화장실이 구비되어 있나요?", "노면 포장 상태나 재질은 어떻게 되나요?"]);
    expect(qs.get("B")).toEqual(["장애인 화장실이 있나요?"]);
    expect(qs.get("C")).toEqual(["휠체어를 빌릴 수 있나요?"]);
  });

  it("질문이 있는 장소를 일정 순서대로 센다", () => {
    expect(callPlaces(o)).toEqual(["C", "A", "B"]);
  });
});
