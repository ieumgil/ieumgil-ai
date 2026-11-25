// 사이트 하단(푸터). 시작 화면에만 둔다(다른 화면은 아래 고정 바가 있음, 11/18 결정):
// 서비스 이름과 한 줄 → 바로가기(소개 글 두 편 · 예시 루트 · 둘러보기 · GitHub) → 데이터 출처 → 만든 곳. 면 규칙 S0(카드·그림자 없이 위쪽 구분선과 회색 면),
// 글자 14·16px, 링크는 터치 44px. 인쇄할 때는 숨긴다.
import Link from "next/link";
import { LogoMark } from "./Logo";
import { SITE_WIDTH } from "./SiteHeader";

const LINKS: { href: string; label: string; external?: boolean }[] = [
  { href: "/about", label: "서비스 소개" },
  { href: "/about/how", label: "작동 원리" },
  { href: "/trip/example", label: "예시 루트" },
  { href: "/places", label: "관광지 둘러보기" },
  { href: "https://github.com/ieumgil/ieumgil-ai", label: "GitHub", external: true },
];

const SOURCES = "한국관광공사 무장애 여행정보 · 행정안전부 공중화장실 표준데이터 · 기상청 예보 · 카카오맵";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-line bg-surface print:hidden" aria-label="사이트 정보">
      <div className={`${SITE_WIDTH} flex flex-col gap-4 py-8`}>
        <div className="flex items-center gap-2">
          <LogoMark size={24} />
          <span className="text-base font-medium">이음길 AI</span>
        </div>
        <p className="text-sm text-ink-sub text-pretty">휠체어, 어르신, 유모차와 함께 가는 영동 여행 루트 플래너</p>

        <nav aria-label="바로가기">
          <ul className="flex flex-wrap gap-x-4">
            {LINKS.map((l) => (
              <li key={l.href}>
                {l.external ? (
                  <a href={l.href} target="_blank" rel="noreferrer" className="inline-flex min-h-touch items-center text-base text-ink underline-offset-4 hover:underline">
                    {l.label}
                    <span className="sr-only"> (새 탭)</span>
                  </a>
                ) : (
                  <Link href={l.href} className="inline-flex min-h-touch items-center text-base text-ink underline-offset-4 hover:underline">
                    {l.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </nav>

        <p className="text-sm text-ink-sub text-pretty">데이터: {SOURCES}</p>
        <p className="text-sm text-ink-sub">© 2026 팀 이음길 · 2026 My AI 랩(강릉과학산업진흥원) 과제</p>
      </div>
    </footer>
  );
}
