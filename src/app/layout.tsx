import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { SiteHeader } from "@/components/SiteHeader";
import { INTRO_SCRIPT } from "@/lib/intro";
import "./globals.css";

// 글꼴 2개만(11/23 디자인 시안): 본문·제목·숫자·버튼 전부 Pretendard, 시작 화면 히어로 문구만 카페24 숑숑. 구분은 크기·굵기로만.
// 둘 다 SIL OFL 1.1, 같은 사이트에서만 받는다(외부 CDN·Google 요청 없음).
const pretendard = localFont({
  src: "../../node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2",
  variable: "--font-pretendard",
  weight: "45 920",
  display: "swap",
});
// 히어로 문구 글자만 남겨 줄인 파일(약 3.5KB, src/app/fonts/README.md)
const syongsyong = localFont({
  src: "./fonts/cafe24-syongsyong-hero.woff",
  variable: "--font-syongsyong",
  display: "swap",
});

export const metadata: Metadata = {
  title: "이음길 AI",
  description: "휠체어·어르신·유모차와 함께 가는 강릉·속초·동해 여행 루트 플래너",
};

export const viewport: Viewport = {
  themeColor: "#3580db",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${pretendard.variable} ${syongsyong.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        {/* 첫 접속 인트로를 보여줄지 첫 화면을 그리기 전에 정한다(깜빡임 방지) */}
        <script dangerouslySetInnerHTML={{ __html: INTRO_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
