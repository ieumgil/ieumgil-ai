// 경로선 API: 영동권 좌표만 받고, 카카오 응답을 [위도, 경도]로 바꿔 돌려주며, 저장하지 않는다(no-store).
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/route-line/route";
import { routeLine } from "@/lib/kakao";

const req = (body: unknown) => new Request("http://localhost/api/route-line", { method: "POST", body: JSON.stringify(body) });
const station = { lat: 37.7646, lng: 128.8996 };
const ojuk = { lat: 37.7791, lng: 128.8788 };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("POST /api/route-line", () => {
  it("영동권 밖 좌표·형식이 틀린 값은 받지 않는다", async () => {
    expect((await POST(req({ days: [{ points: [{ lat: 0, lng: 0 }, station] }] }))).status).toBe(400);
    expect((await POST(req({ days: [{ points: [station] }] }))).status).toBe(400);
    expect((await POST(req({ days: [] }))).status).toBe(400);
    expect((await POST(req({ days: [{ points: [{ lat: "37", lng: 128 }, station] }] }))).status).toBe(400);
  });

  it("카카오를 못 쓰면(키 없음) null을 돌려주고, 응답은 저장하지 않는다", async () => {
    vi.stubEnv("KAKAO_REST_API_KEY", "");
    const res = await POST(req({ days: [{ points: [station, ojuk, station] }] }));
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(await res.json()).toEqual({ days: [null] });
  });
});

describe("routeLine(카카오 다중 경유지)", () => {
  it("출발·경유·도착을 x,y로 보내고, 꼭짓점을 [위도, 경도]로 바꾼다", async () => {
    vi.stubEnv("KAKAO_REST_API_KEY", "test-key");
    const fetchMock = vi.fn(async () =>
      Response.json({ routes: [{ result_code: 0, result_msg: "ok", summary: { distance: 12_240, duration: 1_440 }, sections: [{ roads: [{ vertexes: [128.9, 37.76, 128.88, 37.78] }] }] }] }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const r = await routeLine([station, ojuk, station]);
    expect(r).toEqual({ path: [[37.76, 128.9], [37.78, 128.88]], km: 12.2, minutes: 24 });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.origin).toEqual({ x: "128.8996", y: "37.7646" });
    expect(body.waypoints).toEqual([{ x: "128.8788", y: "37.7791" }]);
  });

  it("카카오가 경로를 못 찾으면 null(화면은 직선으로 잇는다)", async () => {
    vi.stubEnv("KAKAO_REST_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ routes: [{ result_code: 104, result_msg: "too close" }] })));
    expect(await routeLine([station, ojuk])).toBeNull();
  });
});

describe("POST /api/legs · routeLegs(구간별 실제 이동시간)", () => {
  it("영동권 밖 좌표는 받지 않고, 키가 없으면 null(화면은 추정), 저장하지 않는다", async () => {
    const { POST: legs } = await import("@/app/api/legs/route");
    const r = (body: unknown) => new Request("http://localhost/api/legs", { method: "POST", body: JSON.stringify(body) });
    expect((await legs(r({ days: [{ points: [{ lat: 0, lng: 0 }, station] }] }))).status).toBe(400);
    vi.stubEnv("KAKAO_REST_API_KEY", "");
    const res = await legs(r({ days: [{ points: [station, ojuk, station] }] }));
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(await res.json()).toEqual({ days: [null] });
  });

  it("구간마다 분(카카오 소요 + 주차·승하차 5분)·km, 구간 수가 지점 수 - 1이 아니면 null", async () => {
    const { routeLegs } = await import("@/lib/kakao");
    vi.stubEnv("KAKAO_REST_API_KEY", "test-key");
    const sections = [
      { distance: 2_900, duration: 480, roads: [] },
      { distance: 3_100, duration: 540, roads: [] },
    ];
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ routes: [{ result_code: 0, result_msg: "ok", summary: { distance: 6_000, duration: 1_020 }, sections }] })));
    expect(await routeLegs([station, ojuk, station])).toEqual([
      { minutes: 13, km: 2.9 },
      { minutes: 14, km: 3.1 },
    ]);
    expect(await routeLegs([station, ojuk, station, ojuk])).toBeNull();
  });
});
