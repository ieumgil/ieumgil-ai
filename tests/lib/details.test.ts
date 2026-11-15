// openDetailsAround: 대상이 닫힌 펼치기(details) 안에 있으면 바깥 것까지 모두 연다(UI-SPEC 공통 펼치기 규칙).
// DOM 없이 closest·parentElement만 가진 가짜 요소로 시험한다.
import { describe, expect, it } from "vitest";
import { openDetailsAround } from "@/lib/details";

type Fake = { tag: string; open: boolean; parentElement: Fake | null; closest: (sel: string) => Fake | null };

function node(tag: string, parent: Fake | null): Fake {
  const n: Fake = {
    tag,
    open: false,
    parentElement: parent,
    closest(sel) {
      // closest는 자기 자신부터 위로 올라가며 맞는 첫 요소를 준다
      let cur: Fake | null = n;
      while (cur) {
        if (cur.tag === sel) return cur;
        cur = cur.parentElement;
      }
      return null;
    },
  };
  return n;
}

describe("openDetailsAround", () => {
  it("두 겹으로 중첩된 닫힌 details를 모두 연다", () => {
    const outer = node("details", null);
    const inner = node("details", outer);
    const target = node("li", inner);
    openDetailsAround(target as unknown as Element);
    expect(inner.open).toBe(true);
    expect(outer.open).toBe(true);
  });

  it("이미 열린 바깥 details는 그대로 두고 닫힌 안쪽만 연다", () => {
    const outer = node("details", null);
    outer.open = true;
    const inner = node("details", outer);
    openDetailsAround(node("p", inner) as unknown as Element);
    expect(inner.open).toBe(true);
    expect(outer.open).toBe(true);
  });

  it("details 밖 요소면 아무것도 바꾸지 않고, null도 오류 없이 끝난다", () => {
    const sibling = node("details", null);
    const target = node("li", node("ul", null));
    openDetailsAround(target as unknown as Element);
    expect(sibling.open).toBe(false);
    expect(() => openDetailsAround(null)).not.toThrow();
  });
});
