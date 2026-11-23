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
import { QuickMenu } from "@/components/home/QuickMenu";
import { SectionTitle } from "@/components/home/SectionTitle";
import { TodayWeather } from "@/components/home/TodayWeather";
import { SITE_WIDTH } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ButtonLink } from "@/components/ui/button";
import { ROUTE_CARDS, type RouteCardId } from "@/lib/trip/route-cards";

// 히어로·바로가기와 겹치는 말(누구와 가는 영동 여행 · 루트를 짜 드림 · 예시 루트 · 관광지 둘러보기)은 뺐다(11/23)
const FEATURES: { title: string; body: string }[] = [
  { title: "조건에 안 맞는 곳은 빼요", body: "계단·화장실·걷는 거리를 유형별로 확인해요" },
  { title: "판단 근거를 함께 보여 줘요", body: "관광공사 원문의 어느 항목인지 알려 드려요" },
  { title: "모르는 건 물어볼 것을 알려 줘요", body: "출발 전에 전화로 물어볼 질문과 번호를 붙여요" },
];

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
        {/* 소개: 레퍼런스 청양 문화관광 '투어패스' 구역 — 왼쪽 글, 오른쪽 화면 끝까지 찬 연한 면(왼쪽 아래만 둥글게) 위에 미리보기 (globals.css .intro-band) */}
        <section aria-labelledby="intro-title" className="intro-band mt-16 py-12 lg:mt-24 lg:py-16">
          <span className="intro-band__mark" aria-hidden="true">
            IEUMGIL ROUTE
          </span>
          <div className={`${SITE_WIDTH} relative z-10 grid items-center gap-12 lg:grid-cols-2`}>
          <div className="flex flex-col lg:max-w-[36rem]">
            <SectionTitle id="intro-title" kicker="이음길은 이렇게 골라요">
              갈 수 있는 곳만 <span className="text-primary">골라 드려요</span>
            </SectionTitle>
            <ul aria-label="이음길 특징" className="mt-6 border-t border-line">
              {FEATURES.map((f) => (
                <li key={f.title} className="flex flex-col gap-1 border-b border-line py-4 last:border-b-0">
                  <span className="text-base font-medium">{f.title}</span>
                  <span className="text-base text-ink-sub text-pretty">{f.body}</span>
                </li>
              ))}
            </ul>
            <ButtonLink href="/plan" className="mt-6 lg:self-start lg:px-12">
              여행 루트 만들기
            </ButtonLink>
            <p className="mt-2 text-sm text-ink-sub">회원가입 없이 쓸 수 있어요 · 일반 차량 경로 기준</p>
          </div>
          <Preview />
          </div>
        </section>

        <Waves />
        <RouteCards />
        <FeaturedPlaces className={`${SITE_WIDTH} pb-16 lg:pb-24`} />
      </main>
      <SiteFooter />
    </>
  );
}

/**
 * 히어로: 어머니 시안의 그림(지도·나침반·언덕·꽃)을 바탕으로 깔고 오른쪽에 진짜 글자를 올린다.
 * [임시] public/mock/hero.webp는 시안에서 글자를 지우고 잘라 낸 그림이다. 지도 일러스트에 스톡 미리보기 워터마크가 있어
 * 저장소에 올리지 않는다(.gitignore). 정식 그림을 구하면 이 파일만 바꾼다.
 */
function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden bg-sky">
      <Image src="/mock/hero.webp" alt="" fill priority sizes="100vw" className="object-cover object-left-bottom" />
      <div className={`${SITE_WIDTH} relative z-10 flex min-h-[28rem] items-center justify-end py-12 lg:min-h-[min(41rem,calc(100svh-19rem))] lg:pt-8 lg:pb-24`}>
        <div className="flex flex-col lg:items-end lg:text-right">
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

/** 결과 화면 캡처 두 장(일정 비교 · 확정 일정 지도). scripts/readme/capture.ts가 다시 만든다. 누르는 곳이 없는 그림 */
function Preview() {
  const phone =
    "absolute w-[11.5rem] overflow-hidden rounded-3xl border-[0.375rem] border-ink bg-ink shadow-[0_1rem_2rem_rgb(25_31_40/0.12)] md:w-[12rem] lg:w-[15rem] xl:w-[17rem] lg:rounded-[2.25rem] lg:border-[0.5rem]";
  return (
    <figure className="relative mx-auto h-[26rem] w-full max-w-[28rem] lg:h-[38rem] lg:max-w-[34rem] xl:h-[42rem] xl:max-w-[38rem]" aria-label="결과 화면 미리보기">
      <div className={`${phone} top-0 right-0 lg:right-2`}>
        <Image src="/preview/final.png" width={780} height={1688} sizes="(min-width: 1280px) 17rem, (min-width: 1024px) 15rem, 12rem" alt="확정한 일정 화면: 카카오 지도에 장소 번호와 일반 차량 경로선, 아래에 시간순 일정" />
      </div>
      <div className={`${phone} top-8 left-0 lg:top-12 lg:left-2`}>
        <Image src="/preview/compare.png" width={780} height={1688} sizes="(min-width: 1280px) 17rem, (min-width: 1024px) 15rem, 12rem" alt="일정 비교 화면: 성격이 다른 일정 안 카드와 장소 수, 이동 시간, 전화로 확인할 곳 수" />
      </div>
      <figcaption className="absolute inset-x-0 bottom-0 text-center text-sm text-ink-sub">실제 결과 화면 · 일정 비교와 확정 일정 지도</figcaption>
    </figure>
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
