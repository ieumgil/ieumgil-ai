import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Place } from "@/lib/types";

/** 테스트 전용 샘플 장소(실제 관광지 아님). 매번 새 복사본을 돌려준다. */
export function loadSamplePlaces(): Place[] {
  const file = resolve(__dirname, "fixtures/places.sample.json");
  return JSON.parse(readFileSync(file, "utf8")) as Place[];
}
