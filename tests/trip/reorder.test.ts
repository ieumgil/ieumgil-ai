// 순서 바꾸기·빼기(11/14): 같은 날 안에서 위·아래로 옮기거나 뺀다. AI·서버 호출 없이 코드가 시각을 다시 계산·검사한다.
import { describe, expect, it } from "vitest";
import { makeTrip } from "@/lib/ai/trip";
import { estimateLeg } from "@/lib/engine/travel";
import { createLlm } from "@/lib/llm";
import { isEdited, moveStop, removeStop } from "@/lib/trip/edit";
import { toTripView, type OptionView } from "@/lib/trip/view";
import { input, scenarioPlaces } from "../engine/fixture";

const down = createLlm({ transport: async () => Promise.reject(Object.assign(new Error("down"), { status: 400 })), sleep: async () => {} });

async function tripOf() {
  const inp = input({ travelers: ["wheelchair"], pace: "normal" });
  const r = await makeTrip(down, inp, scenarioPlaces(), {}, estimateLeg);
  return toTripView(r, inp, scenarioPlaces(), {});
}
const order = (o: OptionView, day = 0) => o.days[day].items.flatMap((i) => (i.kind === "visit" ? [i.placeId] : []));

describe("순서 바꾸기", () => {
  it("아래로 옮기면 다음 장소와 자리를 바꾸고, 시각을 다시 계산한다", async () => {
    const trip = await tripOf();
    const o = trip.options[0];
    const [a, b, ...rest] = order(o);
    expect(b).toBeDefined();
    const r = moveStop(trip, o, a, 1);
    if (!r.ok) throw new Error(r.reason);
    expect(order(r.option)).toEqual([b, a, ...rest]);
    expect(r.option.draft.days[0].stops.map((s) => s.placeId)).toEqual([b, a, ...rest]);
    const first = r.option.days[0].items.find((i) => i.kind === "visit")!;
    expect(first.kind === "visit" && first.placeId).toBe(b);
    expect(isEdited(trip, r.option)).toBe(true);
  });

  it("다시 위로 옮기면 처음 일정과 같아진다", async () => {
    const trip = await tripOf();
    const o = trip.options[0];
    const [a] = order(o);
    const r1 = moveStop(trip, o, a, 1);
    if (!r1.ok) throw new Error(r1.reason);
    const r2 = moveStop(trip, r1.option, a, -1);
    if (!r2.ok) throw new Error(r2.reason);
    expect(r2.option.days).toEqual(o.days);
    expect(isEdited(trip, r2.option)).toBe(false);
  });

  it("맨 앞을 위로, 맨 뒤를 아래로는 옮길 수 없다", async () => {
    const trip = await tripOf();
    const o = trip.options[0];
    const ids = order(o);
    expect(moveStop(trip, o, ids[0], -1).ok).toBe(false);
    expect(moveStop(trip, o, ids.at(-1)!, 1).ok).toBe(false);
  });
});

describe("빼기", () => {
  it("빼면 일정·확인할 것·장소 수에서 빠지고 시각을 다시 계산한다", async () => {
    const trip = await tripOf();
    const o = trip.options[0];
    const [a, ...rest] = order(o);
    const r = removeStop(trip, o, a);
    if (!r.ok) throw new Error(r.reason);
    expect(order(r.option)).toEqual(rest);
    expect(r.option.checkBeforeGo.some((q) => q.placeId === a)).toBe(false);
    expect(r.option.stats.places).toBe(o.stats.places - 1);
    expect(isEdited(trip, r.option)).toBe(true);
  });

  it("그날 마지막 남은 한 곳은 뺄 수 없다", async () => {
    const trip = await tripOf();
    let o = trip.options[0];
    const ids = order(o);
    for (const id of ids.slice(1)) {
      const r = removeStop(trip, o, id);
      if (!r.ok) throw new Error(r.reason);
      o = r.option;
    }
    const last = removeStop(trip, o, ids[0]);
    expect(last.ok).toBe(false);
    if (!last.ok) expect(last.reason).toMatch(/한 곳/);
  });
});
