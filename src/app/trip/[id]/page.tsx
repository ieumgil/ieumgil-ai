import type { Metadata } from "next";
import { Suspense } from "react";
import { TripScreen } from "./TripScreen";

export const metadata: Metadata = { title: "여행 일정 · 이음길 AI" };

// 결과 화면 (시안: ResultMobile·ResultDesktop). /trip/new = 방금 만든 일정(이 탭에 보관), /trip/example = 예시(준비 중)
export default function TripPage() {
  return (
    <Suspense fallback={null}>
      <TripScreen />
    </Suspense>
  );
}
