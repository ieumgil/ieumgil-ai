// 사이트 머리줄(11/23 디자인 시안): 모든 화면 맨 위에 같은 로고·이름·부제·메뉴를 둔다.
// 11/25 고칠 목록 5: 상단바는 모든 화면의 길잡이, 시작 화면 아이콘 띠(큰 그림 5개)는 처음 온 사람의 안내판 — 모양·개수를 달리해 겹쳐 보이지 않게.
//   레퍼런스(웹쟁이 '관광' 검색의 지자체 관광 사이트 9곳): 모두 상단 글자 메뉴 + 메인 아이콘 바로가기를 함께 두고,
//   보령 문화관광은 상단 오른쪽에 가장 하고 싶은 일 하나를 알약 버튼('한 눈에 보는 보령 MAP')으로 강조한다 → 같은 방식으로 [여행 루트 만들기].
// PC: 왼쪽 로고 + '이음길' + 초록 부제, 오른쪽 글자 메뉴 3개(예시 루트 · 관광지 둘러보기 · 서비스 소개) + 파란 알약 버튼. 지금 보는 화면의 메뉴에 밑줄(aria-current).
// 휴대폰(<768px): 로고 · [루트 만들기] 버튼 · 줄임 메뉴(☰, 네이티브 <details>라 스크립트 없이 열고 닫힘 — 안에 '만든 방법'까지 4개).
//   640px 미만은 로고·이름을 작게(머리줄 56px). 버튼은 360px(22.5rem — 글자를 키우면 그만큼 일찍) 미만이면 숨기고 ☰ 안의 메뉴로.
// 스크롤해도 따라오지 않는다(레퍼런스 소곳소곳 김포와 같음). 인쇄할 때는 숨긴다.
import { Menu } from "lucide-react";
import Link from "next/link";
import { LogoMark } from "./Logo";
import { SiteCta, SiteNavLinks, type NavItem } from "./SiteNav";

const MENU: NavItem[] = [
  { href: "/trip/example", label: "예시 루트" },
  { href: "/places", label: "관광지 둘러보기" },
  { href: "/about", label: "서비스 소개" },
];
/** 휴대폰 ☰ 안: 상단 메뉴 + '만든 방법'(PC에서는 서비스 소개 글 안에서 이어진다) */
const MOBILE_MENU: NavItem[] = [...MENU, { href: "/about/how", label: "만든 방법" }];

/** 사이트 내용 폭(머리줄·시작 화면·바닥글이 같은 좌우 끝을 쓴다): 최대 1424px − 좌우 여백 32px = 내용 1360px */
export const SITE_WIDTH = "mx-auto w-full max-w-[89rem] px-4 md:px-6 lg:px-8";

export function SiteHeader() {
  return (
    <header className="relative z-30 border-b border-line bg-white print:hidden">
      <div className={`${SITE_WIDTH} flex min-h-14 flex-wrap items-center justify-between gap-x-3 sm:min-h-16 lg:min-h-20`}>
        {/* flex-wrap: 글자를 크게(200%) 키워 한 줄에 안 들어가면 오른쪽 묶음(버튼·☰)이 다음 줄로 내려간다(가로로 넘치지 않게) */}
        {/* 링크 이름은 '이음길 처음 화면'. 보이는 글자 '이음길'이 이름 안에 들어가야 한다(WCAG 2.5.3) — 부제는 장식으로 읽지 않는다 */}
        <Link href="/" className="flex min-h-touch shrink-0 items-center gap-2 sm:gap-3">
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
            {/* 부제: 휴대폰 넓은 쪽(640~767px)과 넓은 PC(1280px~)에서만 — 태블릿·작은 PC는 메뉴 3개 + 버튼이 한 줄에 들어가게 숨긴다 */}
            <span aria-hidden="true" className="hidden text-heading font-medium text-pine sm:inline md:hidden xl:inline">
              즐거운 영동 여행길
            </span>
          </span>
        </Link>

        <div className="ml-auto flex items-center gap-2 lg:gap-4">
          <nav aria-label="주 메뉴" className="hidden md:block">
            <SiteNavLinks items={MENU} variant="bar" />
          </nav>

          {/* 강조 버튼(보령 문화관광 상단 알약 버튼 방식). 시작 화면(히어로 버튼과 겹침)·입력 화면(4단계 [루트 만들기]와 헷갈림)에서는 숨긴다 */}
          <SiteCta />

          <details className="group relative md:hidden">
            <summary className="flex size-touch cursor-pointer list-none items-center justify-center rounded-xl text-ink hover:bg-surface [&::-webkit-details-marker]:hidden">
              <Menu size={24} aria-hidden="true" />
              <span className="sr-only">메뉴 열기</span>
            </summary>
            <nav aria-label="주 메뉴" className="absolute top-full right-0 mt-2 w-56 rounded-2xl border border-line bg-white p-2 shadow-[0_8px_24px_rgb(25_31_40/0.12)]">
              <SiteNavLinks items={MOBILE_MENU} variant="menu" />
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
