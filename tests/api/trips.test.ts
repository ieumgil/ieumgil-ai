// 공유 링크 API: 검사를 통과한 안만 Supabase(서버 키, REST)에 저장하고 주소 id와 사라지는 날을 돌려준다.
// 키가 없으면 '아직 준비 안 됨'(503), 저장은 서버에서만, 응답은 저장하지 않는다(no-store).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/trips/route";
import { toShareDoc } from "@/lib/share/doc";
import type { TripView } from "@/lib/trip/view";

const trip = JSON.parse(readFileSync(resolve(__dirname, "../e2e/fixtures/trip-view.json"), "utf8")) as TripView;
const doc = toShareDoc(trip, trip.options[0]);
const req = (body: unknown) => new Request("http://localhost/api/trips", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("POST /api/trips", () => {
  it("Supabase 키가 없으면 503으로 '아직 준비 중'", async () => {
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    const res = await POST(req(doc));
    expect(res.status).toBe(503);
  });

  it("검사를 통과하면 서버 키로 trips에 넣고 id·사라지는 날을 돌려준다", async () => {
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key");
    const fetchMock = vi.fn<(url: string | URL | Request, init?: RequestInit) => Promise<Response>>(async () => new Response(null, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    const res = await POST(req(doc));
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const body = (await res.json()) as { id: string; expiresAt: string };
    expect(body.id).toMatch(/^[0-9A-Za-z]{10}$/);
    expect(Date.parse(body.expiresAt)).toBeGreaterThan(Date.now());

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://example.supabase.co/rest/v1/trips");
    expect(init?.method).toBe("POST");
    const headers = new Headers(init?.headers);
    expect(headers.get("apikey")).toBe("service-key");
    expect(headers.get("Authorization")).toBeNull(); // 새 secret 키는 apikey에만
    const row = JSON.parse(String(init?.body)) as { id: string; doc: unknown; expires_at: string };
    expect(row).toEqual({ id: body.id, doc, expires_at: body.expiresAt }); // 이름·IP 같은 칸 없음
  });

  it("형식이 틀리거나 모르는 장소면 400, 저장하지 않는다", async () => {
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect((await POST(req("{not json"))).status).toBe(400);
    const bad = structuredClone(doc);
    bad.option.draft.days[0].stops[0].placeId = "XX99";
    expect((await POST(req(bad))).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("Supabase가 실패하면 502", async () => {
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("down", { status: 500 })));
    expect((await POST(req(doc))).status).toBe(502);
  });

  it("예전 service_role 키(JWT)면 Authorization에도 넣는다", async () => {
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co/");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "eyJhbGciOi.test.key");
    const fetchMock = vi.fn<(url: string | URL | Request, init?: RequestInit) => Promise<Response>>(async () => new Response(null, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    expect((await POST(req(doc))).status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://example.supabase.co/rest/v1/trips"); // 끝의 / 정리
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer eyJhbGciOi.test.key");
  });
});
