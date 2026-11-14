// 서비스키 정규화·마스킹·게이트웨이 선택(T-02-07·T-02-08). 포털 키는 Encoding/Decoding 두 가지 모양으로 받아도 같은 요청이 나가야 하고(이중 인코딩 → 30 오류),
// 저장·출력 전에는 키의 네 가지 모양을 모두 지울 수 있어야 하며, 게이트웨이 환경변수는 닫힌 두 값만 알아듣는다.
import { afterEach, describe, expect, it, vi } from "vitest";
import { KMA_GATEWAYS, kmaGateway, kmaGet, maskKey, normalizeKey } from "../../src/lib/weather/kma";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("normalizeKey", () => {
  it("Encoding 형태(%2B·%3D)는 Decoding 형태로 풀어 둘이 같아진다", () => {
    expect(normalizeKey("abc%2Bdef%3D%3D")).toBe("abc+def==");
    expect(normalizeKey("abc+def==")).toBe("abc+def==");
    expect(normalizeKey("abc%2Bdef%3D%3D")).toBe(normalizeKey("abc+def=="));
  });

  it("앞뒤 공백·줄바꿈은 지운다", () => {
    expect(normalizeKey("  abc+def==\n")).toBe("abc+def==");
    expect(normalizeKey(" abc%2Bdef \r\n")).toBe("abc+def");
  });

  it("잘못된 % 순서는 풀지 않고 그대로 둔다(던지지 않는다)", () => {
    expect(normalizeKey("ab%zz")).toBe("ab%zz");
    expect(normalizeKey("ab%")).toBe("ab%");
  });

  it("빈 값은 빈 값", () => {
    expect(normalizeKey("")).toBe("");
    expect(normalizeKey("   ")).toBe("");
  });
});

describe("kmaGet: 키를 어떤 모양으로 넣어도 같은 요청", () => {
  async function urlFor(envKey: string): Promise<URL> {
    vi.stubEnv("KMA_API_KEY", envKey);
    vi.stubEnv("KMA_GATEWAY", "");
    const seen: URL[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL) => {
        seen.push(new URL(String(url)));
        return Response.json({ response: { header: { resultCode: "00" } } });
      }),
    );
    await kmaGet("VilageFcstInfoService_2.0/getVilageFcst", { nx: "92", ny: "131" });
    return seen[0];
  }

  it("Encoding 형태와 Decoding 형태의 URL(쿼리 문자열 전체)이 똑같다", async () => {
    const enc = await urlFor("abc%2Bdef%3D%3D");
    const dec = await urlFor("abc+def==");
    expect(enc.search).toBe(dec.search);
    expect(enc.searchParams.get("serviceKey")).toBe("abc+def==");
    expect(dec.searchParams.get("serviceKey")).toBe("abc+def==");
  });

  it("이중 인코딩이 없다(쿼리에 %252B 같은 모양이 없다)", async () => {
    const enc = await urlFor("abc%2Bdef%3D%3D");
    expect(enc.search).toContain("serviceKey=abc%2Bdef%3D%3D");
    expect(enc.search).not.toContain("%25");
  });

  it("공백이 낀 환경변수 값도 같은 요청", async () => {
    const padded = await urlFor("  abc+def==  ");
    const clean = await urlFor("abc+def==");
    expect(padded.search).toBe(clean.search);
  });
});

