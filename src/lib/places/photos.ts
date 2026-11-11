// 관광지 사진: 관광공사 API(detailImage2) 사진을 미리 분류한 결과(data/photos.json)로 대표 사진·사진 목록을 고른다.
// 규칙(코드가 강제):
// - 편의시설(화장실 등)·기타(안내문·음식·광고 등) 사진은 대표가 되지 않는다. 대표는 풍경·건물 사진만.
// - 공공누리 1유형을 먼저 고르고(잘라서 작은 사진으로 저장해 둠), 없으면 3유형 풍경 사진.
//   3유형은 '변경 금지'라 자르거나 고쳐서 저장하지 않고, 원본 주소를 그대로 불러와 사진 전체를 보여 준다(object-contain).
// - 사람이 확인한 덮어쓰기(data/photos.overrides.json)가 분류보다 먼저다.
// - 모든 사진에 출처(한국관광공사 · 공공누리 유형)를 붙인다.

export type PhotoKind = "scenery" | "facility" | "other";
export type FacilityKind = "toilet" | "elevator" | "parking" | "ramp" | "entrance" | "etc";

export interface LabeledPhoto {
  url: string;
  kogl_type: 1 | 3;
  kind: PhotoKind;
  facility?: FacilityKind;
  /** 대표 사진 적합도 0~3(3이 가장 좋음) */
  cover_score?: number;
}

export interface PlacePhotos {
  /** 대표 사진. thumb는 1유형만(미리 줄여 둔 public/photos/{id}.webp), 3유형은 원본을 통째로 보여 준다 */
  cover?: { url: string; kogl_type: 1 | 3; thumb?: string };
  /** 크게 보기에 보여 줄 사진(기타는 뺌): 풍경 → 편의시설 순 */
  photos: LabeledPhoto[];
}

export interface PhotoOverride {
  /** 대표 사진으로 쓸 원본 주소(null이면 대표 사진 없음) */
  cover?: string | null;
  /** 보여 주지 않을 사진 주소 */
  exclude?: string[];
}

export const FACILITY_LABEL: Record<FacilityKind, string> = {
  toilet: "화장실",
  elevator: "엘리베이터",
  parking: "주차장",
  ramp: "경사로",
  entrance: "출입구",
  etc: "편의시설",
};

export function photoCredit(kogl: number): string {
  return `사진: 한국관광공사 · 공공누리 제${kogl}유형`;
}

/** 대표 사진으로 쓸 수 있는가: 풍경·건물 사진 */
export const coverEligible = (p: LabeledPhoto) => p.kind === "scenery";

/** 대표 사진 고르기: 사람 덮어쓰기 > 1유형 > 3유형, 같은 유형 안에서는 적합도가 높은 것(같으면 API 순서) */
export function pickCover(photos: LabeledPhoto[], override?: PhotoOverride): LabeledPhoto | undefined {
  const shown = photos.filter((p) => !(override?.exclude ?? []).includes(p.url));
  if (override && "cover" in override) {
    if (override.cover === null) return undefined;
    const chosen = shown.find((p) => p.url === override.cover);
    if (chosen && coverEligible(chosen)) return chosen;
  }
  return shown
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => coverEligible(p))
    .sort((a, b) => a.p.kogl_type - b.p.kogl_type || (b.p.cover_score ?? 1) - (a.p.cover_score ?? 1) || a.i - b.i)[0]?.p;
}

/** 크게 보기에 보여 줄 사진: 덮어쓰기로 뺀 것과 '기타'는 빼고, 풍경 → 편의시설 순 */
export function visiblePhotos(photos: LabeledPhoto[], override?: PhotoOverride): LabeledPhoto[] {
  const ex = new Set(override?.exclude ?? []);
  return photos.filter((p) => !ex.has(p.url) && p.kind !== "other").sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "scenery" ? -1 : 1));
}

/* ── 화면용 압축본(src/lib/places/photo-index.json): 주소 앞부분을 빼고 배열로 ── */

export const PHOTO_BASE = "https://tong.visitkorea.or.kr/cms/resource/";
const KIND_CODE = { scenery: 0, facility: 1 } as const;
const FACILITY_CODES: FacilityKind[] = ["toilet", "elevator", "parking", "ramp", "entrance", "etc"];

/** [대표 사진 위치(-1 = 없음), [주소 뒷부분, 유형, 종류(0 풍경·1 편의시설), 편의시설 번호?][]] */
export type CompactPhotos = [number, [string, 1 | 3, 0 | 1, number?][]];

export function compactPhotos(p: PlacePhotos): CompactPhotos {
  const rows = p.photos.map((x) => {
    const row: [string, 1 | 3, 0 | 1, number?] = [x.url.replace(PHOTO_BASE, ""), x.kogl_type, KIND_CODE[x.kind as "scenery" | "facility"]];
    if (x.kind === "facility") row.push(FACILITY_CODES.indexOf(x.facility ?? "etc"));
    return row;
  });
  return [p.cover ? p.photos.findIndex((x) => x.url === p.cover!.url) : -1, rows];
}

export function expandPhotos(id: string, c: CompactPhotos): PlacePhotos {
  const photos: LabeledPhoto[] = c[1].map(([path, kogl, kind, fac]) => ({
    url: path.startsWith("http") ? path : PHOTO_BASE + path,
    kogl_type: kogl,
    kind: kind === 1 ? "facility" : "scenery",
    ...(kind === 1 ? { facility: FACILITY_CODES[fac ?? 5] } : {}),
  }));
  const cover = c[0] >= 0 ? photos[c[0]] : undefined;
  return { photos, ...(cover ? { cover: { url: cover.url, kogl_type: cover.kogl_type, ...(cover.kogl_type === 1 ? { thumb: `/photos/${id}.webp` } : {}) } } : {}) };
}
