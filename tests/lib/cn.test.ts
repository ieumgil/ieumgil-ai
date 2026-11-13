// 클래스 합치기: 우리 글자 크기 토큰이 글자색을 지우지 않아야 한다(파란 버튼 위 흰 글자)
import { describe, expect, it } from "vitest";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/utils";

describe("cn", () => {
  it("text-lead·title·display는 글자 크기라 글자색과 함께 남는다", () => {
    for (const size of ["text-lead", "text-title", "text-display"]) {
      expect(cn("text-primary-foreground", size).split(" ")).toEqual(["text-primary-foreground", size]);
    }
  });

  it("글자 크기끼리는 뒤의 것으로 바뀐다", () => {
    expect(cn("text-lg", "text-lead")).toBe("text-lead");
  });

  it("다음 버튼(파랑)은 흰 글자를 유지한다", () => {
    expect(buttonClass("primary", "flex-[2] text-lead")).toContain("text-primary-foreground");
  });
});
