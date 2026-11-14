// GET /api/weather — 강릉·속초·동해의 기상청 단기예보를 날짜별 하루 값 표로 돌려준다(쿼리 없음).
// 원칙 4: 기상청 키는 서버 환경변수로만 읽는다(lib/weather/kma.ts). 응답에는 정리된 하루 값만 있고 키·요청 URL은 없다.
// D-04: 저장하지 않는다(서버 짧은 캐시만). D-05: 키가 없거나 기상청이 실패해도 200 { available: false } — 화면은 날씨 칸만 빠진다.
// 입력이 없는 핸들러는 빌드 때 굳을 수 있어 첫 줄에서 connection()으로 요청 시점에 실행한다.
// 입력은 받지 않는다: 쿼리가 붙은 요청은 기상청을 부르지 않고 400(주소마다 따로 캐시돼 호출 한도를 소진하는 것을 막는다).

import { connection } from "next/server";
import { hasKmaKey } from "@/lib/weather/kma";
import { buildWeatherPayload, cachedDeps } from "@/lib/weather/service";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  await connection();
  if (new URL(request.url).search !== "") return Response.json({ available: false }, { status: 400, headers: NO_STORE });
  if (!hasKmaKey()) return Response.json({ available: false }, { headers: NO_STORE });
  try {
    const payload = await buildWeatherPayload(new Date(), cachedDeps);
    if (!payload.available) return Response.json(payload, { headers: NO_STORE });
    return Response.json(payload, { headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=1800" } });
  } catch {
    return Response.json({ available: false }, { headers: NO_STORE });
  }
}
