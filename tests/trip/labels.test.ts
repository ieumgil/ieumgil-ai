// 안 비교 카드의 한 줄 요약: 짧은 장소 이름, 지역, 처음 3곳 + 나머지 수
import { describe, expect, it } from "vitest";
import { evidenceSourceText, publicAccessLines, routeSummary, shortName } from "@/lib/trip/labels";
import type { OptionView } from "@/lib/trip/view";
import { makePlace } from "../engine/fixture";

describe("안 요약", () => {
  it("장소 이름은 지역명·괄호·'·' 뒤를 빼고 짧게", () => {
    expect(shortName("강릉 오죽헌·시립박물관")).toBe("오죽헌");
    expect(shortName("남항진해변(남항진해수욕장)")).toBe("남항진해변");
    expect(shortName("강릉 대도호부 관아")).toBe("대도호부 관아");
    expect(shortName("속초 국립산악박물관")).toBe("국립산악박물관");
  });

  it("지역과 처음 3곳을 순서대로, 나머지는 '외 N곳'", () => {
    const visit = (placeId: string) => ({ kind: "visit" as const, placeId });
    const o = { days: [{ items: [visit("a"), visit("b")] }, { items: [visit("c"), visit("d"), visit("e")] }] } as unknown as OptionView;
    const places = {
      a: { name: "강릉 오죽헌·시립박물관", region: "강릉" },
      b: { name: "강릉 선교장", region: "강릉" },
      c: { name: "속초 영금정", region: "속초" },
      d: { name: "속초해변", region: "속초" },
      e: { name: "설악산", region: "속초" },
    };
    expect(routeSummary(o, { places })).toBe("강릉·속초 · 오죽헌 → 선교장 → 영금정 외 2곳");
  });
});

describe("근거 줄·공공데이터 항목(AUDIT M1, D-08)", () => {
  it("관광공사 근거만 있으면 지금 문구 그대로(같은 이름은 한 번, 무장애·/안내· 뗌)", () => {
    expect(
      evidenceSourceText([
        { id: "restroom-1", label: "무장애·화장실" },
        { id: "route-1", label: "무장애·접근로" },
        { id: "restroom-2", label: "무장애·화장실" },
      ]),
    ).toBe("근거: 한국관광공사 무장애 여행정보(화장실, 접근로) · AI 정리");
    expect(evidenceSourceText([{ id: "overview-1", label: "안내·개요" }])).toBe("근거: 한국관광공사 무장애 여행정보(개요) · AI 정리");
  });

  it("공공데이터 근거만 있으면 행정안전부 공중화장실 정보로 적는다", () => {
    expect(evidenceSourceText([{ id: "public-화장실-1", label: "공공데이터·공중화장실" }])).toBe("근거: 행정안전부 공중화장실 정보(공공데이터)");
  });

  it("둘이 섞이면 ' / '로 나눠 적는다", () => {
    expect(
      evidenceSourceText([
        { id: "restroom-1", label: "무장애·화장실" },
        { id: "public-화장실-1", label: "공공데이터·공중화장실" },
      ]),
    ).toBe("근거: 한국관광공사 무장애 여행정보(화장실) · AI 정리 / 행정안전부 공중화장실 정보(공공데이터)");
  });

  it("publicAccessLines: 항목 순서대로 grade public만, 없거나 place가 없으면 빈 목록", () => {
    const pub = { value: "가능" as const, grade: "public" as const, method: "공공데이터" as const, verified_at: "2024-12-31", source_url: "https://www.data.go.kr/data/15012892/standard.do" };
    const p = makePlace("GN91", {
      set: {
        diaper_nursing: { ...pub, note: "기저귀 교환대 · 공중화장실 'A' 남녀 화장실 모두" },
        accessible_toilet: { ...pub, note: "공중화장실 'A' · 장애인 칸 2" },
      },
    });
    expect(publicAccessLines(p)).toEqual([
      { key: "accessible_toilet", label: "장애인 화장실", note: "공중화장실 'A' · 장애인 칸 2", source: "공공데이터(2024-12 기준)" },
      { key: "diaper_nursing", label: "수유실·기저귀 교환대", note: "기저귀 교환대 · 공중화장실 'A' 남녀 화장실 모두", source: "공공데이터(2024-12 기준)" },
    ]);
    expect(publicAccessLines(makePlace("GN92"))).toEqual([]);
    expect(publicAccessLines(undefined)).toEqual([]);
  });
});
