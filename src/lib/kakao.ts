// 카카오모빌리티 길찾기(서버 전용: REST 키는 환경변수에서만 읽는다).
// 결과는 저장하지 않는다(카카오 캐싱 금지 정책) — 요청마다 받아서 바로 돌려준다.
// 경로선은 "일반 차량 경로"다. 휠체어 안전 경로라고 쓰지 않는다.

export interface LatLng {
  lat: number;
  lng: number;
}

export interface RouteLine {
  /** [위도, 경도] 점들 */
  path: [number, number][];
  km: number;
  minutes: number;
}

const WAYPOINTS_URL = "https://apis-navi.kakaomobility.com/v1/waypoints/directions";
/** 다중 경유지 길찾기의 경유지 최대 개수(출발·도착 제외) */
export const MAX_WAYPOINTS = 30;

type KakaoRoute = {
  result_code: number;
  result_msg: string;
  summary?: { distance: number; duration: number };
  sections?: { roads?: { vertexes: number[] }[] }[];
};

/** 출발 → 경유지들 → 도착 차량 경로 1회. 실패하면 null(화면은 직선으로 잇는다) */
export async function routeLine(points: LatLng[], { timeoutMs = 8_000 }: { timeoutMs?: number } = {}): Promise<RouteLine | null> {
  const key = process.env.KAKAO_REST_API_KEY?.trim();
  if (!key || points.length < 2 || points.length - 2 > MAX_WAYPOINTS) return null;
  const xy = (p: LatLng) => ({ x: String(p.lng), y: String(p.lat) });
  try {
    const res = await fetch(WAYPOINTS_URL, {
      method: "POST",
      headers: { Authorization: `KakaoAK ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        origin: xy(points[0]),
        destination: xy(points[points.length - 1]),
        waypoints: points.slice(1, -1).map(xy),
        priority: "RECOMMEND",
      }),
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { routes?: KakaoRoute[] };
    const route = body.routes?.[0];
    if (!route || route.result_code !== 0 || !route.summary) return null;
    const path: [number, number][] = [];
    for (const s of route.sections ?? []) {
      for (const r of s.roads ?? []) {
        for (let i = 0; i + 1 < r.vertexes.length; i += 2) path.push([r.vertexes[i + 1], r.vertexes[i]]);
      }
    }
    return { path, km: Math.round(route.summary.distance / 100) / 10, minutes: Math.round(route.summary.duration / 60) };
  } catch {
    return null;
  }
}
