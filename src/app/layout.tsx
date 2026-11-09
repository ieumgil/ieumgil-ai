import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { FONT_SIZE_KEY } from "@/lib/font-size";
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

// 저장된 "글씨 크게" 설정을 첫 화면이 그려지기 전에 적용한다(깜빡임 방지).
const applyFontSize = `(function(){try{if(localStorage.getItem(${JSON.stringify(FONT_SIZE_KEY)})==="large")document.documentElement.dataset.fontSize="large"}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${pretendard.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: applyFontSize }} />
      </head>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
