// 사이트 머리줄(11/23 디자인 시안): 모든 화면 맨 위에 같은 로고·이름·부제·메뉴를 둔다.
// PC: 왼쪽 로고 + '이음길' + 초록 부제 '즐거운 영동 여행길', 오른쪽 메뉴 2개.
// 휴대폰(<768px): 메뉴를 줄임 메뉴(☰)로 접는다. 640px 미만은 로고·이름을 작게(머리줄 높이 56px, 글자 200%에서도 가로로 넘치지 않게)(네이티브 <details>라 스크립트 없이 열고 닫힌다). 자세한 모바일 보수는 다음 단계.
// 스크롤해도 따라오지 않는다(레퍼런스 소곳소곳 김포와 같음). 인쇄할 때는 숨긴다.
import { Menu } from "lucide-react";
import Link from "next/link";
import { LogoMark } from "./Logo";

const MENU = [
  { href: "/about", label: "서비스 소개" },
  { href: "/places", label: "관광지 둘러보기" },
];

/** 사이트 내용 폭(머리줄·시작 화면·바닥글이 같은 좌우 끝을 쓴다): 최대 1424px − 좌우 여백 32px = 내용 1360px */
export const SITE_WIDTH = "mx-auto w-full max-w-[89rem] px-4 md:px-6 lg:px-8";

export function SiteHeader() {
  return (
    <header className="relative z-30 border-b border-line bg-white print:hidden">
      <div className={`${SITE_WIDTH} flex min-h-14 items-center justify-between gap-4 sm:min-h-16 lg:min-h-20`}>
        {/* 링크 이름은 '이음길 처음 화면'. 보이는 글자 '이음길'이 이름 안에 들어가야 한다(WCAG 2.5.3) — 부제는 장식으로 읽지 않는다 */}
        <Link href="/" className="flex min-h-touch items-center gap-2 sm:gap-3">
          <span className="sm:hidden">
            <LogoMark size={32} />
          </span>
          <span className="hidden sm:inline">
            <LogoMark size={40} />
          </span>
          <span className="flex items-baseline gap-3">
            <span className="font-heading text-heading font-bold tracking-[0.2em] text-primary-ink sm:text-title">
              이음길<span className="sr-only"> 처음 화면</span>
            </span>
            <span aria-hidden="true" className="hidden text-heading font-medium text-pine sm:inline">
              즐거운 영동 여행길
            </span>
          </span>
        </Link>

        <nav aria-label="주 메뉴" className="hidden md:block">
          <ul className="flex items-center gap-2 lg:gap-6">
            {MENU.map((m) => (
              <li key={m.href}>
                <Link href={m.href} className="inline-flex min-h-touch items-center px-3 text-heading text-ink underline-offset-8 hover:underline">
                  {m.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <details className="group relative md:hidden">
          <summary className="flex size-touch cursor-pointer list-none items-center justify-center rounded-xl text-ink hover:bg-surface [&::-webkit-details-marker]:hidden">
            <Menu size={24} aria-hidden="true" />
            <span className="sr-only">메뉴 열기</span>
          </summary>
          <nav aria-label="주 메뉴" className="absolute top-full right-0 mt-2 w-56 rounded-2xl border border-line bg-white p-2 shadow-[0_8px_24px_rgb(25_31_40/0.12)]">
            <ul className="flex flex-col">
              {MENU.map((m) => (
                <li key={m.href}>
                  <Link href={m.href} className="flex min-h-touch items-center rounded-xl px-3 text-base text-ink hover:bg-surface">
                    {m.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </details>
      </div>
    </header>
  );
}
