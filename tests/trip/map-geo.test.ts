// 구간 화살표·시간 표는 경로 길이의 한가운데에 놓는다.
import { describe, expect, it } from "vitest";
import { screenAngle, splitAtMiddle } from "@/lib/trip/map-geo";

describe("경로 한가운데", () => {
  it("곧은 두 점 경로는 정확히 가운데, 앞 절반은 시작 → 가운데", () => {
    const r = splitAtMiddle([
      [37.7, 128.9],
      [37.8, 128.9],
    ])!;
    expect(r.mid[0]).toBeCloseTo(37.75, 6);
    expect(r.head).toEqual([[37.7, 128.9], r.mid]);
  });

  it("꺾인 경로는 길이 기준(점 개수 기준이 아님)", () => {
    // 짧은 앞 구간(0.01) + 긴 뒤 구간(0.09) → 가운데(0.05)는 뒤 구간 안
    const r = splitAtMiddle([
      [37.7, 128.9],
      [37.71, 128.9],
      [37.8, 128.9],
    ])!;
    expect(r.mid[0]).toBeCloseTo(37.75, 6);
    expect(r.head).toHaveLength(3);
  });

  it("점이 하나뿐이거나 길이가 0이면 null", () => {
    expect(splitAtMiddle([[37.7, 128.9]])).toBeNull();
    expect(splitAtMiddle([[37.7, 128.9], [37.7, 128.9]])).toBeNull();
  });
});

describe("진행 방향(화면 각도)", () => {
  it("동쪽 0도 · 남쪽 90도 · 북쪽 -90도 · 서쪽 180도", () => {
    expect(screenAngle([37.7, 128.9], [37.7, 129.0])).toBe(0);
    expect(screenAngle([37.7, 128.9], [37.6, 128.9])).toBe(90);
    expect(screenAngle([37.7, 128.9], [37.8, 128.9])).toBe(-90);
    expect(Math.abs(screenAngle([37.7, 128.9], [37.7, 128.8]))).toBe(180);
  });

  it("가운데에서의 방향을 함께 준다", () => {
    expect(splitAtMiddle([[37.7, 128.9], [37.8, 128.9]])!.angle).toBe(-90);
  });
});
