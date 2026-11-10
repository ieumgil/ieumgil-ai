import type { Metadata } from "next";
import { Suspense } from "react";
import { FinalScreen } from "./FinalScreen";

export const metadata: Metadata = { title: "확정 일정 · 이음길 AI" };

// 확정 일정 + 지도. /trip/new/final = 방금 만든 일정에서 정한 안(이 탭에 보관)
export default function FinalPage() {
  return (
    <Suspense fallback={null}>
      <FinalScreen />
    </Suspense>
  );
}
