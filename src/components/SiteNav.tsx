"use client";

// 사이트 머리줄 메뉴 링크(고칠 목록 5, 11/25). 지금 보는 화면의 메뉴에 aria-current="page" + 밑줄을 단다(주소를 알아야 해서 이 부분만 클라이언트).
import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string };

/** 그 메뉴의 화면에 있는지: /trip/example/final · /about/how처럼 아래 주소도 같은 메뉴로 본다(단 휴대폰 메뉴의 /about은 /about/how와 따로 — 둘 다 있다) */
function isCurrent(pathname: string, href: string, exact: boolean) {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteNavLinks({ items, variant }: { items: NavItem[]; variant: "bar" | "menu" }) {
  const pathname = usePathname() ?? "/";
  return (
    <ul className={variant === "bar" ? "flex items-center gap-1 lg:gap-4" : "flex flex-col"}>
      {items.map((m) => {
        // 휴대폰 메뉴에는 '서비스 소개'(/about)와 '만든 방법'(/about/how)이 같이 있어 정확히 맞을 때만 표시
        const current = isCurrent(pathname, m.href, variant === "menu" && m.href === "/about");
        return (
          <li key={m.href}>
            <Link
              href={m.href}
              aria-current={current ? "page" : undefined}
              className={
                variant === "bar"
                  ? "inline-flex min-h-touch items-center px-3 text-heading text-ink underline-offset-8 hover:underline aria-[current=page]:font-medium aria-[current=page]:text-primary-ink aria-[current=page]:underline aria-[current=page]:decoration-2"
                  : "flex min-h-touch items-center rounded-xl px-3 text-base text-ink hover:bg-surface aria-[current=page]:bg-primary-soft aria-[current=page]:font-medium aria-[current=page]:text-primary-ink"
              }
            >
              {m.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

const FOCUS = "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary";

/** 머리줄 강조 버튼 [여행 루트 만들기](휴대폰 '루트 만들기'). 시작 화면(/)에는 히어로 버튼·아이콘 띠가 있어 숨기고(같은 버튼이 세 번 보였다),
 *  입력 화면(/plan…)에서는 이미 만드는 중이라 숨긴다. 그 밖의 안쪽 화면(둘러보기·결과·확정·소개)에서만 보인다 */
export function SiteCta() {
  const pathname = usePathname() ?? "/";
  if (pathname === "/" || pathname === "/plan" || pathname.startsWith("/plan/")) return null;
  return (
    <Link
      href="/plan"
      className={`press hidden min-h-touch shrink-0 items-center rounded-full bg-primary px-4 text-base font-medium whitespace-nowrap text-white transition-opacity hover:opacity-90 min-[22.5rem]:inline-flex lg:px-6 ${FOCUS}`}
    >
      {/* 한 덩어리로 감싼다: 버튼이 flex라 안쪽 글자 끝 공백이 지워져 '여행루트'로 붙었다 */}
      <span>
        <span className="hidden lg:inline">{"여행 "}</span>루트 만들기
      </span>
    </Link>
  );
}
