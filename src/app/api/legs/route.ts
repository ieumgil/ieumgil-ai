// POST /api/legs — 날짜마다 출발 → 장소들 → 도착의 구간별 실제 차량 이동시간(카카오 다중 경유지 길찾기, 날짜마다 1회).
// 결과·확정 화면이 열 때마다 불러 시각을 다시 계산한다(원칙 3: 카카오 결과는 저장하지 않고 열 때 다시 계산).
// 요청: { days: [{ points: [{ lat, lng }, …] }] }  응답: { days: [[{ minutes, km }, …] | null] } (못 받은 날은 null → 화면은 추정)
// 저장하지 않는다(no-store). 개인정보 없음(좌표는 관광지·출발 지점). 영동권 좌표만 받는다.

import { routeLegs } from "@/lib/kakao";
import { readDays } from "@/lib/route-points";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ message: "입력 형식이 맞지 않아요" }, { status: 400 });
  }
  const days = readDays(body);
  if (!days) return Response.json({ message: "이동시간을 계산할 지점이 맞지 않아요" }, { status: 400 });
  const legs = await Promise.all(days.map((pts) => routeLegs(pts)));
  return Response.json({ days: legs }, { headers: { "Cache-Control": "no-store" } });
}
