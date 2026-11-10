// POST /api/route-line — 날짜마다 출발 → 장소들 → 도착 차량 경로선(카카오 다중 경유지 길찾기, 날짜마다 1회).
// 요청: { days: [{ points: [{ lat, lng }, …] }] }  응답: { days: [{ path, km, minutes } | null] }
// 저장하지 않는다(카카오 캐싱 금지). 개인정보 없음(좌표는 관광지·출발 지점). 영동권 좌표만 받는다.

import { routeLine, type LatLng } from "@/lib/kakao";

const MAX_DAYS = 3;
const MAX_POINTS = 14;
// 영동권(강릉·속초·동해)과 주변 여유
const BOUNDS = { minLat: 37.2, maxLat: 38.6, minLng: 128.2, maxLng: 129.4 };

function readDays(body: unknown): LatLng[][] | null {
  const days = (body as { days?: unknown })?.days;
  if (!Array.isArray(days) || days.length === 0 || days.length > MAX_DAYS) return null;
  const out: LatLng[][] = [];
  for (const d of days) {
    const pts = (d as { points?: unknown })?.points;
    if (!Array.isArray(pts) || pts.length < 2 || pts.length > MAX_POINTS) return null;
    const day: LatLng[] = [];
    for (const p of pts) {
      const { lat, lng } = (p ?? {}) as { lat?: unknown; lng?: unknown };
      if (typeof lat !== "number" || typeof lng !== "number") return null;
      if (lat < BOUNDS.minLat || lat > BOUNDS.maxLat || lng < BOUNDS.minLng || lng > BOUNDS.maxLng) return null;
      day.push({ lat, lng });
    }
    out.push(day);
  }
  return out;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "입력 형식이 맞지 않아요" }, { status: 400 });
  }
  const days = readDays(body);
  if (!days) return Response.json({ message: "경로를 그릴 지점이 맞지 않아요" }, { status: 400 });
  const lines = await Promise.all(days.map((pts) => routeLine(pts)));
  return Response.json({ days: lines }, { headers: { "Cache-Control": "no-store" } });
}
