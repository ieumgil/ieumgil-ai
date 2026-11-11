// 안 비교 카드의 한 줄 요약: 짧은 장소 이름, 지역, 처음 3곳 + 나머지 수
import { describe, expect, it } from "vitest";
import { routeSummary, shortName } from "@/lib/trip/labels";
import type { OptionView } from "@/lib/trip/view";

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
