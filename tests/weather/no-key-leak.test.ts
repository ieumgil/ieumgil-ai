// 정적 검사: 기상청 키가 브라우저 쪽 코드로 새지 않는지 소스를 읽어 확인한다(원칙 4, T-02-01).
// 이 파일 안의 금지 문자열은 조각을 이어 만든다 — 그래야 이 테스트 파일 자체가 검사에 걸리지 않는다.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
const SRC = join(ROOT, "src");
const KEY_ENV = "KMA" + "_API_KEY";
const KEY_PARAM = "service" + "Key";
const GATEWAY_HOST = "apis.data" + ".go.kr";
const PUBLIC_PREFIX = "NEXT_PUBLIC" + "_";

const norm = (p: string) => relative(ROOT, p).replace(/\\/g, "/");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const files = walk(SRC).filter((f) => /\.(ts|tsx)$/.test(f));
const text = new Map(files.map((f) => [f, readFileSync(f, "utf8")]));
const isClient = (f: string) => /^\s*(\/\/[^\n]*\n\s*)*["']use client["']/.test(text.get(f) ?? "");
const KMA_FILE = join(SRC, "lib/weather/kma.ts");
const SERVICE_FILE = join(SRC, "lib/weather/service.ts");

/** import "…" / from "…" / import("…")의 경로 */
function specifiers(src: string): string[] {
  return [...src.matchAll(/(?:from\s+|import\s*\(\s*|import\s+)["']([^"']+)["']/g)].map((m) => m[1]);
}

function resolveImport(from: string, spec: string): string | null {
  const base = spec.startsWith("@/") ? join(SRC, spec.slice(2)) : spec.startsWith(".") ? resolve(dirname(from), spec) : null;
  if (!base) return null;
  for (const cand of [`${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")]) if (existsSync(cand)) return cand;
  return null;
}

/** from에서 import를 따라 닿는 모든 소스 파일(자기 자신 제외) */
function reach(from: string): Set<string> {
  const seen = new Set<string>();
  const stack = [from];
  while (stack.length) {
    const f = stack.pop()!;
    for (const spec of specifiers(text.get(f) ?? "")) {
      const to = resolveImport(f, spec);
      if (to && !seen.has(to)) {
        seen.add(to);
        stack.push(to);
      }
    }
  }
  return seen;
}

describe("기상청 키는 서버 코드에만 있다", () => {
  const clientFiles = files.filter(isClient);
  const browserSide = files.filter((f) => isClient(f) || f.startsWith(join(SRC, "components")));

  it("소스를 실제로 읽었고 'use client' 파일을 1개 이상 찾았다(검사가 비어 통과하지 않는다)", () => {
    expect(files.length).toBeGreaterThan(20);
    expect(clientFiles.length).toBeGreaterThanOrEqual(1);
    expect(clientFiles.map(norm)).toContain("src/lib/weather/use-weather.ts");
  });

  it("브라우저 쪽 파일(use client · components)은 키 이름·serviceKey·게이트웨이 주소를 담지 않는다", () => {
    for (const f of browserSide) {
      const src = text.get(f)!;
      expect(src.includes(KEY_ENV), `${norm(f)}에 키 환경변수 이름`).toBe(false);
      expect(src.includes(KEY_PARAM), `${norm(f)}에 ${KEY_PARAM}`).toBe(false);
      expect(src.includes(GATEWAY_HOST), `${norm(f)}에 게이트웨이 주소`).toBe(false);
    }
  });

  it("브라우저 쪽 파일은 import를 따라가도 weather/kma·weather/service에 닿지 않는다", () => {
    for (const f of browserSide) {
      const reached = reach(f);
      expect(reached.has(KMA_FILE), `${norm(f)} → kma.ts`).toBe(false);
      expect(reached.has(SERVICE_FILE), `${norm(f)} → service.ts`).toBe(false);
    }
  });

  it("src 안에서 키 환경변수 이름은 lib/weather/kma.ts에만 있다", () => {
    const holders = files.filter((f) => text.get(f)!.includes(KEY_ENV)).map(norm);
    expect(holders).toEqual(["src/lib/weather/kma.ts"]);
  });

  it("NEXT_PUBLIC_ 접두어가 붙은 기상청 키 이름이 src와 .env.example에 없다", () => {
    const env = join(ROOT, ".env.example");
    const sources = [...files.map((f) => text.get(f)!), existsSync(env) ? readFileSync(env, "utf8") : ""];
    const bad = new RegExp(`${PUBLIC_PREFIX}\\w*(KMA|WEATHER)`, "i");
    for (const src of sources) expect(bad.test(src)).toBe(false);
  });

  it("weather/service를 import하는 파일은 app/api/weather/route.ts뿐이다", () => {
    const importers = files
      .filter((f) => specifiers(text.get(f)!).some((s) => resolveImport(f, s) === SERVICE_FILE))
      .map(norm);
    expect(importers).toEqual(["src/app/api/weather/route.ts"]);
  });
});
