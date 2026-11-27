// 디자인 토큰 계약(03단계): globals.css의 토큰 값·WCAG 대비·반지름을 글 그대로 읽어 계산한다.
// 새 색 조합이 AA를 지키는지(솔숲 초록 pine, 선택 컨트롤 테두리 line-control), 글자 크기·제목 글꼴·반지름 3단계가 값으로 고정되는지 본다.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8").replace(/\r\n/g, "\n");

/** `@theme static { … }` · `@theme inline { … }` 블록 하나의 안쪽(중괄호 짝을 세어 자른다: 안에 @keyframes가 있다) */
function block(header: string): string {
  const start = css.indexOf(header);
  expect(start, `${header} 블록`).toBeGreaterThan(-1);
  let depth = 0;
  for (let i = css.indexOf("{", start); i < css.length; i++) {
    if (css[i] === "{") depth++;
    if (css[i] === "}" && --depth === 0) return css.slice(css.indexOf("{", start) + 1, i);
  }
  throw new Error(`${header} 블록이 닫히지 않았다`);
}

const staticTheme = block("@theme static");
const inlineTheme = block("@theme inline");

/** `--이름: 값;`(뒤 주석은 뗀다) */
function token(scope: string, name: string): string {
  const m = new RegExp(`^\\s*${name.replace(/[-]/g, "\\-")}:\\s*([^;]+);`, "m").exec(scope);
  expect(m, `${name} 토큰`).not.toBeNull();
  return m![1].trim();
}

const color = (name: string) => token(staticTheme, `--color-${name}`);

function luminance(hex: string): number {
  const v = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(v.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(fg: string, bg: string): number {
  const [a, b] = [luminance(fg), luminance(bg)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}

const WHITE = "#ffffff";

describe("토큰 값", () => {
  it("색은 파랑 #3580db · 초록 #3daa7e 두 가지(11/24 팀 결정) + 같은 색의 연한 면 · 선택 컨트롤 테두리", () => {
    expect(color("primary")).toBe("#3580db");
    expect(color("primary-ink")).toBe("#3580db");
    expect(color("pine")).toBe("#3daa7e");
    expect(color("pine-soft")).toBe("#ecf7f2");
    expect(color("card-blue")).toBe("#3580db");
    expect(color("card-green")).toBe("#3daa7e");
    expect(color("cta-green")).toBe("#3daa7e");
    expect(color("line-control")).toBe("#8b95a1");
  });

  it("글자 크기: 화면 제목 1.75rem(1.3) · 구역 제목 1.25rem(1.35)", () => {
    expect(token(staticTheme, "--text-title")).toBe("1.75rem");
    expect(token(staticTheme, "--text-title--line-height")).toBe("1.3");
    expect(token(staticTheme, "--text-heading")).toBe("1.25rem");
    expect(token(staticTheme, "--text-heading--line-height")).toBe("1.35");
  });

  it("글꼴 2개만(11/27): 제목·본문은 Pretendard, 시작 화면 히어로 문구·바로가기 이름만 잘난체 고딕", () => {
    expect(token(staticTheme, "--font-display")).toBe("var(--font-sans)");
    expect(token(inlineTheme, "--font-sans")).toMatch(/^var\(--font-pretendard\),/);
    expect(token(staticTheme, "--font-point")).toMatch(/^var\(--font-jalnan\),/);
  });

  it("시작 화면 새 시안 색(11/27) · 히어로 글 상자는 반투명 0.5", () => {
    expect(color("home-blue")).toBe("#1553a3");
    expect(color("home-green")).toBe("#2f993b");
    expect(color("home-orange")).toBe("#ed7049");
    expect(color("home-mint")).toBe("rgb(224 236 230 / 0.5)");
  });

  it("본문 16px · 줄 간격 1.6", () => {
    expect(token(staticTheme, "--text-base")).toBe("1rem");
    expect(token(staticTheme, "--text-base--line-height")).toBe("1.6");
  });

  it("font-heading(shadcn 대화창·시트 제목)이 제목 글꼴을 가리킨다", () => {
    expect(token(inlineTheme, "--font-heading")).toBe("var(--font-display)");
  });

  it("--color-primary를 @theme inline에 다시 잇지 않는다(shadcn 기본 검정으로 바뀜)", () => {
    expect(inlineTheme).not.toMatch(/--color-primary\s*:/);
  });
});

describe("반지름 3단계: 컨트롤 12px · 카드 16px · 시트 24px", () => {
  it("rounded-xl 0.75rem · 2xl 1rem · 3xl 1.5rem", () => {
    expect(token(inlineTheme, "--radius-xl")).toBe("0.75rem");
    expect(token(inlineTheme, "--radius-2xl")).toBe("1rem");
    expect(token(inlineTheme, "--radius-3xl")).toBe("1.5rem");
  });
});

describe("WCAG 대비(상대 휘도 공식)", () => {
  const surface = color("surface");
  const pine = color("pine");
  const pineSoft = color("pine-soft");
  const primarySoft = color("primary-soft");

  // 파랑·초록 글자의 대비는 11/24 팀 결정으로 검사하지 않는다(#3580db 3.99 · #3daa7e 2.90 : 흰 바탕). 본문·보조 글자와 주의·불가 상태는 그대로 4.5:1
  void pine;
  void surface;
  const aa: [string, string, string][] = [
    ["ink / 흰", color("ink"), WHITE],
    ["ink-sub / 흰", color("ink-sub"), WHITE],
    ["ink-sub / primary-soft", color("ink-sub"), primarySoft],
    ["ink-sub / pine-soft", color("ink-sub"), pineSoft],
    ["caution-ink / caution-bg", color("caution-ink"), color("caution-bg")],
    ["blocked-ink / blocked-bg", color("blocked-ink"), color("blocked-bg")],
  ];

  it.each(aa)("글자 %s 는 4.5:1 이상", (_name, fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it("선택 컨트롤 테두리 line-control / 흰 바탕은 3:1 이상(비텍스트)", () => {
    expect(contrast(color("line-control"), WHITE)).toBeGreaterThanOrEqual(3);
  });

  it("파랑·초록은 흰 바탕 3.99:1 · 2.90:1 — 대비 기준 밖이라는 것을 숫자로 남긴다(팀 결정)", () => {
    expect(contrast(color("primary"), WHITE)).toBeCloseTo(3.99, 1);
    expect(contrast(color("pine"), WHITE)).toBeCloseTo(2.9, 1);
  });
});
