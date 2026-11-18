import { describe, expect, it } from "vitest";
import { eun, euro } from "@/lib/text/particle";

describe("euro(으로/로)", () => {
  it("받침이 있으면 '으로', 없거나 ㄹ이면 '로'", () => {
    expect(euro("허난설헌 솔숲")).toBe("허난설헌 솔숲으로");
    expect(euro("안목해변")).toBe("안목해변으로");
    expect(euro("강릉 선교장")).toBe("강릉 선교장으로");
    expect(euro("경포대")).toBe("경포대로");
    expect(euro("강릉 대도호부 관아")).toBe("강릉 대도호부 관아로");
    expect(euro("하슬라 아트월드 뮤지엄 호텔")).toBe("하슬라 아트월드 뮤지엄 호텔로");
  });
  it("한글로 끝나지 않으면 '(으)로'", () => {
    expect(euro("남항진해변(남항진해수욕장)")).toBe("남항진해변(남항진해수욕장)(으)로");
    expect(euro("ABC")).toBe("ABC(으)로");
  });
});

describe("eun(은/는)", () => {
  it("받침이 있으면 '은', 없으면 '는'", () => {
    expect(eun("강릉 오죽헌·시립박물관")).toBe("강릉 오죽헌·시립박물관은");
    expect(eun("경포대")).toBe("경포대는");
    expect(eun("안목해변")).toBe("안목해변은");
  });
  it("한글로 끝나지 않으면 '은(는)'", () => {
    expect(eun("남항진해변(남항진해수욕장)")).toBe("남항진해변(남항진해수욕장)은(는)");
  });
});
