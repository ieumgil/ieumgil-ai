// 시작 화면 대표 관광지 고화질 사진(11/25): 저작권 걱정이 없는 원본만 쓰고, 출처를 빠짐없이 적는다.
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import featured from "../../data/featured.json";
import credits from "../../data/featured-photos.json";
import routePhotos from "../../data/route-photos.json";
import { ROUTE_CARDS } from "@/lib/trip/route-cards";

const ALLOWED = ["CC0 1.0", "CC BY 3.0", "CC BY 4.0", "공공누리 제1유형"];

describe("대표 관광지 고화질 사진 출처(data/featured-photos.json)", () => {
  it("라이선스는 CC0 · CC BY · 공공누리 제1유형만이고, 작가·원본 페이지·라이선스 주소·원본 파일이 모두 있다", () => {
    expect(credits.photos.length).toBeGreaterThan(0);
    for (const p of credits.photos) {
      expect(ALLOWED, p.id).toContain(p.license);
      expect(p.author.trim(), p.id).not.toBe("");
      expect(p.page, p.id).toMatch(/^https:\/\//);
      expect(p.licenseUrl, p.id).toMatch(/^https:\/\//);
      expect(p.original, p.id).toMatch(/^https:\/\//);
      expect(p.original, p.id).not.toContain("utm_");
    }
  });

  it("CC BY를 고쳐 쓰므로 바꾼 점(changes)을 적어 둔다", () => {
    expect(credits.changes).toMatch(/자르고/);
  });

  it("대표 관광지에만 쓰고, 사진 파일(public/photos/featured/{id}.webp)이 모두 있다 · 원본은 1200px 이상", () => {
    for (const p of credits.photos) {
      expect(featured.ids, p.id).toContain(p.id);
      expect(existsSync(`public/photos/featured/${p.id}.webp`), p.id).toBe(true);
      expect(Math.max(...p.size), p.id).toBeGreaterThanOrEqual(1200);
    }
  });

  it("같은 관광지가 두 번 나오지 않는다", () => {
    const ids = credits.photos.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(readFileSync("data/featured-photos.json", "utf8")).not.toContain("?utm");
  });
});

// 루트 카드 3장 사진(11/25): 같은 기준(CC0 · 공공누리 제1유형), 카드마다 하나씩, 파일이 있다

describe("루트 카드 사진 출처(data/route-photos.json)", () => {
  it("고화질로 바꾼 카드(public/photos/route/)마다 출처가 있고, 라이선스는 CC0 · 공공누리 제1유형만, 원본 페이지 주소가 있다", () => {
    const replaced = ROUTE_CARDS.filter((c) => c.photo.startsWith("/photos/route/")).map((c) => c.id);
    expect(routePhotos.photos.map((p) => p.id).sort()).toEqual(replaced.sort());
    for (const p of routePhotos.photos) {
      expect(["CC0", "공공누리 제1유형"], p.id).toContain(p.license);
      expect(p.page, p.id).toMatch(/^https:\/\//);
      expect(p.licenseUrl, p.id).toMatch(/^https:\/\//);
      if (p.license === "공공누리 제1유형") expect(p.author.trim(), p.id).not.toBe(""); // 출처 표시 필수
    }
  });

  it("카드가 쓰는 사진 파일이 모두 있다", () => {
    for (const c of ROUTE_CARDS) expect(existsSync(`public${c.photo}`), c.id).toBe(true);
  });
});
