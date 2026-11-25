// 고화질 대표 사진(11/25): 공개 저장소에 둘 수 있는 라이선스만, 출처(작가·원본·라이선스 링크)가 빠짐없이, 만든 WebP가 실제로 있는지.
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { photosOf } from "@/lib/places/client-photos";

type Row = { id: string; place: string; author: string; license: string; licenseUrl: string; page: string; original: string };
const read = (p: string) => JSON.parse(readFileSync(p, "utf8"));
const hires: { changes: string; photos: Row[] } = read("data/hires-photos.json");
const featured: { photos: Row[] } = read("data/featured-photos.json");
const places: { id: string; name: string }[] = read("data/places.json").places ?? read("data/places.json");
const ids = new Set(places.map((p) => p.id));
// 쓸 수 있는 것: CC0 · CC BY · CC BY-SA · 공공누리 제1유형. NC·ND·공공누리 2~4유형은 안 됨(자르고 줄이므로 변경 금지도 안 됨)
const ALLOWED = /^(CC0 1\.0|CC BY(-SA)? [0-9.]+|공공누리 제1유형)$/;

describe("고화질 대표 사진 목록", () => {
  it.each(hires.photos.map((p) => [p.id, p] as const))("%s: 허용 라이선스 · 출처 · 파일", (id, p) => {
    expect(ids.has(id), `${id}는 places.json에 없는 관광지`).toBe(true);
    expect(p.license).toMatch(ALLOWED);
    expect(p.author.trim()).not.toBe("");
    expect(p.page).toMatch(/^https:\/\//);
    expect(p.licenseUrl).toMatch(/^https:\/\//);
    expect(existsSync(`public/photos/hires/${id}.webp`), `public/photos/hires/${id}.webp 없음 — scripts/tour/featured-photos.ts로 만든다`).toBe(true);
  });

  it("시작 화면 대표 관광지 사진(featured)과 겹치지 않는다", () => {
    const f = new Set(featured.photos.map((p) => p.id));
    expect(hires.photos.filter((p) => f.has(p.id)).map((p) => p.id)).toEqual([]);
  });

  it("바꾼 점(4:3 자르기·줄이기)을 적어 둔다 — CC BY 조건", () => {
    expect(hires.changes).toContain("4:3");
  });
});

describe("화면 사진 찾기(photosOf)", () => {
  it("고화질이 있는 곳은 대표 사진과 크게 보기 첫 장이 고화질이고 출처가 붙는다", () => {
    const p = photosOf("GN03")!;
    expect(p.cover?.thumb).toBe("/photos/hires/GN03.webp");
    expect(p.cover?.credit?.license).toBe("CC BY-SA 3.0");
    expect(p.photos[0].credit?.author).toBe("Scroozle");
  });

  it("시작 화면 대표 관광지 사진도 모든 화면에서 대표로 쓴다", () => {
    expect(photosOf("GN12")?.cover?.thumb).toBe("/photos/featured/GN12.webp");
  });

  it("고화질이 없는 곳은 관광공사 사진 그대로(출처 없음 = 관광공사 표기)", () => {
    const none = places.find((p) => !hires.photos.some((h) => h.id === p.id) && !featured.photos.some((f) => f.id === p.id) && photosOf(p.id)?.cover);
    expect(none).toBeTruthy();
    expect(photosOf(none!.id)?.cover?.credit).toBeUndefined();
  });
});
