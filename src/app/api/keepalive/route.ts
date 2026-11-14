// GET /api/keepalive — Supabase 깨워 두기(Vercel Cron, 하루 한 번, vercel.json).
// 무료 Supabase 프로젝트는 7일 동안 요청이 없으면 멈춰서 공유 링크가 열리지 않는다 → 행 1개 id만 읽는다(쓰기·개인정보 없음).
// CRON_SECRET이 있으면 Vercel이 보낸 요청(Authorization: Bearer …)만 받는다.
// 요청 헤더를 먼저 읽어서 빌드 때 미리 만들어지지 않고 요청마다 실행된다(Cache Components 규칙).

import { pingShare } from "@/lib/share/supabase";

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (secret && auth !== `Bearer ${secret}`) {
    return Response.json({ ok: false }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const ok = await pingShare();
  return Response.json({ ok }, { headers: { "Cache-Control": "no-store" } });
}
