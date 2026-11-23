"use client";

// 시작 화면 소개: 단계 설명 + 휴대폰 화면 전환(11/23).
// 레퍼런스: 강진 문화관광재단 'MOBILITY' 구역(설명 글을 본문보다 크게) + 울진 문화관광 '유튜브속 울진'(가운데 기기 틀 하나, 고르면 속 화면이 바뀜).
// 왼쪽 단계 3개는 탭(누르거나 ←→·↑↓ 키로 고름), 오른쪽 휴대폰 목업 속 화면이 그 단계의 실제 화면으로 바뀐다.
// 화면 그림은 scripts/readme/capture.ts가 다시 만든다(public/preview/step-*.png). 움직임 줄이기 설정이면 바뀔 때 전환 없이 바로.
import Image from "next/image";
import { useRef, useState } from "react";
import { ButtonLink } from "@/components/ui/button";

const STEPS = [
  {
    title: "조건에 안 맞는 곳은 빼요",
    body: "계단·화장실·걷는 거리를 함께 가는 사람 기준으로 확인해요",
    img: "/preview/step-conditions.png",
    alt: "꼭 필요한 조건 화면: 휠체어를 고르면 계단·단차 없는 진입, 엘리베이터, 급한 경사 없음, 포장길, 장애인 화장실이 켜진다",
  },
  {
    title: "왜 골랐는지와 출처를 보여 줘요",
    body: "장소마다 판단과 한 줄 이유, 관광공사 출처를 붙여요",
    img: "/preview/step-card.png",
    alt: "장소 카드: 도착 시각, 적합 판단, 고른 이유 한 줄, 전화, 자세히를 펼친 도착하면 안내",
  },
  {
    title: "모르는 건 물어볼 것을 알려 줘요",
    body: "출발 전에 전화로 물어볼 질문과 공식 번호를 붙여요",
    img: "/preview/step-call.png",
    alt: "출발 전 전화로 확인할 곳: 장소마다 물어볼 것과 전화번호, 괜찮대요·어렵대요 버튼",
  },
];

export function IntroSteps() {
  const [active, setActive] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const move = (to: number) => {
    const n = (to + STEPS.length) % STEPS.length;
    setActive(n);
    tabs.current[n]?.focus();
  };
  const step = STEPS[active];
  return (
    <div className="relative z-10 grid items-center gap-12 lg:grid-cols-2">
      <div className="flex flex-col">
        <p className="intro-kicker">이음길은 이렇게 골라요</p>
        <h2 id="intro-title" className="intro-headline font-heading">
          갈 수 있는 곳만
          <br />
          <span className="text-primary">골라 드려요</span>
        </h2>
        <div role="tablist" aria-label="이음길이 고르는 방법" aria-orientation="vertical" className="mt-8 flex flex-col gap-3">
          {STEPS.map((s, i) => (
            <button
              key={s.title}
              ref={(el) => {
                tabs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`intro-tab-${i}`}
              aria-selected={active === i}
              aria-controls="intro-panel"
              tabIndex={active === i ? 0 : -1}
              onClick={() => setActive(i)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown" || e.key === "ArrowRight") {
                  e.preventDefault();
                  move(i + 1);
                } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
                  e.preventDefault();
                  move(i - 1);
                }
              }}
              className="intro-step"
            >
              <span className="intro-step__no" aria-hidden="true">
                {i + 1}
              </span>
              <span className="flex min-w-0 flex-col gap-1 text-left">
                <span className="intro-step__title">{s.title}</span>
                <span className="intro-step__body">{s.body}</span>
              </span>
            </button>
          ))}
        </div>
        <ButtonLink href="/plan" className="intro-cta mt-8 lg:self-start">
          여행 루트 만들기
        </ButtonLink>
        <p className="mt-3 text-base text-ink-sub">회원가입 없이 쓸 수 있어요 · 일반 차량 경로 기준</p>
      </div>

      <figure aria-label="결과 화면 미리보기" className="mx-auto flex w-full flex-col items-center">
        <div id="intro-panel" role="tabpanel" aria-labelledby={`intro-tab-${active}`} className="intro-phone">
          <Image key={step.img} src={step.img} width={780} height={1688} sizes="(min-width: 1280px) 20rem, (min-width: 1024px) 17rem, 15rem" alt={step.alt} className="intro-phone__screen" />
        </div>
        <figcaption className="mt-4 text-base text-ink-sub">
          실제 화면 · {active + 1}/{STEPS.length} {step.title}
        </figcaption>
      </figure>
    </div>
  );
}
