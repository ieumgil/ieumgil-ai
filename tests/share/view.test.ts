// 공유 링크를 열 때: 저장된 안(장소·순서·체류)으로 시각을 코드가 다시 계산해 확정 화면 값으로 만든다.
// 장소 정보는 저장값이 아니라 지금의 관광지 데이터에서 붙인다.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { toShareDoc } from "@/lib/share/doc";
import { shareToTripView } from "@/lib/share/view";
import type { Place } from "@/lib/types";
import type { TripView } from "@/lib/trip/view";

const trip = JSON.parse(readFileSync(resolve(__dirname, "../e2e/fixtures/trip-view.json"), "utf8")) as TripView;
const places = JSON.parse(readFileSync(resolve(__dirname, "../../data/places.json"), "utf8")) as Place[];

describe("공유 링크 → 화면 값", () => {
  it("만든 사람이 본 일정과 같은 장소·순서·시각(직선 추정)으로 다시 계산된다", () => {
    const o = trip.options[1];
    const v = shareToTripView(toShareDoc(trip, o), "Ab3dE5gH9k", places);
    expect(v.options).toHaveLength(1);
    const shared = v.options[0];
    expect(shared.draft).toEqual(o.draft);
    const visits = (x: typeof o) => x.days.flatMap((d) => d.items.flatMap((i) => (i.kind === "visit" ? [[i.placeId, i.arriveMin, i.departMin]] : [])));
    expect(visits(shared)).toEqual(visits(o));
    expect(shared.checkBeforeGo).toEqual(o.checkBeforeGo);
    for (const s of o.draft.days.flatMap((d) => d.stops)) {
      expect(v.places[s.placeId].phone).toBeTruthy();
      expect(v.judgments[s.placeId].verdict).toBe(trip.judgments[s.placeId].verdict);
    }
    expect(v.createdAt).toBe("share-Ab3dE5gH9k");
  });

  it("지금 데이터에 없는 장소는 빼고 보여준다(데이터가 바뀐 경우)", () => {
    const o = trip.options[0];
    const gone = o.draft.days[0].stops[0].placeId;
    const v = shareToTripView(toShareDoc(trip, o), "Ab3dE5gH9k", places.filter((p) => p.id !== gone));
    expect(v.options[0].draft.days[0].stops.map((s) => s.placeId)).not.toContain(gone);
  });
});
