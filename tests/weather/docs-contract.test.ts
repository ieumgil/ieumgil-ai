// 문서 계약(WX-04, D-03, D-11): README·CLAUDE.md·.env.example·API 정리 문서에 기상청 출처와 키 규칙이 있다.
// 문서를 고쳐도 출처·키·원칙이 빠지지 않게 줄 단위로 위치까지 고정한다.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (name: string) => readFileSync(join(root, name), "utf8").replace(/\r\n/g, "\n");
const lines = (name: string) => read(name).split("\n");

describe("README", () => {
  const readme = read("README.md");
  const rows = lines("README.md");

  it("첫 40줄 안에 기상청 배지가 있고 공공데이터포털 15084084로 간다", () => {
    const badge = rows.slice(0, 40).find((l) => l.includes("[![기상청") && l.includes("https://www.data.go.kr/data/15084084/openapi.do"));
    expect(badge).toBeTruthy();
    expect(badge).toContain("img.shields.io/badge/");
    expect(badge).toContain("style=for-the-badge");
  });

  it("기상청 배지가 행정안전부 공중화장실 배지 바로 다음 줄이다", () => {
    const i = rows.findIndex((l) => l.startsWith("[![행정안전부 공중화장실"));
    expect(i).toBeGreaterThan(-1);
    expect(rows[i + 1]).toContain("[![기상청");
  });

  it("중기예보 번호와 환경변수, 참고 자료 두 항목이 있다", () => {
    expect(readme).toContain("15059468");
    const envRow = rows.find((l) => l.includes("`KMA_API_KEY`"));
    expect(envRow).toBeTruthy();
    expect(envRow?.startsWith("|")).toBe(true);
    const refs = rows.slice(rows.findIndex((l) => l.startsWith("## 참고 자료")));
    expect(refs.some((l) => /^\d+\. 공공데이터포털, \[기상청 단기예보 조회서비스\]\(https:\/\/www\.data\.go\.kr\/data\/15084084\/openapi\.do\)/.test(l))).toBe(true);
    expect(refs.some((l) => /^\d+\. 공공데이터포털, \[기상청 중기예보 조회서비스\]\(https:\/\/www\.data\.go\.kr\/data\/15059468\/openapi\.do\)/.test(l))).toBe(true);
  });

  it("기상청 데이터 출처가 배지·데이터 절·참고 자료 세 곳에 있다", () => {
    const hits = (readme.match(/data\.go\.kr\/data\/15084084/g) ?? []).length;
    expect(hits).toBeGreaterThanOrEqual(3);
  });

  it("데이터 절에 저장 안 함·실패 시 숨김·AI가 쓰지 않음이 적혀 있다", () => {
    const start = rows.findIndex((l) => l.startsWith("## 데이터"));
    const end = rows.findIndex((l, i) => i > start && l.startsWith("## "));
    const section = rows.slice(start, end).join("\n");
    expect(section).toContain("날씨는 기상청 예보로");
    expect(section).toContain("저장하지 않");
    expect(section).toContain("숨깁니다");
    expect(section).toContain("AI가 쓰지 않");
  });

  it("폴더 구조에 src/lib/weather가 있다", () => {
    expect(readme).toContain("src/lib/weather");
  });
});

describe("CLAUDE.md", () => {
  const rows = lines("CLAUDE.md");

  it("원칙 4 줄에 기상청 키가 있다", () => {
    const rule4 = rows.find((l) => l.startsWith("4. **키는 서버에서만.**"));
    expect(rule4).toBeTruthy();
    expect(rule4).toContain("기상청");
    expect(rule4).toContain("KMA_API_KEY");
  });

  it("스택 절에 기상청이 있다", () => {
    const start = rows.findIndex((l) => l.startsWith("## 스택"));
    const end = rows.findIndex((l, i) => i > start && l.startsWith("## "));
    expect(rows.slice(start, end).join("\n")).toContain("기상청");
  });

  it("폴더 구조 코드 블록에 src/lib/weather/가 있다", () => {
    const start = rows.findIndex((l) => l.startsWith("## 폴더 구조"));
    const end = rows.findIndex((l, i) => i > start && l.startsWith("## "));
    expect(rows.slice(start, end).join("\n")).toContain("src/lib/weather/");
  });

  it("원칙 3에 날씨도 저장하지 않는다는 말이 있다", () => {
    const rule3 = rows.find((l) => l.startsWith("3. **카카오 길찾기 결과는 저장하지 않는다**"));
    expect(rule3).toBeTruthy();
    const idx = rows.indexOf(rule3 as string);
    const block = rows.slice(idx, idx + 4).join("\n");
    expect(block).toContain("날씨");
    expect(block).toContain("저장하지 않");
  });
});

describe(".env.example", () => {
  const rows = lines(".env.example");

  it("KMA_API_KEY=가 서버 전용 칸 안(서버 전용 줄 뒤, 데이터 정리 스크립트 전용 줄 앞)에 있고 값이 비어 있다", () => {
    const server = rows.findIndex((l) => l.startsWith("# 서버 전용"));
    const script = rows.findIndex((l) => l.startsWith("# 데이터 정리 스크립트 전용"));
    const kma = rows.findIndex((l) => l.startsWith("KMA_API_KEY="));
    expect(server).toBeGreaterThan(-1);
    expect(script).toBeGreaterThan(server);
    expect(kma).toBeGreaterThan(server);
    expect(kma).toBeLessThan(script);
    expect(rows[kma]).toBe("KMA_API_KEY=");
  });

  it("KMA_GATEWAY도 이름만 있고, NEXT_PUBLIC_ 기상청 키는 없다", () => {
    expect(rows).toContain("KMA_GATEWAY=");
    expect(rows.filter((l) => l.startsWith("NEXT_PUBLIC_") && /KMA/i.test(l))).toEqual([]);
  });
});

describe("docs/data/kma-forecast.md", () => {
  it("있고 세 오퍼레이션·지역코드·미확인 표시가 있다", () => {
    expect(existsSync(join(root, "docs/data/kma-forecast.md"))).toBe(true);
    const doc = read("docs/data/kma-forecast.md");
    for (const word of ["getVilageFcst", "getMidLandFcst", "getMidTa", "[ASSUMED]", "11D20501"]) expect(doc).toContain(word);
  });
});
