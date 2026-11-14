// 관광지 둘러보기 값: 소개(AI 없으면 원문 첫 문장), 운영시간 한 줄, 고른 유형 기준 접근성 요약, 정렬·찾기
import { describe, expect, it } from "vitest";
import { glance, hoursText, matches, sortPlaces, toBrowsePlace } from "@/lib/places/browse";
import { EMPTY_PLAN } from "@/lib/plan/types";
import { makePlace } from "../engine/fixture";

const paragraphs = [
  { id: "route-1", text: "경사로 있음" },
  { id: "overview-1", text: "율곡 이이가 태어난 곳이다. 보물로 지정되었다." },
];

describe("관광지 둘러보기 값", () => {
  it("AI 소개가 있으면 그것, 없으면 관광공사 개요 첫 문장(출처 표시용 summaryBy)", () => {
    const p = makePlace("GN91");
    const withAi = toBrowsePlace(p, { summary: "율곡이 태어난 집이에요", highlights: ["몽룡실"], evidence: ["overview-1"] }, true, paragraphs);
    expect(withAi).toMatchObject({ summary: "율곡이 태어난 집이에요", summaryBy: "ai", highlights: ["몽룡실"], featured: true, overview: ["율곡 이이가 태어난 곳이다. 보물로 지정되었다."] });
    const noAi = toBrowsePlace(p, undefined, false, paragraphs);
    expect(noAi).toMatchObject({ summary: "율곡 이이가 태어난 곳이다.", summaryBy: "source", highlights: [] });
  });

  it("공공데이터(grade public) 항목에만 출처·기준일 문구(source)가 붙는다", () => {
    const p = makePlace("GN91", {
      set: {
        accessible_toilet: {
          value: "가능",
          note: "공중화장실 'A' · 장애인 칸 2",
          evidence: ["public-화장실-1"],
          grade: "public",
          method: "공공데이터",
          verified_at: "2024-12-31",
          source_url: "https://www.data.go.kr/data/15012892/standard.do",
        },
      },
    });
    const b = toBrowsePlace(p, undefined, false, paragraphs);
    expect(b.access.accessible_toilet).toEqual({ value: "가능", note: "공중화장실 'A' · 장애인 칸 2", source: "공공데이터(2024-12 기준)" });
    expect("source" in b.access.elevator).toBe(false);
  });

  it("기저귀 교환대 공공데이터 값은 '수유실'이 아니라 교환대 문장으로 보인다(WR-02)", () => {
    const pub = { value: "가능" as const, evidence: ["public-화장실-1"], grade: "public" as const, method: "공공데이터" as const, verified_at: "2024-12-31", source_url: "https://www.data.go.kr/data/15012892/standard.do" };
    const only = toBrowsePlace(makePlace("GN91", { set: { diaper_nursing: { ...pub, note: "기저귀 교환대 · 공중화장실 'A' 여자화장실에만 · 수유실 정보 없음" } } }), undefined, false, paragraphs);
    expect(only.access.diaper_nursing).toEqual({
      value: "가능",
      label: "기저귀 교환대 있음 · 여자화장실에만",
      note: "공중화장실 'A'",
      noNursing: true,
      source: "공공데이터(2024-12 기준)",
    });
    const both = toBrowsePlace(makePlace("GN91", { set: { diaper_nursing: { ...pub, note: "기저귀 교환대 · 공중화장실 'A' 남녀 화장실 모두 / 관광공사: 수유실 있음" } } }), undefined, false, paragraphs);
    expect(both.access.diaper_nursing).toEqual({
      value: "가능",
      label: "기저귀 교환대 있음 · 남녀 화장실 모두",
      note: "공중화장실 'A' / 관광공사: 수유실 있음",
      source: "공공데이터(2024-12 기준)",
    });
    // 공공데이터가 아닌 기저귀 값은 그대로(label 없음)
    const ai = toBrowsePlace(makePlace("GN91", { set: { diaper_nursing: { value: "가능", note: "수유실 있음", grade: "ai", method: "관광공사 API", verified_at: "2026-11-10", evidence: ["info-1"] } } }), undefined, false, paragraphs);
    expect(ai.access.diaper_nursing).toEqual({ value: "가능", note: "수유실 있음" });
  });

  it("운영시간 한 줄", () => {
    expect(hoursText({ always_open: true })).toBe("상시 개방");
    expect(hoursText({ summer: { open: "09:00", close: "18:00", last_entry: "17:00" }, winter: { open: "09:00", close: "17:00", last_entry: "16:00" }, closed_weekdays: ["월"] })).toBe(
      "09:00~18:00, 입장 마감 17:00 (겨울 09:00~17:00) · 월요일 쉼",
    );
    expect(hoursText({})).toBe("운영시간 정보 없음");
  });

  it("접근성 요약: 유형을 골랐으면 꼭 필요한 조건, 안 골랐으면 기본 4개 · 필수 '불가'는 따로", () => {
    const p = toBrowsePlace(makePlace("GN92", { set: { step_free_entrance: { value: "불가" }, surface: { value: "모름", ask: "노면?" } } }), undefined, false, paragraphs);
    const none = glance(p, null);
    expect(none.byTraveler).toBe(false);
    expect(none.items.map((i) => i.key)).toEqual(["step_free_entrance", "accessible_toilet", "elevator", "disabled_parking"]);
    expect(none.blocked).toEqual([]);
    const wheel = glance(p, { ...EMPTY_PLAN, travelers: ["wheelchair"], transport: "taxi" });
    expect(wheel.byTraveler).toBe(true);
    expect(wheel.items.some((i) => i.key === "surface" && i.value === "모름")).toBe(true);
    expect(wheel.items.some((i) => i.key === "disabled_parking")).toBe(false); // 택시면 장애인 주차는 필수 아님
    expect(wheel.blocked.map((i) => i.key)).toEqual(["step_free_entrance"]);
  });

  it("대표 관광지 → 사진 있는 곳 → 이름 순, 찾기는 이름·소개·볼 거리(띄어쓰기 무시)", () => {
    const mk = (id: string, name: string, featured: boolean) => ({ ...toBrowsePlace(makePlace(id, { name_ko: name }), { summary: "바다 전망 해변이에요", highlights: ["해돋이"], evidence: ["overview-1"] }, featured, paragraphs) });
    const list = [mk("GN81", "나 해변", false), mk("GN82", "다 공원", true), mk("GN83", "가 해변", false)];
    expect(sortPlaces(list, (id) => id === "GN81").map((p) => p.id)).toEqual(["GN82", "GN81", "GN83"]);
    expect(matches(list[0], "해 돋이")).toBe(true);
    expect(matches(list[0], "케이블카")).toBe(false);
  });
});
