import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import places from "../../../../data/places.json";
import { loadShare } from "@/lib/share/supabase";
import { shareToTripView } from "@/lib/share/view";
import type { Place } from "@/lib/types";
import { SharedScreen, SharedMissing } from "./SharedScreen";

// 공유 링크(읽기 전용, 11/14): 저장된 안을 서버에서 읽어 확정 일정 화면으로 보여준다. 로그인 없음.
// 이동시간·경로는 저장값이 아니라 화면이 열린 뒤 카카오에서 다시 받는다. 검색 엔진에는 올리지 않는다.
export const metadata: Metadata = { title: "공유받은 여행 일정 · 이음길 AI", robots: { index: false, follow: false } };

export default function SharePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p className="mx-auto max-w-[30rem] px-5 pt-16 text-base text-ink-sub">공유받은 일정을 불러오고 있어요…</p>}>
      <Shared params={params} />
    </Suspense>
  );
}

async function Shared({ params }: { params: Promise<{ id: string }> }) {
  await connection(); // 요청마다 새로 읽는다(만료·삭제 반영)
  const { id } = await params;
  const r = await loadShare(id);
  if (!r.ok) return <SharedMissing reason={r.reason} />;
  const until = new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", timeZone: "Asia/Seoul" }).format(new Date(Date.parse(r.expiresAt) - 1));
  return <SharedScreen trip={shareToTripView(r.doc, id, places as unknown as Place[])} until={until} />;
}
