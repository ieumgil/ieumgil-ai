// 어려운 곳 목록과 대안(기획 '어려운 곳과 대안', 11/14). AI를 더 부르지 않는다.
// - 고르는 곳: 꼭 가고 싶은 곳 · 대표 관광지 · 좋아하는 분야 중, 이 사람 조건으로 어려운 곳
//   (필수 조건 '불가'·걷는 거리 초과로 후보에서 빠짐 / 여행 날짜에 쉼 / AI 판단 '부적합').
//   꼭 가고 싶은 곳이 아니면 여행 지역(일정에 든 장소의 지역) 안에서만.
// - 이유: 코드 하한 문장 또는 ② 판단 이유 그대로.
// - 대안: 같은 분야의 갈 만한 곳(판단한 후보 중 부적합이 아니고 일정에 없는 곳) 하나. 적합·주의 먼저, 그중 가까운 곳. 15km 안.
//   대안의 이유는 화면에서 ② 판단 이유를 그대로 쓴다.

import type { Verdict } from "../ai/guards";
import type { Excluded } from "../engine/filter";
import { haversineKm } from "../engine/travel";
import type { Category, Place } from "../types";
import type { PoolPlace } from "./alternatives";

export type HardKind = "조건" | "휴무" | "AI 판단";

export interface HardPlace {
  placeId: string;
  kind: HardKind;
  reasons: string[];
  mustVisit: boolean;
  /** 대신 갈 만한 곳(없을 수 있음) */
  altId?: string;
}

export interface HardSource {
  excluded: Excluded[];
  judgedUnfit: { place: Place; reasons: string[] }[];
  pool: PoolPlace[];
  categories: Category[];
  featured: ReadonlySet<string>;
  regions: ReadonlySet<string>;
  inPlan: ReadonlySet<string>;
}

const ALT_KM = 15;
const RANK: Partial<Record<Verdict, number>> = { 적합: 0, 주의: 0, "확인 필요": 1 };

export const HARD_MAX = 5;

export function pickHardPlaces(s: HardSource, max = HARD_MAX): HardPlace[] {
  const all: (HardPlace & { place: Place })[] = [
    ...s.excluded.map((e) => ({
      place: e.place,
      placeId: e.place.id,
      kind: (e.reasons.some((r) => r.startsWith("여행 날짜에 쉬어요")) ? "휴무" : "조건") as HardKind,
      reasons: e.reasons,
      mustVisit: e.mustVisit,
    })),
    ...s.judgedUnfit.map((j) => ({ place: j.place, placeId: j.place.id, kind: "AI 판단" as HardKind, reasons: j.reasons, mustVisit: false })),
  ];
  const liked = (p: Place) => s.categories.includes(p.category);
  const picked = all
    .filter((h) => h.mustVisit || (s.regions.has(h.place.region) && (s.featured.has(h.placeId) || liked(h.place))))
    .map((h, i) => ({ h, i }))
    .sort(
      (a, b) =>
        Number(b.h.mustVisit) - Number(a.h.mustVisit) ||
        Number(s.featured.has(b.h.placeId)) - Number(s.featured.has(a.h.placeId)) ||
        Number(liked(b.h.place)) - Number(liked(a.h.place)) ||
        a.i - b.i,
    )
    .slice(0, max)
    .map(({ h }) => h);

  return picked.map(({ place, ...h }) => {
    const alt = s.pool
      .filter((c) => c.place.category === place.category && c.place.id !== place.id && !s.inPlan.has(c.place.id) && RANK[c.verdict] !== undefined)
      .map((c) => ({ id: c.place.id, rank: RANK[c.verdict]!, km: haversineKm(place, c.place) }))
      .filter((c) => c.km <= ALT_KM)
      .sort((a, b) => a.rank - b.rank || a.km - b.km)[0];
    return alt ? { ...h, altId: alt.id } : h;
  });
}
