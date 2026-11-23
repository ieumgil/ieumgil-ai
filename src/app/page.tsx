// 시작 화면(11/23 어머니 시안, PC 먼저 — 모바일은 다음 단계에서 보수).
// 위에서 아래로: [사이트 머리줄(layout)] → 히어로(시안 그림 바탕 · 오른쪽 숑숑 문구)
//   → 바로가기 줄 → 소개(제목 · 버튼 · 특징 · 결과 화면 미리보기) → 물결 리본 띠 → 루트 카드 3장(함께 가는 사람 × 도시, 누르면 그 안 하나만)
//   → 대표 관광지 사진 줄 → 바닥글. 레퍼런스: 웹쟁이 '관광' 검색 10곳(강진·청양·강릉·울진·공주·보령 등)의 공통 구성.
// 레퍼런스: 히어로·물결은 소곳소곳 김포(sgsg.gcf.or.kr), 카드는 예당관광지 캠핑장(camping.yesan.go.kr). 레퍼런스 그림 파일은 가져오지 않고 물결은 우리 색으로 새로 그렸다.
// 머리줄·히어로 글·카드·바닥글이 같은 폭(SITE_WIDTH, 내용 1360px)과 같은 좌우 끝을 쓴다.
import Image from "next/image";
import Link from "next/link";
import { Intro } from "@/components/Intro";
import { FeaturedPlaces } from "@/components/home/FeaturedPlaces";
import { IntroSteps } from "@/components/home/IntroSteps";
import { QuickMenu } from "@/components/home/QuickMenu";
import { SectionTitle } from "@/components/home/SectionTitle";
import { TodayWeather } from "@/components/home/TodayWeather";
import { SITE_WIDTH } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ROUTE_CARDS, type RouteCardId } from "@/lib/trip/route-cards";



// 카드 글 상자 색(흰 글자 대비 4.5:1 이상): 파랑 · 솔숲 초록 · 진한 주황
const CARD_BG: Record<RouteCardId, string> = { wheelchair: "bg-primary", elder: "bg-pine", stroller: "bg-route-deep" };

export default function Home() {
  return (
    <>
      <main className="flex w-full flex-1 flex-col">
        <Intro />
        <Hero />
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
 * 히어로(11/23 어머니 시안): 그림 세 겹 위에 진짜 글자를 올린다(그림은 모두 장식이라 읽지 않는다).
 *   맨 뒤 하늘·언덕 배경(public/hero/sky-hills.webp) → 왼쪽 강원 지도(gangwon-map.svg) → 오른쪽 아래 꽃덤불(bush-corner.svg) → 오른쪽 숑숑 문구.
 * 그림은 사용자가 직접 만든 파일이라 저장소에 함께 올린다(예전 시안 잘라 쓰기·스톡 워터마크 문제 없음).
 */
function Hero() {
  return (
    <section aria-labelledby="hero-title" className="hero-scene relative overflow-hidden bg-sky">
      <Image src="/hero/sky-hills.webp" alt="" fill priority sizes="100vw" className="object-cover object-bottom" />
      {/* eslint-disable-next-line @next/next/no-img-element -- 장식 SVG(크기 조절만, 최적화 불필요) */}
      <img src="/hero/bush-corner.svg" alt="" aria-hidden="true" className="hero-scene__bush" />
      <div className={`${SITE_WIDTH} relative z-10 grid items-center gap-6 pt-10 pb-28 lg:min-h-[min(41rem,calc(100svh-19rem))] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:py-8`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- 장식 SVG */}
        <img src="/hero/gangwon-map.svg" alt="" aria-hidden="true" className="hero-scene__map" />
        <div className="relative z-10 flex flex-col lg:items-end lg:pb-24 lg:text-right">
          <p className="text-heading text-ink">휠체어, 어르신, 유모차와 함께 가는 영동</p>
          <h1 id="hero-title" className="mt-4 font-hero text-hero font-normal">
            <span className="block text-primary-ink">지도로 찾아가는</span>{" "}
            <span className="block text-pine">즐거운 영동 여행길</span>
          </h1>
          <p className="mt-6 text-heading text-ink-sub text-pretty lg:max-w-[30rem]">강릉·속초·동해 관광지 가운데 우리 조건에 맞는 곳만 골라 당일부터 2박 3일까지 여행 루트를 짜 드려요.</p>
          <div className="mt-6">
            <TodayWeather />
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * 물결 리본 띠(레퍼런스 소곳소곳 김포의 bg_map_section_line과 같은 생각: '길'을 뜻하는 반투명 리본 두 줄).
 * 소개 구역과 루트 카드 사이에 깔고, 화면 끝까지 늘어난다.
 */
function Waves() {
  return (
    <div className="pointer-events-none my-8 h-32 w-full lg:my-12 lg:h-44" aria-hidden="true">
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
      <SectionTitle id="routes-title" kicker="함께 가는 사람별 예시 루트">
        누구와 <span className="text-primary">가세요?</span>
      </SectionTitle>
      {/* 떠오른 카드가 제목에 닿지 않게 위 여백을 둔다. 카드 모양은 globals.css .route-card(레퍼런스 예당 캠핑장 CSS) */}
      <ul className="route-cards mt-6 pt-8">
        {ROUTE_CARDS.map((c) => (
          <li key={c.id}>
            <Link href={`/trip/route-${c.id}`} className="route-card">
              <span className="route-card__badge" aria-hidden="true">
                루트 보기
              </span>
              <span className="route-card__thumb">
                <Image src={`/photos/${c.photoPlace}.webp`} alt="" fill sizes="(min-width: 1024px) 30vw, 190px" className="object-cover" />
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
      <p className="mt-4 text-sm text-ink-sub">실제 AI가 미리 만든 예시 루트예요 · 사진: 한국관광공사(공공누리 제1유형)</p>
    </section>
  );
}
