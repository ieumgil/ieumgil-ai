// 화면에서 쓰는 관광지 사진 찾기(압축본 photo-index.json, 약 5KB). scripts/tour/classify-photos.ts가 만든다.
import index from "./photo-index.json";
import { expandPhotos, type CompactPhotos, type PlacePhotos } from "./photos";

const cache = new Map<string, PlacePhotos | null>();

export function photosOf(id: string): PlacePhotos | null {
  if (!cache.has(id)) {
    const c = (index as unknown as Record<string, CompactPhotos>)[id];
    cache.set(id, c ? expandPhotos(id, c) : null);
  }
  return cache.get(id)!;
}
