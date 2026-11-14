// POST /api/trips — 확정 일정 공유 링크 만들기(11/14). 요청: 공유할 안(ShareDoc, src/lib/share/doc.ts)
// 응답: { id, expiresAt } → 화면이 /s/{id} 주소를 만든다. 검사(정해진 칸만 · 알려진 장소 · 크기)를 통과한 것만 저장.
// 카카오 결과·개인정보는 저장하지 않는다. Supabase 키가 없으면 503(아직 준비 중).

import places from "../../../../data/places.json";
import { checkShareDoc, expiresAt, newShareId } from "@/lib/share/doc";
import { saveShare, shareReady } from "@/lib/share/supabase";

const KNOWN = new Set((places as { id: string }[]).map((p) => p.id));
const noStore = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  if (!shareReady()) return Response.json({ message: "공유 링크는 아직 준비 중이에요" }, { status: 503, headers: noStore });
  let doc: unknown;
  try {
    doc = await request.json();
  } catch {
    return Response.json({ message: "입력 형식이 맞지 않아요" }, { status: 400, headers: noStore });
  }
  const problem = checkShareDoc(doc, KNOWN);
  if (problem) return Response.json({ message: problem }, { status: 400, headers: noStore });

  const id = newShareId();
  const expires = expiresAt((doc as { input: { endDate: string } }).input.endDate);
  const saved = await saveShare(id, doc as Parameters<typeof saveShare>[1], expires);
  if (!saved) return Response.json({ message: "공유 링크를 만들지 못했어요. 잠시 뒤 다시 눌러 주세요" }, { status: 502, headers: noStore });
  return Response.json({ id, expiresAt: expires.toISOString() }, { headers: noStore });
}
