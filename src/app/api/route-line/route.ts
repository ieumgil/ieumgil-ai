// POST /api/route-line — 날짜마다 출발 → 장소들 → 도착 차량 경로선(카카오 다중 경유지 길찾기, 날짜마다 1회).
// 요청: { days: [{ points: [{ lat, lng }, …] }] }  응답: { days: [{ path, km, minutes } | null] }
// 저장하지 않는다(카카오 캐싱 금지). 개인정보 없음(좌표는 관광지·출발 지점). 영동권 좌표만 받는다.

import { routeLine } from "@/lib/kakao";
import { readDays } from "@/lib/route-points";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "입력 형식이 맞지 않아요" }, { status: 400 });
  }
  const days = readDays(body, 3);
  if (!days) return Response.json({ message: "경로를 그릴 지점이 맞지 않아요" }, { status: 400 });
  const lines = await Promise.all(days.map((pts) => routeLine(pts)));
  return Response.json({ days: lines }, { headers: { "Cache-Control": "no-store" } });
}
