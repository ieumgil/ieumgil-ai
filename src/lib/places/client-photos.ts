// 화면에서 쓰는 관광지 사진 찾기(압축본 photo-index.json, 약 5KB). scripts/tour/classify-photos.ts가 만든다.
// 고화질 대표 사진(11/25): data/hires-photos.json · data/featured-photos.json에 있는 곳은 대표 사진을 그 사진(1200×900 WebP)으로 바꾸고,
// 크게 보기 맨 앞에 넣는다. 이 사진들은 관광공사 사진이 아니라서 작가·원본·라이선스를 함께 들고 다닌다(PhotoCredit).
import featured from "../../../data/featured-photos.json";
import hires from "../../../data/hires-photos.json";
import index from "./photo-index.json";
import { expandPhotos, type CompactPhotos, type LabeledPhoto, type PhotoCredit, type PlacePhotos } from "./photos";

type CreditRow = { id: string; author: string; license: string; licenseUrl: string; page: string };
const HIRES = new Map<string, { src: string; credit: PhotoCredit }>();
for (const [rows, dir, changes] of [
  [featured.photos, "featured", featured.changes],
  [hires.photos, "hires", hires.changes],
] as [CreditRow[], string, string][]) {
  for (const r of rows) HIRES.set(r.id, { src: `/photos/${dir}/${r.id}.webp`, credit: { author: r.author, license: r.license, licenseUrl: r.licenseUrl, page: r.page, changes } });
}

const cache = new Map<string, PlacePhotos | null>();

export function photosOf(id: string): PlacePhotos | null {
  if (!cache.has(id)) {
    const c = (index as unknown as Record<string, CompactPhotos>)[id];
    const base = c ? expandPhotos(id, c) : null;
    const hi = HIRES.get(id);
    if (hi) {
      const top: LabeledPhoto = { url: hi.src, kogl_type: 1, kind: "scenery", credit: hi.credit };
      cache.set(id, { cover: { url: hi.src, kogl_type: 1, thumb: hi.src, credit: hi.credit }, photos: [top, ...(base?.photos ?? [])] });
    } else cache.set(id, base);
  }
  return cache.get(id)!;
}
