// 커밋된 실제 데이터(공중화장실 공공데이터)가 규칙을 지키는지 본다.
// 원본 CSV는 읽지 않는다(저장소에 없다) — data/public/restrooms.json만 읽는다.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { PlaceRestrooms, Restroom, RestroomsFile } from "@/lib/public/restrooms";
import { PUBLIC_EVIDENCE_LABEL, PUBLIC_RESTROOM_SOURCE, isPublicEvidenceId } from "@/lib/public/source";
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

// ───────────────────────── 장소 전체 불변식 ─────────────────────────
// 숫자(36·31·816)는 박지 않는다 — restrooms.json의 source와 서로 맞는지로 본다(원본을 새로 받아 다시 만들어도 의미가 같다).

const file = readJson<RestroomsFile>("data/public/restrooms.json");
const places = readJson<Place[]>("data/places.json");
const evidence = readJson<Evidence>("data/evidence.json");
const md = (id: string) => readFileSync(resolve(root, `data/docs/places/${id}.md`), "utf8");

const publicEvidenceOf = (id: string) => (evidence[id] ?? []).filter((e) => isPublicEvidenceId(e.id));
const hasToilet = (r: Restroom) => r.disabled_m + r.disabled_f >= 1;
const counted = (r: Restroom) => r.open !== "미개방";
/** 받쳐 주는 화장실: 미개방이 아님 + 칸 1개 이상 / 기저귀 Y */
const toiletSupport = (e: PlaceRestrooms | undefined) => (e?.restrooms ?? []).filter((r) => counted(r) && hasToilet(r));
const diaperSupport = (e: PlaceRestrooms | undefined) => (e?.restrooms ?? []).filter((r) => counted(r) && r.diaper);

