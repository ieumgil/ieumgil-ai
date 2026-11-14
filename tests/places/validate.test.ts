import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { validatePlaces } from "@/lib/places/validate";
import { publicParagraphs, type RestroomsFile } from "@/lib/public/restrooms";
import { PUBLIC_RESTROOM_SOURCE } from "@/lib/public/source";
import type { AccessItem } from "@/lib/types";
import { loadSamplePlaces } from "../helpers";

const messagesOf = (data: unknown) =>
  validatePlaces(data)
    .issues.map((i) => i.message)
    .join("\n");

describe("장소 데이터 검사", () => {
  it("샘플 데이터는 통과한다", () => {
    expect(validatePlaces(loadSamplePlaces())).toEqual({ ok: true, issues: [] });
  });

  it("실제 데이터(data/places.json)는 근거 목록(data/evidence.json)과 함께 검사해도 통과한다", () => {
    const real = JSON.parse(readFileSync(resolve(__dirname, "../../data/places.json"), "utf8"));
    const evidence = JSON.parse(readFileSync(resolve(__dirname, "../../data/evidence.json"), "utf8"));
    const result = validatePlaces(real, evidence);
    expect(result.issues).toEqual([]);
  });

  describe("'모름'은 숨기지 않고 확인할 방법을 준다 (원칙 2)", () => {
    it("'모름'이어도 질문이 있으면 통과한다", () => {
      const places = loadSamplePlaces();
      places[1].access.elevator = { value: "모름", ask: "2층 전시실에 엘리베이터로 갈 수 있나요?", grade: "ai", method: "관광공사 API", verified_at: "2026-11-10" };
      expect(validatePlaces(places)).toEqual({ ok: true, issues: [] });
    });

    it("'모름'인데 질문이 없으면 실패한다", () => {
      const places = loadSamplePlaces();
      places[1].access.elevator = { value: "모름", grade: "ai", method: "관광공사 API", verified_at: "2026-11-10" };
      const result = validatePlaces(places);
      expect(result.ok).toBe(false);
      expect(result.issues[0]).toMatchObject({ placeId: "GN92", path: "[1].access.elevator" });
    });

    it("질문이 빈 문자열이어도 실패한다", () => {
      const places = loadSamplePlaces();
      places[1].access.elevator = { value: "모름", ask: "  ", grade: "ai", method: "관광공사 API", verified_at: "2026-11-10" };
      expect(messagesOf(places)).toContain("질문");
    });

    it("예전 값 '미확인'은 거부한다", () => {
      const places = loadSamplePlaces();
      (places[1].access.elevator as { value: string }).value = "미확인";
      expect(messagesOf(places)).toContain("모름");
    });

    it("전화번호가 없으면 실패한다", () => {
      const places = loadSamplePlaces();
      delete (places[0] as { phone?: string }).phone;
      expect(messagesOf(places)).toContain("phone");
    });

    it("전화번호에 숫자가 없으면 실패한다", () => {
      const places = loadSamplePlaces();
      places[1].phone = "문의 바람";
      expect(messagesOf(places)).toContain("전화번호");
    });

    it("운영시간을 모르면 질문이 있어야 한다", () => {
      const places = loadSamplePlaces();
      places[0].hours = { closed_weekdays: ["월"] };
      expect(messagesOf(places)).toContain("운영시간");
      places[0].hours.ask = "평일 몇 시부터 몇 시까지 여나요?";
      expect(validatePlaces(places).ok).toBe(true);
    });
  });

  describe("AI 정리 값의 근거", () => {
    it("AI가 정리한 값(모름 제외)은 근거 id가 있어야 한다", () => {
      const places = loadSamplePlaces();
      places[0].access.slope = { value: "가능", grade: "ai", method: "관광공사 API", verified_at: "2026-11-10", evidence: [] };
      expect(validatePlaces(places).issues[0]).toMatchObject({ placeId: "GN91", path: "[0].access.slope" });
    });

    it("사람이 확인한 값은 근거 id가 없어도 된다", () => {
      const places = loadSamplePlaces();
      places[0].access.slope = { value: "가능", grade: "human", method: "전화 확인", verified_at: "2026-11-12" };
      expect(validatePlaces(places).ok).toBe(true);
    });

    it("등급(ai/human)이 없으면 실패한다", () => {
      const places = loadSamplePlaces();
      delete (places[0].access.slope as { grade?: string }).grade;
      expect(validatePlaces(places).ok).toBe(false);
    });

    it("도착 후 동선(on_site)도 근거 id가 있어야 한다", () => {
      const places = loadSamplePlaces();
      places[0].on_site = { text: "주차장에서 경사로로 정문", evidence: [], grade: "ai" };
      expect(messagesOf(places)).toContain("동선");
    });
  });

  describe("공공데이터 값(public, D-06)", () => {
    const publicValue = (patch: Partial<AccessItem> = {}): AccessItem => ({
      value: "가능",
      note: "공중화장실 'A' · 장애인 칸 1",
      evidence: ["public-화장실-1"],
      grade: "public",
      method: "공공데이터",
      verified_at: "2024-12-31",
      source_url: PUBLIC_RESTROOM_SOURCE.url,
      ...patch,
    });
    const withPublic = (patch: Partial<AccessItem> = {}) => {
      const places = loadSamplePlaces();
      places[0].access.accessible_toilet = publicValue(patch);
      return places;
    };

    it("가능 + public 근거 + 원본 주소 + 방법 공공데이터면 통과한다", () => {
      expect(validatePlaces(withPublic())).toEqual({ ok: true, issues: [] });
    });

    it("'가능'이 아니면 실패한다(공공데이터는 더 엄격하게 바꾸지 않는다)", () => {
      const result = validatePlaces(withPublic({ value: "부분가능" }));
      expect(result.ok).toBe(false);
      expect(messagesOf(withPublic({ value: "부분가능" }))).toContain("공공데이터");
    });

    it("public- 근거 id가 없으면 실패한다", () => {
      expect(validatePlaces(withPublic({ evidence: ["restroom-1"] })).ok).toBe(false);
      expect(validatePlaces(withPublic({ evidence: undefined })).ok).toBe(false);
    });

    it("원본 주소(source_url)가 없으면 실패한다", () => {
      expect(messagesOf(withPublic({ source_url: undefined }))).toContain("source_url");
    });

    it("확인 방법이 공공데이터가 아니면 실패한다", () => {
      expect(validatePlaces(withPublic({ method: "관광공사 API" })).ok).toBe(false);
    });
  });

  describe("근거 id는 근거 문단에 있어야 한다", () => {
    const evidence = {
      GN91: [{ id: "route-1" }, { id: "public-화장실-1" }],
      GN92: [{ id: "route-1" }],
      GN93: [{ id: "route-1" }],
    };

    it("근거 목록을 주면, 목록에 없는 근거 id는 access·hours·on_site 모두 실패한다", () => {
      const places = loadSamplePlaces();
      places[0].access.slope = { value: "가능", grade: "ai", method: "관광공사 API", verified_at: "2026-11-10", evidence: ["route-1", "info-없는근거-7"] };
      places[0].hours.evidence = ["hours-5"];
      places[0].on_site = { text: "정문으로", evidence: ["onsite-9"], grade: "ai" };
      const messages = validatePlaces(places, evidence)
        .issues.map((i) => i.message)
        .join("\n");
      for (const id of ["info-없는근거-7", "hours-5", "onsite-9"]) expect(messages).toContain(id);
      expect(messages).not.toContain("route-1");
    });

    it("근거 목록을 안 주면 이 검사를 하지 않는다(지금 동작 유지)", () => {
      const places = loadSamplePlaces();
      places[0].access.slope = { value: "가능", grade: "ai", method: "관광공사 API", verified_at: "2026-11-10", evidence: ["info-없는근거-7"] };
      expect(validatePlaces(places).ok).toBe(true);
    });

    it("근거 목록에 있는 id만 쓰면 통과한다", () => {
      const places = loadSamplePlaces();
      places[0].access.accessible_toilet = {
        value: "가능",
        note: "공중화장실 'A' · 장애인 칸 1",
        evidence: ["public-화장실-1"],
        grade: "public",
        method: "공공데이터",
        verified_at: "2024-12-31",
        source_url: PUBLIC_RESTROOM_SOURCE.url,
      };
      // 샘플 장소가 쓰는 근거 id를 장소마다 모두 목록에 넣는다
      const known: Record<string, { id: string }[]> = {};
      for (const p of places) {
        const used = new Set<string>(["public-화장실-1"]);
        for (const a of Object.values(p.access)) for (const id of a.evidence ?? []) used.add(id);
        for (const id of p.hours.evidence ?? []) used.add(id);
        for (const id of p.on_site?.evidence ?? []) used.add(id);
        known[p.id] = [...used].map((id) => ({ id }));
      }
      expect(validatePlaces(places, known).issues).toEqual([]);
    });

    it("근거 목록에 장소 자체가 없으면 그 장소의 근거 id는 모두 없는 것으로 본다", () => {
      const places = loadSamplePlaces();
      places[0].access.slope = { value: "가능", grade: "ai", method: "관광공사 API", verified_at: "2026-11-10", evidence: ["route-1"] };
      expect(messagesOf(places)).not.toContain("route-1");
      const messages = validatePlaces(places, { GN92: [], GN93: [] })
        .issues.map((i) => i.message)
        .join("\n");
      expect(messages).toContain("route-1");
    });
  });

  // WR-04: 근거 문단(data/evidence.json)이 data/public/restrooms.json과 같은 글인지 본다(오래됐으면 실패)
  describe("공공데이터 근거 문단이 최신인지(WR-04)", () => {
    const restroom = {
      no: "1",
      name: "샘플 화장실",
      kind: "",
      disabled_m: 1,
      disabled_f: 1,
      diaper: true,
      diaper_place: "여자화장실",
      open: "상시",
      date: "2024-12-31",
      evidence_id: "public-화장실-1",
    };
    const restrooms = (r: Partial<typeof restroom> = {}) =>
      ({ source: {}, places: { GN91: { name_ko: "[샘플] 관광지 A", restrooms: [{ ...restroom, ...r }] } } }) as unknown as RestroomsFile;
    /** 근거 목록: 샘플 장소가 쓰는 id + 공공데이터 문단(restrooms.json이 만드는 글) */
    const evidenceFor = (file: RestroomsFile) => {
      const ev: Record<string, { id: string; label?: string; text?: string }[]> = {};
      for (const p of loadSamplePlaces()) {
        const used = new Set<string>();
        for (const a of Object.values(p.access)) for (const id of a.evidence ?? []) used.add(id);
        for (const id of p.hours.evidence ?? []) used.add(id);
        for (const id of p.on_site?.evidence ?? []) used.add(id);
        ev[p.id] = [...used].map((id) => ({ id, label: "관광공사", text: "원문" }));
      }
      for (const [id, entry] of Object.entries(file.places)) ev[id] = [...(ev[id] ?? []), ...publicParagraphs(entry)];
      return ev;
    };
    const messagesWith = (ev: ReturnType<typeof evidenceFor>, file: RestroomsFile) =>
      validatePlaces(loadSamplePlaces(), ev, file)
        .issues.map((i) => i.message)
        .join("\n");

    it("근거 문단이 restrooms.json이 만드는 글과 같으면 통과한다", () => {
      const file = restrooms();
      expect(validatePlaces(loadSamplePlaces(), evidenceFor(file), file).issues).toEqual([]);
    });

    it("화장실 내용이 바뀌었는데 근거 문단이 옛 글이면 실패하고, 어떻게 고치는지 알려 준다", () => {
      const stale = evidenceFor(restrooms());
      const message = messagesWith(stale, restrooms({ name: "다른 화장실" }));
      expect(message).toContain("공공데이터 근거 문단");
      expect(message).toContain("npm run data:build");
      expect(message).toContain("npm run data:merge");
    });

    it("번호는 같아도 글이 다르면(다른 화장실로 다시 배정) 실패한다", () => {
      expect(validatePlaces(loadSamplePlaces(), evidenceFor(restrooms({ disabled_m: 0 })), restrooms({ disabled_m: 3 })).ok).toBe(false);
    });

    it("restrooms.json에 문단이 더 생겼는데 근거 목록에 없으면 실패한다", () => {
      const ev = evidenceFor(restrooms());
      ev.GN91 = ev.GN91.filter((e) => !e.id.startsWith("public-"));
      expect(messagesWith(ev, restrooms())).toContain("npm run data:build");
    });

    it("근거 목록에 public- 문단이 남아 있는데 restrooms.json에는 그 장소가 없으면 실패한다", () => {
      const ev = evidenceFor(restrooms());
      const empty = { source: {}, places: {} } as unknown as RestroomsFile;
      expect(messagesWith(ev, empty)).toContain("npm run data:build");
    });

    it("restrooms.json을 안 주면 이 검사를 하지 않는다(지금 동작 유지)", () => {
      const ev = evidenceFor(restrooms());
      expect(validatePlaces(loadSamplePlaces(), ev).ok).toBe(true);
    });

    it("실제 데이터: 커밋된 근거 문단은 restrooms.json과 같은 글이다", () => {
      const read = (f: string) => JSON.parse(readFileSync(resolve(__dirname, "../..", f), "utf8"));
      const result = validatePlaces(read("data/places.json"), read("data/evidence.json"), read("data/public/restrooms.json"));
      expect(result.issues).toEqual([]);
    });
  });

  it("부분가능인데 메모가 없으면 실패한다", () => {
    const places = loadSamplePlaces();
    delete places[0].access.surface.note;
    const result = validatePlaces(places);
    expect(result.ok).toBe(false);
    expect(result.issues[0]).toMatchObject({ placeId: "GN91", path: "[0].access.surface" });
  });

  it("access 항목이 빠지면 실패한다", () => {
    const places = loadSamplePlaces();
    delete (places[0].access as Partial<(typeof places)[0]["access"]>).accessible_toilet;
    expect(validatePlaces(places).ok).toBe(false);
  });

  it("조사표의 옛 카테고리(바다·자연)는 거부한다", () => {
    const places = loadSamplePlaces();
    (places[2] as { category: string }).category = "바다·자연";
    const result = validatePlaces(places);
    expect(result.ok).toBe(false);
    expect(result.issues[0].message).toContain("바다·해변");
  });

  it("id는 세 자리 번호까지 받는다(강릉 100곳 이상)", () => {
    const places = loadSamplePlaces();
    places[0].id = "GN120";
    expect(validatePlaces(places).ok).toBe(true);
  });

  it("id 중복, 지역과 다른 접두어, 관광공사 contentid 중복을 잡는다", () => {
    const places = loadSamplePlaces();
    places[1].id = "GN91";
    places[2].region = "속초";
    places[2].tour_content_id = places[0].tour_content_id;
    const messages = messagesOf(places);
    expect(messages).toContain("중복");
    expect(messages).toContain("SC로 시작");
    expect(messages).toContain("contentid");
  });

  it("체류 범위, 운영시간, 입장 마감 오류를 잡는다", () => {
    const places = loadSamplePlaces();
    places[0].stay_min = 90;
    places[0].hours.winter = { open: "18:00", close: "09:00" };
    places[1].hours.summer = { open: "10:00", close: "19:00", last_entry: "20:00" };
    const messages = messagesOf(places);
    expect(messages).toContain("권장 체류");
    expect(messages).toContain("여는 시각");
    expect(messages).toContain("입장 마감");
  });

  it("영동권 밖 좌표(위도·경도 뒤바뀜)를 잡는다", () => {
    const places = loadSamplePlaces();
    [places[0].lat, places[0].lng] = [places[0].lng, places[0].lat];
    expect(validatePlaces(places).issues[0].message).toContain("영동권 밖");
  });

  it("없는 장소를 대안으로 넣으면 실패한다", () => {
    const places = loadSamplePlaces();
    places[2].alternatives = ["GN99"];
    expect(validatePlaces(places).issues[0].message).toContain("GN99");
  });
});
