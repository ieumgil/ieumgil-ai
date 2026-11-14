// 카카오 실제 이동시간 표: 하루 지점 순서(출발 → 장소 → 도착)로 받은 구간 값을 표에 넣고,
// 표에 있으면 그 값(추정 아님), 없으면 직선거리 추정으로 계산한다. 표는 메모리에서만 쓰고 저장하지 않는다.
import { describe, expect, it } from "vitest";
import { computeDay, timelineOptions } from "@/lib/engine/timeline";
import { addLegs, dayPoints, tableTravel, type LegTable } from "@/lib/engine/real-travel";
import { buildFrames } from "@/lib/engine/frames";
import { estimateLeg } from "@/lib/engine/travel";
import { input, scenarioPlaces } from "./fixture";

const places = scenarioPlaces();
const byId = new Map(places.map((p) => [p.id, p]));
const inp = input({ travelers: ["wheelchair"] });
const frame = buildFrames(inp).frames[0];
const day = { date: frame.date, stops: [{ placeId: "GN91", stayMin: 50 }, { placeId: "GN96", stayMin: 50 }] };

describe("실제 이동시간 표", () => {
  it("하루 지점은 출발 → 장소들 → 도착 순서", () => {
    const pts = dayPoints(frame, day, byId);
    expect(pts.map((p) => p.id)).toEqual([frame.start.id, "GN91", "GN96", frame.end.id]);
  });

  it("표에 있는 구간은 그 값(추정 아님), 없는 구간은 추정", () => {
    const table: LegTable = new Map();
    const pts = dayPoints(frame, day, byId);
    addLegs(table, pts.slice(0, 2), [{ minutes: 17, km: 6.1 }]); // 출발 → GN91만
    const travel = tableTravel(table);
    expect(travel(pts[0], pts[1])).toEqual({ minutes: 17, km: 6.1, estimated: false });
    expect(travel(pts[1], pts[2])).toEqual(estimateLeg(pts[1], pts[2]));
  });

  it("하루 전체를 넣으면 시각 계산에 그대로 쓰이고 '추정'이 없어진다", () => {
    const table: LegTable = new Map();
    const pts = dayPoints(frame, day, byId);
    addLegs(table, pts, [{ minutes: 20, km: 7 }, { minutes: 9, km: 2 }, { minutes: 15, km: 5 }]);
    const tl = computeDay(frame, day, byId, tableTravel(table), timelineOptions(inp));
    expect(tl.estimatedTravel).toBe(false);
    expect(tl.travelMin).toBe(44);
  });

  it("구간 수가 맞지 않으면 넣지 않는다", () => {
    const table: LegTable = new Map();
    addLegs(table, dayPoints(frame, day, byId), [{ minutes: 1, km: 1 }]);
    expect(table.size).toBe(0);
  });
});
