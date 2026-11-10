// 장소 바꾸기: 대체 후보는 코드가 고르고(부적합·이미 일정에 있는 곳 제외), 바꾼 뒤 시각은 코드가 다시 계산·검사한다.
import { describe, expect, it } from "vitest";
import { makeTrip } from "@/lib/ai/trip";
import { estimateLeg } from "@/lib/engine/travel";
import { createLlm } from "@/lib/llm";
import { pickAlternatives } from "@/lib/trip/alternatives";
import { alternativesFor, swapPlace } from "@/lib/trip/edit";
import { toTripView, type OptionView, type TripView } from "@/lib/trip/view";
import { input, makePlace, scenarioPlaces } from "../engine/fixture";

const down = createLlm({ transport: async () => Promise.reject(Object.assign(new Error("down"), { status: 400 })), sleep: async () => {} });

async function tripOf(places = scenarioPlaces(), patch = {}) {
  const inp = input({ travelers: ["wheelchair"], pace: "slow", ...patch });
  const r = await makeTrip(down, inp, places, {}, estimateLeg);
  return toTripView(r, inp, places, {});
}

const visits = (o: OptionView) => o.days.flatMap((d) => d.items.flatMap((i) => (i.kind === "visit" ? [i] : [])));
const firstStop = (o: OptionView) => o.draft.days[0].stops[0].placeId;

describe("대체 후보 고르기", () => {
  it("부적합·그날 휴무·이미 일정에 있는 곳은 후보가 아니고, 판단이 좋고 가까운 곳이 앞이다", () => {
    const a = makePlace("GN81", { lat: 37.77, lng: 128.89 });
    const near = makePlace("GN82", { lat: 37.771, lng: 128.891 });
    const far = makePlace("GN83", { lat: 37.8, lng: 128.95 });
    const bad = makePlace("GN84", { lat: 37.77, lng: 128.89 });
    const closed = makePlace("GN85", { lat: 37.77, lng: 128.89, hours: { summer: { open: "09:00", close: "18:00", last_entry: "17:00" }, winter: { open: "09:00", close: "17:00", last_entry: "16:00" }, closed_weekdays: ["토"] } });
    const unsure = makePlace("GN86", { lat: 37.7705, lng: 128.8905 });
    const tooFar = makePlace("SC81", { lat: 38.2, lng: 128.59 });
    const byId = new Map([a, near, far, bad, closed, unsure, tooFar].map((p) => [p.id, p]));
    const draft = { days: [{ date: "2026-11-21", stops: [{ placeId: "GN81", stayMin: 40 }] }] };
    const pool = [
      { place: a, verdict: "적합" as const },
      { place: far, verdict: "적합" as const },
      { place: unsure, verdict: "확인 필요" as const },
      { place: near, verdict: "적합" as const },
      { place: bad, verdict: "부적합" as const },
      { place: closed, verdict: "적합" as const },
      { place: tooFar, verdict: "적합" as const },
    ];
    expect(pickAlternatives(draft, pool, byId)).toEqual({ GN81: ["GN82", "GN83", "GN86"] });
  });

  it("결과에는 장소마다 후보와, 다시 계산에 필요한 장소 정보·하루 틀이 실린다", async () => {
    const trip = await tripOf();
    const o = trip.options[0];
    for (const id of Object.values(o.alternatives).flat()) {
      expect(trip.judgments[id].verdict).not.toBe("부적합");
      expect(trip.placeData[id]).toBeDefined();
      expect(trip.places[id].phone).toBeTruthy();
    }
    expect(Object.values(o.alternatives).flat().length).toBeGreaterThan(0);
    expect(trip.frames).toHaveLength(o.days.length);
  });
});

describe("장소 바꾸기", () => {
  it("바꾸면 그 장소가 일정에 들어가고, 시각은 코드가 다시 계산한 값이다", async () => {
    const trip = await tripOf();
    const o = trip.options[0];
    const from = firstStop(o);
    const to = alternativesFor(o, from)[0];
    const r = swapPlace(trip, o, from, to);
    if (!r.ok) throw new Error(r.reason);
    const v = visits(r.option);
    expect(v.map((x) => x.placeId)).toContain(to);
    expect(v.map((x) => x.placeId)).not.toContain(from);
    expect(r.option.swapped).toEqual({ [to]: from });
    // 시각: 도착 → 체류 → 출발이 이어진다(LLM이 쓴 값이 아님)
    const x = v.find((i) => i.placeId === to)!;
    expect(x.departMin - x.arriveMin).toBe(x.stayMin + x.extraMin);
    // 원래 결과는 그대로
    expect(visits(trip.options[0]).map((i) => i.placeId)).toContain(from);
  });

  it("원래 장소로 되돌리면 바꾼 표시가 사라지고 처음 일정과 같아진다", async () => {
    const trip = await tripOf();
    const o = trip.options[0];
    const from = firstStop(o);
    const to = alternativesFor(o, from)[0];
    const r1 = swapPlace(trip, o, from, to);
    if (!r1.ok) throw new Error(r1.reason);
    expect(alternativesFor(r1.option, to)[0]).toBe(from); // 되돌리기 후보가 맨 앞
    const r2 = swapPlace(trip, r1.option, to, from);
    if (!r2.ok) throw new Error(r2.reason);
    expect(r2.option.swapped).toEqual({});
    expect(r2.option.days).toEqual(o.days);
    expect(r2.option.checkBeforeGo).toEqual(o.checkBeforeGo);
  });

  it("검사를 통과하지 못하면(운영시간) 바꾸지 않고 이유를 알려 준다", async () => {
    const trip = await tripOf();
    const o = trip.options[0];
    const from = firstStop(o);
    const early: TripView = { ...trip, placeData: { ...trip.placeData, GN79: makePlace("GN79", { hours: { summer: { open: "06:00", close: "08:00", last_entry: "07:30" }, winter: { open: "06:00", close: "08:00", last_entry: "07:30" } } }) }, judgments: { ...trip.judgments, GN79: { verdict: "적합", reasons: [], source: "rule", evidence: [] } } };
    const r = swapPlace(early, o, from, "GN79");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/입장 마감|닫는데/);
  });

  it("부적합 장소나 이미 일정에 있는 곳으로는 바꿀 수 없다", async () => {
    const trip = await tripOf();
    const o = trip.options[0];
    const [a, b] = o.draft.days[0].stops.map((s) => s.placeId);
    if (b) expect(swapPlace(trip, o, a, b).ok).toBe(false);
    const bad: TripView = { ...trip, placeData: { ...trip.placeData, GN78: makePlace("GN78") }, judgments: { ...trip.judgments, GN78: { verdict: "부적합", reasons: [], source: "rule", evidence: [] } } };
    expect(swapPlace(bad, o, a, "GN78").ok).toBe(false);
  });
});
