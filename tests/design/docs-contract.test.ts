// 디자인 문서 계약(DS-05): CLAUDE.md 디자인 토큰 절·README 기술 스택·docs/design·구현 기록에
// 보조색·제목 글꼴·글자 단계·반지름·면 규칙이 적혀 있고, 그 값이 globals.css와 같은지 글 그대로 읽어 고정한다.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (name: string) => readFileSync(join(root, name), "utf8").replace(/\r\n/g, "\n");

/** `## 제목`으로 시작하는 절 하나(다음 `## ` 앞까지) */
function section(text: string, titleStart: string): string {
  const rows = text.split("\n");
  const start = rows.findIndex((l) => l.startsWith(titleStart));
  expect(start, `${titleStart} 절`).toBeGreaterThan(-1);
  const end = rows.findIndex((l, i) => i > start && l.startsWith("## "));
  return rows.slice(start, end === -1 ? undefined : end).join("\n");
}

const css = read("src/app/globals.css");
const cssColor = (name: string) => {
  const m = new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`).exec(css);
  expect(m, `--color-${name}`).not.toBeNull();
  return m![1].toLowerCase();
};

describe("CLAUDE.md 디자인 토큰 절", () => {
  const claude = read("CLAUDE.md");
  const design = section(claude, "## 디자인 토큰");

  it("보조색 pine·pine-soft·line-control이 이름과 값으로 적혀 있다", () => {
    const lower = design.toLowerCase();
    for (const word of ["pine-soft", "line-control", "#2a6a50", "#e8f3ec", "#8b95a1"]) expect(lower).toContain(word);
  });

  it("문서의 pine·pine-soft·line-control 값이 globals.css @theme static 값과 같다", () => {
    const lower = design.toLowerCase();
    expect(lower).toContain(cssColor("pine"));
    expect(lower).toContain(cssColor("pine-soft"));
    expect(lower).toContain(cssColor("line-control"));
  });

  it("보조색은 장소·지역 정체성에만 쓰고 상태 칩·버튼에는 쓰지 않는다고 적혀 있다", () => {
    expect(design).toMatch(/장소·지역/);
    expect(design).toMatch(/상태 칩/);
  });

  it("글꼴 Noto Sans KR 한 벌, 제목 --font-display 700은 h1·h2만, @fontsource 자체 호스팅이 적혀 있다", () => {
    expect(design).toContain("--font-display");
    expect(design).toContain("Noto Sans KR");
    expect(design).toContain("700");
    expect(design).toContain("h1·h2");
    expect(design).toContain("@fontsource");
    expect(design).toContain("외부 CDN 없음");
  });

  it("글자 크기 28/20/16/14와 굵기 400/500/700, 반지름 12/16/24가 적혀 있다", () => {
    expect(design).toMatch(/28\/20\/16\/14/);
    expect(design).toMatch(/400\/500\/700/);
    expect(design).toMatch(/12·16·24|12\/16\/24/);
  });

  it("면 규칙 S0~S3와 펼치기(Disclosure)가 적혀 있다", () => {
    for (const s of ["S0", "S1", "S2", "S3"]) expect(design).toContain(s);
    expect(design).toContain("Disclosure");
    expect(design).toContain("12px");
  });

  it("기존 규칙 문장이 그대로 남아 있다", () => {
    expect(design).toContain("토큰 값은 `@theme static`에서만 고친다");
    expect(design).toContain("`--color-primary`는 우리 토큰 이름이라 `@theme inline`에 다시 잇지 않는다");
    expect(design).toContain("`button.tsx`는 우리 규칙(16px 이상·44px 이상)으로 고쳐 둔 파일");
    expect(design).toContain("`npx shadcn add button`이나 `--overwrite` 금지");
    expect(design).toContain("파일 이름은 소문자");
  });
});

describe("README 기술 스택", () => {
  const rows = read("README.md").split("\n");
  const stack = rows.find((l) => l.includes("Tailwind CSS v4"));

  it("Noto Sans KR(SIL OFL 1.1)이 같은 줄에 있다", () => {
    expect(stack).toBeTruthy();
    expect(stack).toContain("Noto Sans KR");
    expect(stack).toContain("OFL");
  });
});

describe("docs/design·구현 기록", () => {
  it("docs/design/README.md에 시안 v2와 달라진 점 한 줄(보조색·제목 글꼴)이 있다", () => {
    const line = read("docs/design/README.md").split("\n").find((l) => l.includes("시안 v2와 달라진 점"));
    expect(line).toBeTruthy();
    expect(line).toContain("보조색");
    expect(line).toContain("제목 글꼴");
  });

  it("docs/impl-plan.md에 11/15 디자인 다듬기 절이 있다", () => {
    const text = read("docs/impl-plan.md");
    expect(text).toMatch(/^## 11\/15 디자인 다듬기/m);
    const body = section(text, "## 11/15 디자인 다듬기");
    for (const word of ["보조색", "제목 글꼴", "S0", "펼치기", "남은 일"]) expect(body).toContain(word);
  });
});
