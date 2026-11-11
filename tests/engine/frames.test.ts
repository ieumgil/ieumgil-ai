// 날짜별 시작·끝 지점: 2박 3일은 밤마다 숙소가 다를 수 있다(첫째 밤 강릉, 둘째 밤 속초 등).
import { describe, expect, it } from "vitest";
import { selectForLlm } from "@/lib/ai/trip";
import { buildFrames } from "@/lib/engine/frames";
import type { Candidate } from "@/lib/engine/filter";
import { LODGING_COORDS } from "@/lib/engine/travel";
import { EMPTY_PLAN, type PlanInput } from "@/lib/plan/types";
import type { Place } from "@/lib/types";

const base: PlanInput = { ...EMPTY_PLAN, startDate: "2026-12-12", endDate: "2026-12-14", arrival: "gangneung-station", lodging: "강릉" };

describe("숙소를 밤마다", () => {
  it("첫째 밤 강릉 · 둘째 밤 속초: 2일째는 강릉에서 출발해 속초에서 끝나고, 3일째는 속초에서 출발", () => {
    const { frames } = buildFrames({ ...base, lodging2: "속초" });
    expect(frames.map((f) => [f.start.id, f.end.id])).toEqual([
      ["gangneung-station", "lodging-강릉"],
      ["lodging-강릉", "lodging-속초"],
      ["lodging-속초", "gangneung-station"],
    ]);
  });

  it("둘째 밤이 '첫째 밤과 같음'이면 두 밤 모두 첫째 밤 숙소", () => {
    const { frames } = buildFrames({ ...base, lodging2: "same" });
    expect(frames[1].start).toEqual(LODGING_COORDS.강릉);
    expect(frames[1].end).toEqual(LODGING_COORDS.강릉);
    expect(frames[2].start).toEqual(LODGING_COORDS.강릉);
  });

  it("둘째 밤이 '미정'이면 첫째 밤 숙소 근처로 가정한다", () => {
    const { frames } = buildFrames({ ...base, lodging: "동해", lodging2: "미정" });
    expect(frames[2].start).toMatchObject({ lat: LODGING_COORDS.동해.lat, lng: LODGING_COORDS.동해.lng });
    expect(frames[2].start.name).toContain("미정");
  });

  it("1박 2일이면 둘째 밤 값은 쓰지 않는다", () => {
    const { frames } = buildFrames({ ...base, endDate: "2026-12-13", lodging2: "속초" });
    expect(frames).toHaveLength(2);
    expect(frames[0].end).toEqual(LODGING_COORDS.강릉);
    expect(frames[1].start).toEqual(LODGING_COORDS.강릉);
  });
});

describe("AI에게 넘길 후보", () => {
  const cand = (id: string, lat: number, lng: number): Candidate =>
    ({ place: { id, name_ko: id, lat, lng } as unknown as Place, floor: {}, rule: "적합", tier: 0, score: 10, mustVisit: false, openDates: ["2026-12-12"], warnings: [] }) as unknown as Candidate;

  it("옮기는 날은 도착할 숙소 근처 장소도 고른다", () => {
    const { frames } = buildFrames({ ...base, endDate: "2026-12-12", departure: "sokcho-bus" }); // 당일: 강릉역 → 속초
    const near강릉 = [cand("G1", 37.765, 128.9), cand("G2", 37.77, 128.91), cand("G3", 37.78, 128.92)];
    const near속초 = cand("S1", 38.19, 128.6);
    const picked = selectForLlm([...near강릉, near속초], frames, 2).map((c) => c.place.id);
    expect(picked).toContain("S1");
  });
});
