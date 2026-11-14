// 카카오모빌리티 길찾기(서버 전용: REST 키는 환경변수에서만 읽는다).
// 결과는 저장하지 않는다(카카오 캐싱 금지 정책) — 요청마다 받아서 바로 돌려준다.
// 경로선은 "일반 차량 경로"다. 휠체어 안전 경로라고 쓰지 않는다.

import type { RealLeg } from "./engine/real-travel";
import { PARK_MIN } from "./engine/travel";

export interface LatLng {
  lat: number;
  lng: number;
}

export interface RouteLine {
  /** [위도, 경도] 점들 */
  path: [number, number][];
  km: number;
  minutes: number;
  /** 구간(출발 → 1, 1 → 2, …, 마지막 → 도착)마다 경로·거리·시간(지도에 구간 화살표·시간 표시) */
  sections: { path: [number, number][]; km: number; minutes: number }[];
}

const WAYPOINTS_URL = "https://apis-navi.kakaomobility.com/v1/waypoints/directions";
/** 다중 경유지 길찾기의 경유지 최대 개수(출발·도착 제외) */
export const MAX_WAYPOINTS = 30;

type KakaoRoute = {
  result_code: number;
  result_msg: string;
  summary?: { distance: number; duration: number };
  sections?: { distance: number; duration: number; roads?: { vertexes: number[] }[] }[];
};

/** 출발 → 경유지들 → 도착 차량 경로 1회(다중 경유지 길찾기). 실패하면 null */
async function kakaoRoute(points: LatLng[], timeoutMs: number): Promise<KakaoRoute | null> {
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
    return route && route.result_code === 0 && route.summary ? route : null;
  } catch {
    return null;
  }
}

/** 출발 → 경유지들 → 도착 경로선. 실패하면 null(화면은 직선으로 잇는다) */
export async function routeLine(points: LatLng[], { timeoutMs = 8_000 }: { timeoutMs?: number } = {}): Promise<RouteLine | null> {
  const route = await kakaoRoute(points, timeoutMs);
  if (!route?.summary) return null;
  const sections = (route.sections ?? []).map((s) => {
    const path: [number, number][] = [];
    for (const r of s.roads ?? []) {
      for (let i = 0; i + 1 < r.vertexes.length; i += 2) path.push([r.vertexes[i + 1], r.vertexes[i]]);
    }
    return { path, km: Math.round((s.distance ?? 0) / 100) / 10, minutes: Math.round((s.duration ?? 0) / 60) };
  });
  return { path: sections.flatMap((s) => s.path), km: Math.round(route.summary.distance / 100) / 10, minutes: Math.round(route.summary.duration / 60), sections };
}

/**
 * 구간별 차량 이동(출발 → 첫 장소, …, 마지막 장소 → 도착). 일정 시각 계산용.
 * 분 = 카카오 소요 시간 + 주차·승하차 PARK_MIN분(직선 추정과 같은 기준). 실패하거나 구간 수가 맞지 않으면 null(추정으로 계산).
 * 받은 값은 그 요청에서만 쓰고 저장하지 않는다.
 */
export async function routeLegs(points: LatLng[], { timeoutMs = 6_000 }: { timeoutMs?: number } = {}): Promise<RealLeg[] | null> {
  const route = await kakaoRoute(points, timeoutMs);
  const sections = route?.sections ?? [];
  if (!route || sections.length !== points.length - 1) return null;
  return sections.map((s) => ({ minutes: Math.max(1, Math.round(s.duration / 60)) + PARK_MIN, km: Math.round(s.distance / 100) / 10 }));
}
