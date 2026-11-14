// 시작 화면 (시안: docs/design/Main.dc.html)
// 휴대폰: 한 칸(소개 → 특징 → 아래 버튼). 태블릿: 넓은 한 칸. PC(1024px~): 왼쪽 소개·버튼 + 오른쪽 실제 결과 화면 미리보기.
import Image from "next/image";
import type { ReactNode } from "react";
import { Intro } from "@/components/Intro";
import { TopBar } from "@/components/TopBar";
import { ButtonLink } from "@/components/ui/button";
import { ChatIcon, CheckIcon, DocumentIcon } from "@/components/icons";

const FEATURES: { icon: ReactNode; title: string; body: string }[] = [
  {
    icon: <CheckIcon size={22} />,
    title: "조건을 어기는 곳은 빼요",
    body: "계단, 화장실, 걷는 거리처럼 꼭 필요한 조건을 유형별로 확인해요",
  },
  {
    icon: <DocumentIcon size={22} />,
    title: "판정마다 근거를 보여줘요",
    body: "어디서 확인한 정보인지, 언제 확인했는지 함께 알려드려요",
  },
  {
    icon: <ChatIcon size={22} />,
    title: "AI가 쉬운 말로 정리해요",
    body: "루트와 주의할 점, 챙길 것을 짧게 브리핑해요",
  },
];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-[30rem] flex-1 flex-col md:max-w-[40rem] lg:max-w-[76rem] lg:px-6">
      <Intro />
      <div className="px-6 pt-5 lg:px-0">
        <TopBar />
      </div>

      <div className="flex flex-1 flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_32rem] lg:items-center lg:gap-12 lg:pb-10">
        <div className="flex flex-1 flex-col lg:flex-none">
          <header className="flex animate-rise flex-col gap-[1.125rem] px-6 pt-8 pb-2 lg:px-0">
            <h1 className="text-display font-bold lg:text-[2.75rem] lg:leading-tight">
              휠체어, 어르신, 유모차와
              <br />
              함께 가는 영동 여행
            </h1>
            <p className="text-lead leading-relaxed text-ink-sub lg:max-w-[34rem]">
              강릉·속초·동해 유명 관광지 중 우리 조건에 맞는 곳만 골라, 당일부터 2박 3일까지 지도 위 여행 루트로 짜 드려요.
            </p>
          </header>

          <ul className="flex flex-col gap-3 px-5 pt-6 lg:px-0">
            {FEATURES.map((f, i) => (
              <li
                key={f.title}
                className="flex animate-rise items-start gap-3.5 rounded-2xl bg-surface p-4"
                style={{ animationDelay: `${120 + i * 70}ms` }}
              >
                <span className="flex size-touch shrink-0 items-center justify-center rounded-full bg-white text-primary">
                  {f.icon}
                </span>
                <span className="flex flex-col gap-1">
                  <span className="text-lead font-bold">{f.title}</span>
                  <span className="text-base leading-normal text-ink-sub">{f.body}</span>
                </span>
              </li>
            ))}
          </ul>

          <div className="grow lg:hidden" />

          <div className="flex animate-rise flex-col gap-2.5 px-5 pt-4 pb-7 [animation-delay:340ms] lg:px-0 lg:pt-8 lg:pb-0">
            <div className="flex flex-col gap-2.5 lg:flex-row">
              <ButtonLink href="/plan" className="lg:flex-[3]">
                여행 루트 만들기
              </ButtonLink>
              <ButtonLink href="/trip/example" variant="outline" className="lg:flex-[2]">
                예시 루트 바로 보기
              </ButtonLink>
            </div>
            <p className="mt-1 text-center text-sm text-ink-sub lg:text-left">회원가입 없이 쓸 수 있어요 · 일반 차량 경로 기준</p>
          </div>
        </div>

        <Preview />
      </div>
    </main>
  );
}

/** PC 전용: 실제 결과 화면 캡처 두 장(일정 비교, 확정 일정 지도). scripts/readme/capture.ts가 다시 만든다. */
function Preview() {
  const phone = "absolute w-[15rem] overflow-hidden rounded-[2.25rem] border-[0.5rem] border-ink bg-ink shadow-[0_1.5rem_3rem_rgb(20_80_163/0.18)]";
  return (
    <figure className="relative hidden h-[38rem] animate-rise [animation-delay:200ms] lg:block" aria-label="결과 화면 미리보기">
      <div className="absolute inset-x-6 inset-y-10 rounded-[3rem] bg-primary-soft" aria-hidden="true" />
      <div className={`${phone} top-0 right-2`}>
        <Image
          src="/preview/final.png"
          width={780}
          height={1688}
          sizes="15rem"
          alt="확정한 일정 화면: 카카오 지도에 장소 번호와 일반 차량 경로선, 아래에 시간순 일정"
        />
      </div>
      <div className={`${phone} top-12 left-2`}>
        <Image
          src="/preview/compare.png"
          width={780}
          height={1688}
          sizes="15rem"
          alt="일정 비교 화면: 성격이 다른 일정 안 카드와 장소 수, 이동 시간, 전화로 확인할 곳 수"
        />
      </div>
      <figcaption className="absolute inset-x-0 bottom-0 text-center text-sm text-ink-sub">실제 결과 화면 · 일정 비교와 확정 일정 지도</figcaption>
    </figure>
  );
}
