// 전화로 물어볼 것: 같은 주제의 질문은 장소마다 하나만, 세는 기준은 '질문이 있는 장소 수'(확정 화면과 같은 숫자).
// 노면·경사·쉴 곳처럼 가서 보면 아는 것은 전화 질문에서 빼고 '가서 볼 것'으로 따로 보여준다(11/14).
import { describe, expect, it } from "vitest";
import { callPlaces, isPhoneQuestion, onSiteByPlace, questionsByPlace } from "@/lib/trip/questions";
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
    { placeId: "D", question: "입구와 관람로에 휠체어로 오르기 힘든 급한 경사가 있나요?" },
    { placeId: "D", question: "관람하는 길에 앉아서 쉴 벤치나 쉼터가 있나요?" },
  ],
  days: [
    { items: [visit("C"), visit("A")] },
    { items: [visit("D"), visit("B")] },
  ],
} as unknown as OptionView;

describe("전화로 물어볼 것", () => {
  it("같은 주제의 질문은 장소마다 하나만 남기고, 가서 보면 아는 것(노면)은 뺀다", () => {
    const qs = questionsByPlace(o);
    expect(qs.get("A")).toEqual(["장애인 화장실이 구비되어 있나요?"]);
    expect(qs.get("B")).toEqual(["장애인 화장실이 있나요?"]);
    expect(qs.get("C")).toEqual(["휠체어를 빌릴 수 있나요?"]);
    expect(qs.has("D")).toBe(false);
  });

  it("전화 질문이 있는 장소만 일정 순서대로 센다(가서 볼 것만 있는 곳은 빠진다)", () => {
    expect(callPlaces(o)).toEqual(["C", "A", "B"]);
  });

  it("엘리베이터·화장실·장애인 주차·출입구·수유실·걷는 거리는 전화, 노면·경사·쉴 곳은 가서 본다", () => {
    for (const q of ["엘리베이터로 2층에 갈 수 있나요?", "장애인 화장실이 있나요?", "장애인 전용 주차구역이 있나요?", "주출입구까지 계단이나 턱 없이 들어갈 수 있나요?", "입구에 경사로가 있나요?", "수유실이 있나요?", "주차장에서 입구까지 몇 m인가요?"]) {
      expect(isPhoneQuestion(q), q).toBe(true);
    }
    for (const q of ["노면 재질이 어떻게 되나요?", "바닥이 모래인가요?", "급한 경사가 있나요?", "쉴 벤치가 있나요?"]) {
      expect(isPhoneQuestion(q), q).toBe(false);
    }
  });
});

describe("가서 볼 것", () => {
  it("장소마다 주제별로 한 줄씩, 정해 둔 쉬운 안내 문장으로", () => {
    const os = onSiteByPlace(o);
    expect(os.get("A")).toHaveLength(1);
    expect(os.get("A")![0]).toMatch(/^바닥/);
    expect(os.get("D")!.map((t) => t.split(":")[0])).toEqual(["경사", "쉴 곳"]);
    expect(os.has("B")).toBe(false);
  });
});
