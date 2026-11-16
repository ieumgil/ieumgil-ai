// 칸 폭이 정해진 선택 버튼(분할·타일)의 ✓와 글자 자리를 잰다. ✓는 글자 바로 앞에 붙고 '✓ + 글자' 묶음이 칸 가운데에 와야 한다(03-15).
import { expect, type Locator } from "@playwright/test";

type Geometry = {
  /** 안 골랐을 때 ✓ 요소 없음 */
  hasMark: boolean;
  /** 칸 가운데 − 묶음(✓+글자, 안 골랐으면 글자) 가운데, 절댓값 */
  centerGap: number;
  /** 글자 왼쪽 − ✓ 오른쪽 (✓ 없으면 null) */
  markGap: number | null;
  /** ✓ 세로 가운데가 글자 첫 줄 안(글자 위쪽 ~ +26px)에 있는가 */
  sameLine: boolean | null;
};

export function geometry(cell: Locator): Promise<Geometry> {
  return cell.evaluate((el) => {
    const wrap = el.querySelector(":scope > span") as HTMLElement;
    const mark = wrap.querySelector(':scope > span[aria-hidden="true"]') as HTMLElement | null;
    const label = wrap.lastElementChild as HTMLElement;
    const c = el.getBoundingClientRect();
    const l = label.getBoundingClientRect();
    const m = mark ? mark.getBoundingClientRect() : null;
    const left = m ? Math.min(m.left, l.left) : l.left;
    const right = m ? Math.max(m.right, l.right) : l.right;
    const markCY = m ? m.top + m.height / 2 : null;
    return {
      hasMark: !!m,
      centerGap: Math.abs((left + right) / 2 - (c.left + c.width / 2)),
      markGap: m ? l.left - m.right : null,
      sameLine: markCY === null ? null : markCY >= l.top && markCY <= l.top + 26,
    };
  });
}

/** 고른 칸: ✓가 글자 바로 앞(간격 0~8px, 같은 줄)이고 묶음이 칸 가운데(±2px) */
export async function expectSelectedCentered(cell: Locator) {
  const g = await geometry(cell);
  expect(g.hasMark).toBe(true);
  expect(g.markGap!).toBeGreaterThanOrEqual(0);
  expect(g.markGap!).toBeLessThanOrEqual(8);
  expect(g.sameLine).toBe(true);
  expect(g.centerGap).toBeLessThanOrEqual(2);
}

/** 안 고른 칸: ✓ 없이 글자만 칸 가운데(±2px) */
export async function expectUnselectedCentered(cell: Locator) {
  const g = await geometry(cell);
  expect(g.hasMark).toBe(false);
  expect(g.centerGap).toBeLessThanOrEqual(2);
}