describe("maskKey", () => {
  // encodeURIComponent는 ! ( ) ~ 를 그대로 두고 URLSearchParams는 %21 %28 %29 %7E로 바꾼다 → 두 형태가 달라지는 키
  const key = "k!(x)~y+z/q==";
  const forms = [key, encodeURIComponent(key), new URLSearchParams({ k: key }).toString().slice(2)];

  it("네 가지 모양이 서로 다르게 나오는 키를 쓴다(테스트 전제)", () => {
    expect(new Set(forms).size).toBe(3);
  });

  it("원래 키·인코딩 형태(encodeURIComponent·URLSearchParams)를 모두 ***로 바꾼다", () => {
    for (const form of forms) {
      const masked = maskKey(`요청 실패 https://x/?serviceKey=${form}&a=1`, key);
      expect(masked).not.toContain(form);
      expect(masked).toContain("serviceKey=***&a=1");
    }
  });

  it("Encoding 형태로 넣은 원래 키와 정규화한 키 둘 다 지운다", () => {
    const raw = "abc%2Bdef%3D%3D";
    const masked = maskKey(`raw=${raw} norm=abc+def==`, raw);
    expect(masked).toBe("raw=*** norm=***");
  });

  it("한 글에 여러 번 나와도 모두 바꾼다", () => {
    expect(maskKey(`${key} ${key}`, key)).toBe("*** ***");
  });

  it("key가 빈 값이면 text를 그대로 돌려준다(빈 문자열로 모든 곳이 ***가 되지 않는다)", () => {
    expect(maskKey("그대로 두는 글", "")).toBe("그대로 두는 글");
    expect(maskKey("그대로 두는 글", "   ")).toBe("그대로 두는 글");
  });
});

describe("kmaGateway: 닫힌 두 값(portal·apihub)", () => {
  it("환경변수가 없음·portal·아무거나면 포털(apis.data.go.kr, serviceKey)", () => {
    for (const value of [undefined, "", "portal", "아무거나", "https://evil.example/", "APIHUB", " apihub"]) {
      vi.stubEnv("KMA_GATEWAY", value as string);
      const g = kmaGateway();
      expect(new URL(g.base).host).toBe("apis.data.go.kr");
      expect(g.keyParam).toBe("serviceKey");
    }
  });

  it("apihub면 apihub.kma.go.kr·/api/typ02/openApi/·authKey", () => {
    vi.stubEnv("KMA_GATEWAY", "apihub");
    const g = kmaGateway();
    const u = new URL(g.base);
    expect(u.host).toBe("apihub.kma.go.kr");
    expect(u.pathname.startsWith("/api/typ02/openApi/")).toBe(true);
    expect(g.keyParam).toBe("authKey");
  });

  it("KMA_GATEWAYS는 portal·apihub 두 항목뿐이다", () => {
    expect(Object.keys(KMA_GATEWAYS).sort()).toEqual(["apihub", "portal"]);
  });

  it("kmaGet은 환경변수 대신 { gateway, key }로 덮어쓸 수 있다(프로브용)", async () => {
    vi.stubEnv("KMA_API_KEY", "env-key");
    vi.stubEnv("KMA_GATEWAY", "");
    const seen: URL[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL) => {
        seen.push(new URL(String(url)));
        return Response.json({});
      }),
    );
    await kmaGet("VilageFcstInfoService_2.0/getVilageFcst", { nx: "92" }, { gateway: "apihub", key: "probe%2Bkey" });
    expect(seen[0].host).toBe("apihub.kma.go.kr");
    expect(seen[0].pathname).toBe("/api/typ02/openApi/VilageFcstInfoService_2.0/getVilageFcst");
    expect(seen[0].searchParams.get("authKey")).toBe("probe+key");
    expect(seen[0].searchParams.has("serviceKey")).toBe(false);
  });

  it("환경변수에 apihub를 넣으면 kmaGet이 apihub로 간다", async () => {
    vi.stubEnv("KMA_API_KEY", "env-key");
    vi.stubEnv("KMA_GATEWAY", "apihub");
    const seen: URL[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL) => {
        seen.push(new URL(String(url)));
        return Response.json({});
      }),
    );
    await kmaGet("VilageFcstInfoService_2.0/getVilageFcst", { nx: "92" });
    expect(seen[0].host).toBe("apihub.kma.go.kr");
    expect(seen[0].searchParams.get("authKey")).toBe("env-key");
  });
});
