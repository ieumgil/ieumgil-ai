// 지도 아래 설명: 첫 줄은 이동 시간·거리(크게), 둘째 줄은 "일반 차량 경로"와 번호 안내(원칙 6). 문구는 코드가 정한다.
import { describe, expect, it } from "vitest";
import { mapCaption } from "@/lib/trip/map-caption";

describe("mapCaption", () => {
  it("경로를 받았으면 첫 줄은 '차량 약 N분 · 약 Nkm'(카카오 글자 없음), 둘째 줄은 일반 차량 경로 안내", () => {
    const c = mapCaption({ km: 9.6, minutes: 29 });
    expect(c.head).toBe("차량 약 29분 · 약 9.6km");
    expect(c.head).not.toContain("카카오");
    expect(c.sub).toBe("일반 차량 경로 · 번호를 누르면 장소 정보");
  });

  it("받는 중이어도 둘째 줄에 일반 차량 경로가 있다", () => {
    const c = mapCaption(undefined);
    expect(c.head).toBe("경로를 불러오는 중이에요");
    expect(c.sub).toContain("일반 차량 경로");
  });

  it("경로를 못 받아 직선으로 이었으면 그렇다고 알리고, 둘째 줄에 일반 차량 경로를 못 받았다고 적는다", () => {
    const c = mapCaption(null);
    expect(c.head).toBe("경로를 불러오지 못했어요");
    expect(c.sub).toContain("직선으로 이었어요");
    expect(c.sub).toContain("일반 차량 경로");
    expect(c.sub).toContain("번호를 누르면 장소 정보");
  });
});
