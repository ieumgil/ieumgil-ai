// 지도 점: 출발 → 장소(타임라인 번호와 같은 1, 2, 3…) → 도착. 안 비교 화면과 확정 화면이 같이 쓴다.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { dayMapLabel, dayMapPoints, visitsOf } from "@/lib/trip/map-points";
import type { TripView } from "@/lib/trip/view";

const trip = JSON.parse(readFileSync(resolve(__dirname, "../../e2e/fixtures/trip-view.json"), "utf8")) as TripView;

describe("하루 지도 점", () => {
  it("출발 · 방문 순서대로 번호 · 도착", () => {
    const o = trip.options[0];
    o.days.forEach((d, di) => {
      const pts = dayMapPoints(trip, o, di);
      const visits = visitsOf(d);
      expect(pts[0]).toMatchObject({ kind: "start", label: "출발", lat: trip.frames[di].start.lat });
      expect(pts.at(-1)).toMatchObject({ kind: "end", label: "도착", lng: trip.frames[di].end.lng });
      expect(pts.slice(1, -1).map((p) => [p.id, p.label])).toEqual(visits.map((v, i) => [v.placeId, String(i + 1)]));
      expect(pts.slice(1, -1).every((p) => p.lat === trip.placeData[p.id].lat && p.lng === trip.placeData[p.id].lng)).toBe(true);
    });
  });

  it("화면 읽기용 설명은 날짜와 순서를 말로", () => {
    const o = trip.options[0];
    const first = trip.places[visitsOf(o.days[0])[0].placeId].name;
    expect(dayMapLabel(trip, o, 0)).toMatch(new RegExp(`^1일째 지도: ${o.days[0].startName} → 1 ${first}`));
    expect(dayMapLabel(trip, o, 0).endsWith(o.days[0].endName)).toBe(true);
  });

  it("없는 날짜를 물으면 첫날로", () => {
    const o = trip.options[0];
    expect(dayMapPoints(trip, o, 9).map((p) => p.id)).toEqual(dayMapPoints(trip, o, 0).map((p) => p.id));
  });
});
