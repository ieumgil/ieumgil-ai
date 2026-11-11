// 관광지 사진 고르기: 화장실 같은 편의시설·기타 사진은 대표가 되지 않고, 1유형이 3유형보다 먼저다
import { describe, expect, it } from "vitest";
import { compactPhotos, expandPhotos, pickCover, photoCredit, visiblePhotos, type LabeledPhoto, type PlacePhotos } from "@/lib/places/photos";

const P = (url: string, kogl_type: 1 | 3, kind: LabeledPhoto["kind"], cover_score?: number): LabeledPhoto => ({ url, kogl_type, kind, cover_score });

describe("대표 사진", () => {
  it("편의시설은 적합도가 높아도 대표가 되지 않고, 1유형 풍경이 3유형보다 먼저", () => {
    const photos = [P("toilet", 1, "facility", 3), P("view3", 3, "scenery", 3), P("view1a", 1, "scenery", 1), P("view1b", 1, "scenery", 2)];
    expect(pickCover(photos)?.url).toBe("view1b");
  });

  it("1유형 풍경이 없으면 3유형 풍경(원본 그대로 보여 줄 사진)", () => {
    const c = pickCover([P("toilet", 1, "facility"), P("sign", 3, "other"), P("view3", 3, "scenery", 2)]);
    expect(c).toMatchObject({ url: "view3", kogl_type: 3 });
  });

  it("풍경 사진이 없으면 대표 없음(분류 아이콘으로 대신)", () => {
    expect(pickCover([P("toilet", 1, "facility"), P("sign", 3, "other")])).toBeUndefined();
    expect(pickCover([])).toBeUndefined();
  });

  it("사람 확인이 분류보다 먼저: 고른 사진, 뺀 사진, '대표 없음'. 편의시설은 골라도 대표가 될 수 없다", () => {
    const photos = [P("a", 1, "scenery", 3), P("b", 1, "scenery", 1), P("t", 1, "facility")];
    expect(pickCover(photos, { cover: "b" })?.url).toBe("b");
    expect(pickCover(photos, { exclude: ["a"] })?.url).toBe("b");
    expect(pickCover(photos, { cover: null })).toBeUndefined();
    expect(pickCover(photos, { cover: "t" })?.url).toBe("a");
  });
});

describe("크게 보기 사진", () => {
  it("풍경 → 편의시설 순, 기타와 뺀 사진은 없음", () => {
    const photos = [P("f", 3, "facility"), P("o", 1, "other"), P("s", 3, "scenery"), P("x", 1, "scenery")];
    expect(visiblePhotos(photos, { exclude: ["x"] }).map((p) => p.url)).toEqual(["s", "f"]);
  });

  it("출처 문구", () => {
    expect(photoCredit(3)).toBe("사진: 한국관광공사 · 공공누리 제3유형");
  });
});

describe("화면용 압축본", () => {
  it("압축했다 풀면 같고, 작은 사진은 1유형 대표일 때만", () => {
    const base = "https://tong.visitkorea.or.kr/cms/resource/";
    const p1: PlacePhotos = {
      cover: { url: base + "1/a.jpg", kogl_type: 1, thumb: "/photos/GN03.webp" },
      photos: [{ url: base + "1/a.jpg", kogl_type: 1, kind: "scenery" }, { url: base + "2/t.jpg", kogl_type: 3, kind: "facility", facility: "toilet" }],
    };
    expect(expandPhotos("GN03", compactPhotos(p1))).toEqual(p1);
    const p3: PlacePhotos = { cover: { url: base + "3/v.jpg", kogl_type: 3 }, photos: [{ url: base + "3/v.jpg", kogl_type: 3, kind: "scenery" }] };
    expect(expandPhotos("DH01", compactPhotos(p3))).toEqual(p3);
    expect(expandPhotos("X", compactPhotos({ photos: [] }))).toEqual({ photos: [] });
  });
});

describe("분야 카드 배경 사진", () => {
  it("분야마다 1유형 대표 사진 파일이 있다(잘라 쓰는 자리라 1유형만)", async () => {
    const { existsSync } = await import("node:fs");
    const { CATEGORY_PHOTO, categoryThumb } = await import("@/lib/places/category-photos");
    const { photosOf } = await import("@/lib/places/client-photos");
    for (const c of Object.keys(CATEGORY_PHOTO) as (keyof typeof CATEGORY_PHOTO)[]) {
      expect(existsSync(`public${categoryThumb(c)}`), c).toBe(true);
      expect(photosOf(CATEGORY_PHOTO[c].id)?.cover?.kogl_type, c).toBe(1);
    }
  });
});
