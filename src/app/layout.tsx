import type { Metadata, Viewport } from "next";
import { INTRO_SCRIPT } from "@/lib/intro";
// 글꼴 Noto Sans KR(가변 100~900, SIL OFL 1.1) 한 벌 — 본문·제목·숫자 모두(11/18 시안 N2 '차분하게').
// next/font/local은 파일 하나씩만 받아 unicode-range 조각을 못 쓴다. 패키지 CSS를 그대로 불러오면 브라우저가 화면에 쓴 글자가 든 조각만 받는다.
// 같은 사이트에서만 받고(외부 CDN·Google 요청 없음) 버전은 package.json에 고정.
import "@fontsource-variable/noto-sans-kr";
import "./globals.css";

export const metadata: Metadata = {
  title: "이음길 AI",
  description: "휠체어·어르신·유모차와 함께 가는 강릉·속초·동해 여행 루트 플래너",
};

export const viewport: Viewport = {
  themeColor: "#1E6FD0",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased" suppressHydrationWarning>
      <head>
        {/* 첫 접속 인트로를 보여줄지 첫 화면을 그리기 전에 정한다(깜빡임 방지) */}
        <script dangerouslySetInnerHTML={{ __html: INTRO_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
