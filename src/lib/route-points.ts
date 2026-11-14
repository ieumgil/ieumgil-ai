// 화면에서 보낸 날짜별 지점(출발 → 장소 → 도착) 읽기. /api/route-line·/api/legs가 같이 쓴다(서버 전용).
// 영동권 좌표만, 날짜 9개(안 3개 × 3일)·지점 14개까지 받는다. 형식이 틀리면 null.

import type { LatLng } from "./kakao";

const MAX_DAYS = 9; // 안 3개 × 날짜 3개(안 비교 화면이 한 번에 묻는다)
const MAX_POINTS = 14;
// 영동권(강릉·속초·동해)과 주변 여유
const BOUNDS = { minLat: 37.2, maxLat: 38.6, minLng: 128.2, maxLng: 129.4 };

export function readDays(body: unknown, maxDays = MAX_DAYS): LatLng[][] | null {
  const days = (body as { days?: unknown })?.days;
  if (!Array.isArray(days) || days.length === 0 || days.length > maxDays) return null;
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