describe("실제 데이터 불변식(D-03·D-05·D-07·L1)", () => {
  it("source: 출처 상수가 같고, 통계가 서로 맞는다", () => {
    const s = file.source;
    expect(s.url).toBe(PUBLIC_RESTROOM_SOURCE.url);
    expect(s.license).toBe(PUBLIC_RESTROOM_SOURCE.license);
    expect(s.dataset).toBe(PUBLIC_RESTROOM_SOURCE.dataset);
    expect(s.provider).toBe(PUBLIC_RESTROOM_SOURCE.provider);
    expect(s.by_city.강릉 + s.by_city.속초 + s.by_city.동해).toBe(s.rows_3_cities);
    expect(s.matched_places).toBe(Object.keys(file.places).length);
    const withValues = Object.values(file.places).filter((p) => p.restrooms.some((r) => r.evidence_id)).length;
    expect(s.places_with_values).toBe(withValues);
    expect(s.dates.length).toBeGreaterThan(0);
  });

  it("화장실 한 건에는 필요한 칸만 있다(전화번호·관리기관명·주소 없음, 원칙 5)", () => {
    const allowed = new Set(["no", "name", "kind", "disabled_m", "disabled_f", "diaper", "diaper_place", "open", "date", "evidence_id"]);
    for (const [id, p] of Object.entries(file.places)) {
      expect(Object.keys(p).sort(), id).toEqual(["name_ko", "restrooms"]);
      for (const r of p.restrooms) {
        for (const k of Object.keys(r)) expect(allowed.has(k), `${id} ${k}`).toBe(true);
      }
    }
    const raw = readFileSync(resolve(root, "data/public/restrooms.json"), "utf8");
    expect(raw).not.toMatch(/관리기관|전화번호|도로명주소|지번주소/);
  });

  it("restrooms.json의 장소는 모두 places.json에 있고, 근거 id는 있음 화장실에만 차례로 붙는다", () => {
    const ids = new Set(places.map((p) => p.id));
    for (const [id, p] of Object.entries(file.places)) {
      expect(ids.has(id), id).toBe(true);
      expect(p.name_ko).toBe(places.find((x) => x.id === id)?.name_ko);
      const present = p.restrooms.filter((r) => counted(r) && (hasToilet(r) || r.diaper));
      expect(
        p.restrooms.filter((r) => r.evidence_id),
        id,
      ).toEqual(present.map((r, i) => ({ ...r, evidence_id: `public-화장실-${i + 1}` })));
    }
  });

  it("places.json의 grade public 값은 근거·출처·메모가 모두 짝이 맞는다", () => {
    let count = 0;
    for (const place of places) {
      const entry = file.places[place.id];
      for (const [key, item] of Object.entries(place.access)) {
        if (item.grade !== "public") continue;
        count++;
        const where = `${place.id} ${key}`;
        expect(entry, where).toBeDefined();
        expect(item.value, where).toBe("가능");
        expect(item.ask, where).toBeUndefined();
        expect(item.source_url, where).toBe(PUBLIC_RESTROOM_SOURCE.url);
        expect(item.method, where).toBe("공공데이터");
        expect(file.source.dates, where).toContain(item.verified_at);
        expect(item.note, where).toContain("공중화장실 '");
        const publicIds = (item.evidence ?? []).filter(isPublicEvidenceId);
        expect(publicIds.length, where).toBeGreaterThan(0);
        const own = new Set((entry as PlaceRestrooms).restrooms.flatMap((r) => (r.evidence_id ? [r.evidence_id] : [])));
        const inEvidence = new Map(publicEvidenceOf(place.id).map((e) => [e.id, e.label]));
        const doc = md(place.id);
        for (const pid of publicIds) {
          expect(own.has(pid), `${where} ${pid}`).toBe(true);
          expect(inEvidence.get(pid), `${where} ${pid}`).toBe(PUBLIC_EVIDENCE_LABEL);
          expect(doc, `${where} ${pid}`).toContain(`\`${pid}\` (${PUBLIC_EVIDENCE_LABEL})`);
        }
      }
    }
    expect(count).toBeGreaterThan(0);
  });

  it("restrooms.json에 없는 장소에는 public 값도 public 문단도 없다", () => {
    for (const place of places) {
      if (file.places[place.id]) continue;
      for (const [key, item] of Object.entries(place.access)) expect(item.grade, `${place.id} ${key}`).not.toBe("public");
      expect(publicEvidenceOf(place.id), place.id).toEqual([]);
      expect(md(place.id), place.id).not.toContain("## 공공데이터");
    }
  });

  it("문단은 restrooms.json의 근거 id와 정확히 같고, md에는 있을 때만 구역이 있다", () => {
    for (const place of places) {
      const entry = file.places[place.id];
      const expected = (entry?.restrooms ?? []).flatMap((r) => (r.evidence_id ? [r.evidence_id] : []));
      expect(
        publicEvidenceOf(place.id).map((e) => e.id),
        place.id,
      ).toEqual(expected);
      expect(md(place.id).includes("## 공공데이터 · 공중화장실"), place.id).toBe(expected.length > 0);
    }
  });

  it("받쳐 주는 화장실이 없으면 그 항목은 public이 아니고, 있으면(사람 값이 아닌 한) public이다(D-03)", () => {
    for (const place of places) {
      const entry = file.places[place.id];
      const cases = [
        ["accessible_toilet", toiletSupport(entry).length > 0],
        ["diaper_nursing", diaperSupport(entry).length > 0],
      ] as const;
      for (const [key, supported] of cases) {
        const item = place.access[key];
        if (item.grade === "human") continue;
        expect(item.grade === "public", `${place.id} ${key}`).toBe(supported);
      }
    }
    // 근거 사례: 이름은 맞지만 장애인 칸이 없는 곳은 AI 값 그대로(모름 + 질문)
    if (file.places.GN73 && toiletSupport(file.places.GN73).length === 0) {
      const gn73 = places.find((p) => p.id === "GN73")?.access.accessible_toilet;
      expect(gn73?.grade).toBe("ai");
      expect(gn73?.value).toBe("모름");
      expect(gn73?.ask).toBeTruthy();
    }
  });

  it("기저귀 교환대 메모: 공공데이터 근거만이면 '수유실 정보 없음', 관광공사 근거가 섞이면 없다(L1)", () => {
    let onlyPublic = 0;
    for (const place of places) {
      const item = place.access.diaper_nursing;
      if (item.grade !== "public") continue;
      const allPublic = (item.evidence ?? []).every(isPublicEvidenceId);
      expect(item.note?.includes("수유실 정보 없음"), place.id).toBe(allPublic);
      if (allPublic) onlyPublic++;
    }
    expect(onlyPublic).toBeGreaterThan(0);
  });

  it("보고서에 짝지은 장소가 모두 있고, 주유소·다른 시 제외 사례가 적혀 있다", () => {
    const report = readFileSync(resolve(root, "docs/data/public-restrooms.md"), "utf8");
    for (const id of Object.keys(file.places)) expect(report, id).toContain(`| ${id} |`);
    const excluded = report.slice(report.indexOf("## 제외한 짝"), report.indexOf("## 짝지은 관광지"));
    expect(excluded).toContain("주유소");
    expect(excluded).toContain("다른 시");
    expect(report).toContain(PUBLIC_RESTROOM_SOURCE.url);
  });

  it("빌드 스크립트(build-places·merge-places)는 원본 CSV를 읽지 않는다", () => {
    for (const f of ["scripts/tour/build-places.ts", "scripts/ai/merge-places.ts"]) {
      const src = readFileSync(resolve(root, f), "utf8");
      expect(src, f).toContain("data/public/restrooms.json");
      expect(src, f).not.toContain("public-restrooms-gangwon");
      expect(src, f).not.toContain("data/raw/public");
    }
  });
});
