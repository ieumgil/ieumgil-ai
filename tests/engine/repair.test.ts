// 시간만 조금 넘친 안을 코드가 살리기: 체류를 권장 최소로 → 그래도 넘치면 걸린 장소(또는 그날 마지막 장소)를 뺀다.
// 꼭 가고 싶은 곳은 빼지 않고, 시간 말고 다른 위반(중복·부적합 등)은 고치지 않는다.
import { describe, expect, it } from "vitest";
import { checkPlan, type CheckContext } from "@/lib/engine/check";
import { buildFrames } from "@/lib/engine/frames";
import { repairTiming } from "@/lib/engine/repair";
import { timelineOptions } from "@/lib/engine/timeline";
import { estimateLeg } from "@/lib/engine/travel";
import type { PlanDraft } from "@/lib/engine/types";
import { input, makePlace } from "./fixture";

// 서로 가까운 장소 8곳(체류 40~60분, 겨울 09~17시·입장 마감 16시)
const places = Array.from({ length: 8 }, (_, i) => makePlace(`GN8${i}`, { lat: 37.77 + i * 0.002, lng: 128.89 + i * 0.002 }));
const inp = input({ travelers: ["wheelchair"] });
const frames = buildFrames(inp).frames;
const ctx: CheckContext = { frames, placesById: new Map(places.map((p) => [p.id, p])), travel: estimateLeg, options: timelineOptions(inp) };
const draftOf = (ids: string[], stayMin = 60): PlanDraft => ({ days: [{ date: frames[0].date, stops: ids.map((placeId) => ({ placeId, stayMin, why: "이유" })) }] });

describe("시간 맞추기(repairTiming)", () => {
  it("이미 통과한 안은 그대로", () => {
    const d = draftOf(["GN80", "GN81"]);
    const r = repairTiming(d, ctx, new Set());
    expect(r?.check.ok).toBe(true);
    expect(r?.notes).toEqual([]);
    expect(r?.draft).toEqual(d);
  });

  it("조금 넘치면 머무는 시간을 권장 최소로 줄여 맞춘다(장소는 그대로)", () => {
    // 60분씩이면 넘치고 40분씩이면 들어가는 개수를 찾는다
    const n = [3, 4, 5, 6].find((k) => !checkPlan(draftOf(places.slice(0, k).map((p) => p.id), 60), ctx).ok && checkPlan(draftOf(places.slice(0, k).map((p) => p.id), 40), ctx).ok)!;
    expect(n).toBeDefined();
    const ids = places.slice(0, n).map((p) => p.id);
    const r = repairTiming(draftOf(ids, 60), ctx, new Set());
    expect(r?.check.ok).toBe(true);
    expect(r!.draft.days[0].stops.map((s) => s.placeId)).toEqual(ids);
    expect(r!.draft.days[0].stops.every((s) => s.stayMin === 40)).toBe(true);
    expect(r!.notes[0]).toContain("머무는 시간");
  });

  it("그래도 넘치면 그날 뒤쪽 장소를 빼서 맞추고, 꼭 가고 싶은 곳은 남긴다", () => {
    const fits = [3, 4, 5, 6].filter((k) => checkPlan(draftOf(places.slice(0, k).map((p) => p.id), 40), ctx).ok).at(-1)!;
    const ids = places.slice(0, fits + 1).map((p) => p.id); // 최소 체류로도 한 곳 넘침
    const must = ids.at(-1)!;
    const r = repairTiming(draftOf(ids, 60), ctx, new Set([must]));
    expect(r?.check.ok).toBe(true);
    const kept = r!.draft.days[0].stops.map((s) => s.placeId);
    expect(kept).toContain(must);
    expect(kept.length).toBe(ids.length - 1);
    expect(r!.notes.some((t) => t.includes("빼고"))).toBe(true);
  });

  it("시간 말고 다른 위반(같은 곳 두 번)은 고치지 않는다(null)", () => {
    expect(repairTiming(draftOf(["GN80", "GN80"]), ctx, new Set())).toBeNull();
  });

  it("두 곳 넘게 빼야 맞으면 살리지 않는다(null)", () => {
    expect(repairTiming(draftOf(places.map((p) => p.id), 60), ctx, new Set(), 2)).toBeNull();
  });
});
