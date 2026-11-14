// 커밋된 실제 데이터(공중화장실 공공데이터)가 규칙을 지키는지 본다.
// 원본 CSV는 읽지 않는다(저장소에 없다) — data/public/restrooms.json만 읽는다.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { RestroomsFile } from "@/lib/public/restrooms";
import type { Place } from "@/lib/types";

const root = resolve(__dirname, "../..");
const readJson = <T>(path: string): T => JSON.parse(readFileSync(resolve(root, path), "utf8")) as T;

type Evidence = Record<string, { id: string; label: string; text: string }[]>;

describe("실제 데이터 — 공중화장실 공공데이터(커밋된 파일)", () => {
  it("restrooms.json에 강문해변(GN27)의 화장실이 근거 id와 함께 있다", () => {
    const file = readJson<RestroomsFile>("data/public/restrooms.json");
    const gn27 = file.places.GN27;
    expect(gn27).toBeDefined();
    const r = gn27.restrooms.find((x) => x.evidence_id === "public-화장실-1");
    expect(r).toBeDefined();
    expect(r?.name).toContain("강문해변");
  });

  it("evidence.json의 GN27에 공공데이터 문단이 있고 관광공사 문단은 앞에 그대로 있다", () => {
    const ev = readJson<Evidence>("data/evidence.json");
    const list = ev.GN27;
    const pub = list.findIndex((e) => e.id === "public-화장실-1");
    expect(pub).toBeGreaterThan(0);
    expect(list[pub].label).toBe("공공데이터·공중화장실");
    const tour = list.findIndex((e) => e.id === "class-1");
    expect(tour).toBeGreaterThanOrEqual(0);
    expect(tour).toBeLessThan(pub);
  });

  it("GN27.md에 공공데이터 구역과 관광공사 머리 줄이 함께 있다", () => {
    const md = readFileSync(resolve(root, "data/docs/places/GN27.md"), "utf8");
    expect(md).toContain("> 출처: 한국관광공사");
    expect(md).toContain("## 공공데이터 · 공중화장실");
    expect(md).toContain("`public-화장실-1` (공공데이터·공중화장실)");
  });

  it("places.json GN27 장애인 화장실은 공공데이터 가능이다", () => {
    const places = readJson<Place[]>("data/places.json");
    const item = places.find((p) => p.id === "GN27")?.access.accessible_toilet;
    expect(item?.value).toBe("가능");
    expect(item?.grade).toBe("public");
    expect(item?.method).toBe("공공데이터");
    expect(item?.evidence).toContain("public-화장실-1");
    expect(item?.ask).toBeUndefined();
  });

  it("places.json SC12(설악해맞이공원) 장애인 화장실은 불가에서 공공데이터 가능이 됐다", () => {
    const places = readJson<Place[]>("data/places.json");
    const item = places.find((p) => p.id === "SC12")?.access.accessible_toilet;
    expect(item?.value).toBe("가능");
    expect(item?.grade).toBe("public");
  });
});

