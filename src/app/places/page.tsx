import type { Metadata } from "next";
import { Suspense } from "react";
import evidence from "../../../data/evidence.json";
import featured from "../../../data/featured.json";
import places from "../../../data/places.json";
import summaries from "../../../data/ai/summary.json";
import { toBrowsePlace, type BrowsePlace } from "@/lib/places/browse";
import type { PlaceSummary } from "@/lib/places/summary";
import type { Place } from "@/lib/types";
import { PlacesBrowser } from "./PlacesBrowser";

export const metadata: Metadata = { title: "관광지 둘러보기 · 이음길 AI" };

// 영동 관광지 둘러보기: 지역·분야로 둘러보고, 어떤 곳인지(AI 한 줄 소개·볼 거리·관광공사 소개·운영시간)와
// 고른 유형 기준 접근성 요약을 본 뒤 '꼭 가고 싶은 곳'으로 담는다. 데이터는 검수된 data/places.json 152곳.
const FEATURED = new Set(featured.ids);
const SUMMARY = (summaries as { places: Record<string, PlaceSummary> }).places;
const EV = evidence as Record<string, { id: string; text: string }[]>;
const list: BrowsePlace[] = (places as unknown as Place[]).map((p) => toBrowsePlace(p, SUMMARY[p.id], FEATURED.has(p.id), EV[p.id] ?? []));

export default function PlacesPage() {
  return (
    <Suspense fallback={null}>
      <PlacesBrowser places={list} />
    </Suspense>
  );
}
