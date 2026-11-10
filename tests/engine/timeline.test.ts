import { describe, expect, it } from "vitest";
import { closedOn, matchesClosedText, seasonOf } from "@/lib/engine/closed";
import { computeDay } from "@/lib/engine/timeline";
import { estimateLeg } from "@/lib/engine/travel";
import type { DayFrame } from "@/lib/engine/types";
import { makePlace } from "./fixture";

describe("휴무일 글자 해석", () => {
  it("날짜·설·추석·연휴", () => {
    expect(matchesClosedText("1월 1일", "2027-01-01")).toBe(true);
    expect(matchesClosedText("1월1일", "2026-11-21")).toBe(false);
    expect(matchesClosedText("설날", "2027-02-07")).toBe(true);
    expect(matchesClosedText("설 연휴", "2027-02-08")).toBe(true);
    expect(matchesClosedText("추석 당일 (오죽헌만 개방, 실내 전시실 휴관)", "2026-09-25")).toBe(true);
    expect(matchesClosedText("기관 사정에 따라 변동", "2026-11-21")).toBeNull();
  });
  it("매주 휴무 요일과 해석 못 한 글자", () => {
    expect(closedOn({ closed_weekdays: ["토"] }, "2026-11-21")).toMatchObject({ closed: true });
    expect(closedOn({ closed_dates: ["임시 휴관"] }, "2026-11-21")).toEqual({ closed: false, unknown: ["임시 휴관"] });
  });
  it("하절기 3~10월, 동절기 11~2월", () => {
    expect(seasonOf("2026-10-31")).toBe("summer");
    expect(seasonOf("2026-11-21")).toBe("winter");
  });
});

describe("시각 계산", () => {
  const home = { id: "home", name: "출발", lat: 37.77, lng: 128.89 };
  const frame: DayFrame = { date: "2026-11-21", startMin: 600, endMin: 1020, start: home, end: home };
  const a = makePlace("GN91", { lat: 37.77, lng: 128.89 });
  const b = makePlace("GN92", { lat: 37.78, lng: 128.9, hours: { summer: { open: "13:30", close: "18:00" }, winter: { open: "13:30", close: "18:00" } } });
  const byId = new Map([a, b].map((p) => [p.id, p]));
  const opts = { bufferRatio: 0.25, boardingMin: 10, restMin: 20, lunchMin: 60 };

  it("체류 + 여유 25% + 승하차 10분, 12~14시에 걸리면 점심 60분, 열기 전이면 기다린다", () => {
    const tl = computeDay(frame, { date: frame.date, stops: [{ placeId: "GN91", stayMin: 200 }, { placeId: "GN92", stayMin: 40 }] }, byId, estimateLeg, opts);
    const visit = tl.items.find((i) => i.kind === "visit" && i.placeId === "GN91");
    expect(visit).toMatchObject({ stayMin: 60, extraMin: 25 }); // 200분은 범위(40~60)로 맞춤, 60×25%=15 + 10
    expect(tl.items.some((i) => i.kind === "lunch")).toBe(true);
    expect(tl.items.some((i) => i.kind === "wait" && i.placeId === "GN92")).toBe(true);
    expect(tl.estimatedTravel).toBe(true);
  });

  it("이동시간 추정: 강릉역→오죽헌 근처 거리(실제 카카오 8분·2.9km)와 비슷하다", () => {
    const leg = estimateLeg({ id: "s", name: "강릉역", lat: 37.7646, lng: 128.8996 }, { id: "o", name: "오죽헌", lat: 37.7791, lng: 128.8788 });
    expect(leg.minutes).toBeGreaterThanOrEqual(6);
    expect(leg.minutes).toBeLessThanOrEqual(15);
  });
});
