import type { Metadata } from "next";
import places from "../../../../data/places.json";
import type { Place } from "@/lib/types";
import { TasteStep, type PlaceOption } from "./TasteStep";

export const metadata: Metadata = { title: "좋아하는 곳 · 이음길 AI" };

// '꼭 가고 싶은 곳' 검색 목록. 검수된 실제 데이터(data/places.json)만 쓴다.
const options: PlaceOption[] = (places as Place[]).map((p) => ({ id: p.id, name: p.name_ko, region: p.region }));

export default function Page() {
  return <TasteStep places={options} />;
}
