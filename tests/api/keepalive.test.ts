// Supabase 깨워 두기: 무료 프로젝트는 7일 동안 요청이 없으면 멈춘다 → Vercel Cron이 하루 한 번 가볍게 읽는다.
// 읽기만 하고(행 1개 id) 아무것도 저장하지 않는다. CRON_SECRET이 있으면 Vercel이 보낸 요청만 받는다.
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/keepalive/route";

const req = (auth?: string) => new Request("http://localhost/api/keepalive", { headers: auth ? { authorization: auth } : {} });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("GET /api/keepalive", () => {
  it("CRON_SECRET이 있으면 맞는 요청만 받는다", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key");
    vi.stubGlobal("fetch", vi.fn(async () => Response.json([])));
    expect((await GET(req())).status).toBe(401);
    expect((await GET(req("Bearer wrong"))).status).toBe(401);
    expect((await GET(req("Bearer s3cret"))).status).toBe(200);
  });

  it("trips를 한 줄만 읽고(쓰지 않음) 결과를 알려 준다", async () => {
    vi.stubEnv("CRON_SECRET", "");
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key");
    const fetchMock = vi.fn<(url: string | URL | Request, init?: RequestInit) => Promise<Response>>(async () => Response.json([]));
    vi.stubGlobal("fetch", fetchMock);
    const res = await GET(req());
    expect(await res.json()).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://example.supabase.co/rest/v1/trips?select=id&limit=1");
    expect(init?.method ?? "GET").toBe("GET");
  });

  it("Supabase가 없거나 실패하면 ok: false(오류로 멈추지 않음)", async () => {
    vi.stubEnv("CRON_SECRET", "");
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    expect(await (await GET(req())).json()).toEqual({ ok: false });
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("paused", { status: 503 })));
    expect(await (await GET(req())).json()).toEqual({ ok: false });
  });
});
