// 시작 화면(11/23 디자인 시안, PC 먼저 — 모바일은 다음 단계에서 보수).
// 위에서 아래로: [사이트 머리줄(layout)] → 히어로(11/27 새 시안: 사진 카드 4장 + 잘난체 고딕 문구 상자, components/home/HomeHero.tsx)
//   → 바로가기 5칸(11/27 새 시안) → 소개(제목 · 버튼 · 특징 · 결과 화면 미리보기) → 물결 리본 띠 → 루트 카드 3장(함께 가는 사람 × 도시, 누르면 그 안 하나만)
//   → 대표 관광지 사진 줄 → 바닥글. 레퍼런스: 웹쟁이 '관광' 검색 10곳(강진·청양·강릉·울진·공주·보령 등)의 공통 구성.
// 레퍼런스: 물결은 소곳소곳 김포(sgsg.gcf.or.kr), 카드는 예당관광지 캠핑장(camping.yesan.go.kr). 레퍼런스 그림 파일은 가져오지 않고 물결은 우리 색으로 새로 그렸다.
// 머리줄·히어로 글·카드·바닥글이 같은 폭(SITE_WIDTH, 내용 1360px)과 같은 좌우 끝을 쓴다.
import Image from "next/image";
import Link from "next/link";
import { Intro } from "@/components/Intro";
import { RevealOnScroll } from "@/components/Motion";
import { FeaturedPlaces } from "@/components/home/FeaturedPlaces";
import { HomeHero } from "@/components/home/HomeHero";
import { IntroSteps } from "@/components/home/IntroSteps";
import { QuickMenu } from "@/components/home/QuickMenu";
import { SectionTitle } from "@/components/home/SectionTitle";
import { SITE_WIDTH } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import type { CSSProperties } from "react";
import { ROUTE_CARDS, type RouteCardId } from "@/lib/trip/route-cards";
import routePhotos from "../../data/route-photos.json";



// 카드 글 상자 색(11/24 사용자 지정): 파랑 #3580db · 초록 #3daa7e · 갈색 #d5875a
const CARD_BG: Record<RouteCardId, string> = { wheelchair: "bg-card-blue", elder: "bg-card-green", stroller: "bg-card-brown" };

export default function Home() {
  return (
    <>
      <main className="flex w-full flex-1 flex-col">
        <Intro />
        {/* 스크롤 등장(11/24): 바로가기 · 물결 · 루트 카드 · 대표 관광지. 화면 고정 스크롤인 단계 소개는 빼고 */}
        <RevealOnScroll />
        <HomeHero />
        <QuickMenu inner={SITE_WIDTH} />

        {/* 소개: 제목 · 버튼 · 특징 + 결과 화면 미리보기 */}
        {/* 소개: 단계 설명 + 휴대폰 화면 전환, 넓은 화면에서는 스크롤 고정으로 1→3단계(components/home/IntroSteps.tsx) */}
        <IntroSteps inner={SITE_WIDTH} />

        <Waves />
        <RouteCards />
        <FeaturedPlaces className={`${SITE_WIDTH} pb-16 lg:pb-24`} />
      </main>
      <SiteFooter />
    </>
  );
}

/**
 * 물결 리본 띠(레퍼런스 소곳소곳 김포의 bg_map_section_line과 같은 생각: '길'을 뜻하는 반투명 리본 두 줄).
 * 소개 구역과 루트 카드 사이에 깔고, 화면 끝까지 늘어난다.
 */
function Waves() {
  return (
    <div className="pointer-events-none my-8 h-32 w-full lg:my-12 lg:h-44" aria-hidden="true" data-reveal="">
      <svg viewBox="0 0 1920 220" preserveAspectRatio="none" className="h-full w-full">
        <path d="M0 70 C160 60 220 110 380 95 C560 78 640 40 820 48 C1000 56 1120 110 1320 100 C1520 90 1640 40 1920 60 L1920 92 C1640 76 1520 128 1320 136 C1120 144 1000 92 820 84 C640 76 560 112 380 130 C220 146 160 96 0 104 Z" fill="#9ed2e6" opacity="0.45" />
        <path d="M0 150 C200 160 320 110 520 100 C720 90 820 140 1020 132 C1240 122 1380 60 1600 40 C1720 30 1800 20 1920 30 L1920 58 C1800 50 1720 62 1600 74 C1380 96 1240 160 1020 170 C820 178 720 128 520 138 C320 148 200 196 0 186 Z" fill="#f4b8c8" opacity="0.4" />
      </svg>
    </div>
  );
}

/**
 * 루트 카드 3장(레퍼런스: 예당관광지 캠핑장 카드 — 큰 사진 + 색 바탕 글 상자, 마우스를 올리면 30px 떠오르고(0.3초) 오른쪽 위에 '루트 보기' 딱지).
 * 움직임 줄이기 설정이면 전역 규칙(globals.css)이 전환 시간을 없애 바로 올라간다.
 * 카드마다 함께 가는 사람 × 도시가 다르고, 누르면 미리 만든 그 루트 하나만 열린다(/trip/route-…, 안 비교 없음).
 */
function RouteCards() {
  return (
    <section aria-labelledby="routes-title" className={`${SITE_WIDTH} pb-16 lg:pb-24`}>
      <div data-reveal="">
        <SectionTitle id="routes-title" kicker="함께 가는 사람별 예시 루트">
          누구와 함께 가세요? <br className="sm:hidden" />
          <span className="whitespace-nowrap text-primary">꼭 맞는 루트</span>를 바로 열어 보세요
        </SectionTitle>
      </div>
      {/* 떠오른 카드가 제목에 닿지 않게 위 여백을 둔다. 카드 모양은 globals.css .route-card(레퍼런스 예당 캠핑장 CSS) */}
      <ul className="route-cards mt-6 pt-8">
        {ROUTE_CARDS.map((c, i) => (
          // 등장 움직임은 li에, 마우스를 올렸을 때 떠오르는 움직임은 안쪽 카드(.route-card)에 — 둘이 섞이지 않게
          <li key={c.id} data-reveal="" style={{ "--reveal-i": i + 1 } as CSSProperties}>
            <Link href={`/trip/route-${c.id}`} className="route-card">
              <span className="route-card__badge" aria-hidden="true">
                루트 보기
              </span>
              <span className="route-card__thumb">
                <Image src={c.photo} alt="" fill sizes="(min-width: 1024px) 30vw, 190px" className="object-cover" />
              </span>
              <span className={`route-card__info ${CARD_BG[c.id]}`}>
                <span className="route-card__sub">
                  {c.who} · {c.where}
                </span>
                <h3 className="route-card__title text-balance">{c.line}</h3>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {/* 사진 출처: 경포해수욕장·청초호는 한국관광공사, 유모차 카드는 고화질 사진(data/route-photos.json). 공공누리 제1유형은 출처 표시 필수 */}
      <p className="mt-4 text-sm text-ink-sub">
        실제 AI가 미리 만든 예시 루트예요 · 사진: 경포해수욕장 · 청초호 한국관광공사(공공누리 제1유형) ·{" "}
        {routePhotos.photos.map((p) => `${p.place} ${p.author}(${p.license}, ${routePhotos.changes})`).join(" · ")}
      </p>
    </section>
  );
}
