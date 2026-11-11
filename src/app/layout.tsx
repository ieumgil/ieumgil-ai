import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { INTRO_SCRIPT } from "@/lib/intro";
import "./globals.css";

const pretendard = localFont({
  src: "../../node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2",
  variable: "--font-pretendard",
  weight: "45 920",
  display: "swap",
});

export const metadata: Metadata = {
  title: "이음길 AI",
  description: "휠체어·어르신·유모차와 함께 가는 강릉·속초·동해 여행 루트 플래너",
};

export const viewport: Viewport = {
  themeColor: "#1E6FD0",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${pretendard.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        {/* 첫 접속 인트로를 보여줄지 첫 화면을 그리기 전에 정한다(깜빡임 방지) */}
        <script dangerouslySetInnerHTML={{ __html: INTRO_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
