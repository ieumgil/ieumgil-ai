// 시작 화면 (시안: docs/design/Main.dc.html, 03단계 D-10)
// 휴대폰·태블릿: 한 칸(로고 → 결과 화면 미리보기(아래가 잘린 휴대폰 두 대) → 제목·리드 → 버튼 → 구분선 → 특징 목록).
//   첫 화면 묶음(로고~안내 문구)이 화면 높이(svh)를 채워 특징 목록은 항상 첫 화면 아래에서 시작하고, 주 버튼은 390×844·375×667에서도 첫 화면 안(home.spec이 본다).
// PC(1024px~): 왼쪽 소개·버튼·특징 + 오른쪽 실제 결과 화면 미리보기(잘리지 않은 전체). 진입 움직임은 제목 머리 하나뿐.
import { ChevronRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Intro } from "@/components/Intro";
import { TopBar } from "@/components/TopBar";
import { ButtonLink } from "@/components/ui/button";

const FEATURES: { title: string; body: string }[] = [
  {
    title: "조건을 어기는 곳은 빼요",
    body: "계단, 화장실, 걷는 거리처럼 꼭 필요한 조건을 유형별로 확인해요",
  },
  {
    title: "판단마다 근거를 보여 줘요",
    body: "관광공사 원문 어느 항목을 보고 판단했는지 함께 알려 드려요",
  },
  {
    title: "모르는 건 물어볼 것을 알려 줘요",
    body: "공식 정보가 없는 항목은 숨기지 않고, 출발 전에 전화로 물어볼 질문과 번호를 붙여요",
  },
];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-[30rem] flex-1 flex-col px-4 md:max-w-[40rem] md:px-6 lg:max-w-[76rem] lg:px-8">
      <Intro />

      <div className="flex flex-1 flex-col pb-8 lg:grid lg:grid-cols-[minmax(0,1fr)_32rem] lg:grid-rows-[auto_1fr_auto_auto_auto_1fr] lg:gap-x-12 lg:pb-12">
        {/* 휴대폰·태블릿: 첫 화면(로고 ~ 주 버튼 ~ 안내 문구)이 보이는 높이를 채워 특징 목록이 항상 첫 화면 아래에서 시작한다(svh).
            남는 높이는 미리보기가 먼저 늘고(28rem까지), 그다음 제목·버튼 묶음 위아래 여백으로 나눈다. 모자라면 미리보기가 먼저 줄어든다.
            PC(1024px~)는 contents로 풀어 격자 칸에 바로 놓는다. */}
        <div className="flex min-h-svh flex-col lg:contents">
          <div className="order-1 pt-4 lg:col-span-2 lg:row-start-1">
            <TopBar />
          </div>

          <header className="order-3 mt-auto flex animate-rise flex-col pt-6 lg:col-start-1 lg:row-start-3 lg:mt-0 lg:pt-16">
            <h1 className="font-heading text-title font-bold text-balance">
              휠체어, 어르신, 유모차와
              <br />
              함께 가는 <span className="text-pine">영동 여행</span>
            </h1>
            <p className="mt-2 text-base text-ink-sub text-pretty lg:max-w-[34rem]">
              강릉·속초·동해 관광지 가운데 우리 조건에 맞는 곳만 골라, 당일부터 2박 3일까지 여행 루트를 짜 드려요.
            </p>
          </header>

          <div className="order-4 mt-6 mb-auto flex flex-col gap-2 lg:col-start-1 lg:row-start-4 lg:mb-0">
            <div className="flex flex-col gap-2 lg:flex-row lg:gap-3">
              <ButtonLink href="/plan" className="lg:flex-[3]">
                여행 루트 만들기
              </ButtonLink>
              <ButtonLink href="/trip/example" variant="outline" className="lg:flex-[2]">
                예시 루트 바로 보기
              </ButtonLink>
            </div>
            <Link href="/places" className="mx-auto inline-flex min-h-touch items-center gap-1 px-2 text-base font-bold text-primary underline-offset-4 hover:underline lg:mx-0 lg:px-0">
              어떤 관광지가 있는지 먼저 보기
              <ChevronRight size={18} aria-hidden="true" />
            </Link>
            <p className="text-center text-sm text-ink-sub lg:text-left">회원가입 없이 쓸 수 있어요 · 일반 차량 경로 기준</p>
          </div>

          <Preview />
        </div>

        <ul aria-label="이음길 특징" className="mt-8 border-t border-line lg:col-start-1 lg:row-start-5">
          {FEATURES.map((f) => (
            <li key={f.title} className="flex flex-col gap-1 border-b border-line py-4 last:border-b-0">
              <span className="text-base font-bold">{f.title}</span>
              <span className="text-base text-ink-sub text-pretty">{f.body}</span>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}

/**
 * 실제 결과 화면 캡처 두 장(일정 비교, 확정 일정 지도). scripts/readme/capture.ts가 다시 만든다.
 * 휴대폰·태블릿: 맨 위(order-first)에 작게, 아래쪽을 잘라 높이를 줄인다. PC: 오른쪽 칸에 전체.
 * 누르는 곳이 없는 그림이라 초점을 받지 않는다.
 */
function Preview() {
  const phone =
    "absolute w-[11.5rem] overflow-hidden rounded-3xl border-[0.375rem] border-ink bg-ink shadow-[0_1rem_2rem_rgb(25_31_40/0.12)] md:w-[12rem] lg:w-[15rem] lg:rounded-[2.25rem] lg:border-[0.5rem]";
  return (
    <figure
      className="relative order-2 mx-auto mt-4 min-h-[12rem] w-full max-w-[22rem] flex-1 overflow-hidden max-h-[28rem] md:max-w-[28rem] lg:order-none lg:col-start-2 lg:row-span-5 lg:row-start-2 lg:mt-0 lg:h-[38rem] lg:max-h-none lg:min-h-0 lg:max-w-none lg:flex-none lg:self-center lg:overflow-visible"
      aria-label="결과 화면 미리보기"
    >
      <div className="absolute inset-x-3 top-8 bottom-0 rounded-t-3xl bg-pine-soft lg:inset-x-6 lg:inset-y-10 lg:rounded-[3rem]" aria-hidden="true" />
      <div className={`${phone} top-0 right-0 lg:right-2`}>
        <Image
          src="/preview/final.png"
          width={780}
          height={1688}
          sizes="(min-width: 1024px) 15rem, (min-width: 768px) 12rem, 11.5rem"
          priority
          alt="확정한 일정 화면: 카카오 지도에 장소 번호와 일반 차량 경로선, 아래에 시간순 일정"
        />
      </div>
      <div className={`${phone} top-8 left-0 lg:top-12 lg:left-2`}>
        <Image
          src="/preview/compare.png"
          width={780}
          height={1688}
          sizes="(min-width: 1024px) 15rem, (min-width: 768px) 12rem, 11.5rem"
          priority
          alt="일정 비교 화면: 성격이 다른 일정 안 카드와 장소 수, 이동 시간, 전화로 확인할 곳 수"
        />
      </div>
      <figcaption className="absolute inset-x-0 bottom-0 hidden text-center lg:block text-sm text-ink-sub">실제 결과 화면 · 일정 비교와 확정 일정 지도</figcaption>
    </figure>
  );
}
