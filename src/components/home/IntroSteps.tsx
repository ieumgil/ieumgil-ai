"use client";

// 시작 화면 소개: 단계 설명 + 휴대폰 화면 전환 + 스크롤 고정(11/23).
// 레퍼런스: 강진 문화관광재단 'MOBILITY'(설명 글을 본문보다 크게) · 울진 문화관광 '유튜브속 울진'(가운데 기기 틀 하나, 고르면 속 화면이 바뀜)
//   · 청양 문화관광 '투어패스'(오른쪽 화면 끝까지 찬 연한 면, globals.css .intro-band).
// 넓고 높은 화면(1024px 이상 · 높이 700px 이상): 구역이 화면 높이의 세 배로 길어지고 안쪽 한 화면이 고정(sticky)된 채,
//   스크롤한 만큼 1 → 2 → 3단계가 바뀐다. 단계 번호 사이 세로선은 결과 화면 타임라인과 같은 진행 선·원이고, 지나간 번호는 '클리어'.
//   3단계까지 보면 고정이 풀린다. 단계를 누르면 그 단계 위치로 스크롤한다.
// 좁거나 낮은 화면: 고정 없이 탭으로 고른다(한 화면에 다 들어가지 않음).
// 어느 쪽이든 단계는 탭(role=tab)이라 키보드(←→↑↓)·화면 읽기 프로그램으로 그대로 고를 수 있다.
// 스크롤 위치만 읽어 바꾸므로(시간 애니메이션 아님) 동작 줄이기 설정이어도 사용자가 움직인 만큼만 움직인다.
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ButtonLink } from "@/components/ui/button";
import { useMedia } from "@/lib/use-media";

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

/** 고정해서 단계를 스크롤로 넘기는 화면 조건(globals.css .intro-scroll과 같은 값) */
const PIN = "(min-width: 64rem) and (min-height: 43.75rem)";

export function IntroSteps({ inner }: { inner: string }) {
  const [active, setActive] = useState(0);
  const [scrollP, setScrollP] = useState(0);
  const wrap = useRef<HTMLElement>(null);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  // 단계를 눌러 그 위치로 부드럽게 스크롤하는 동안에는 지나가는 단계로 바뀌지 않게 고른 단계를 붙잡아 둔다
  const lock = useRef<number | null>(null);
  const pinned = useMedia(PIN);
  const n = STEPS.length;
  const list = useRef<HTMLDivElement>(null);
  // 진행 선은 첫 번호 가운데부터 마지막 번호 가운데까지(글자 크기·줄바꿈에 따라 다시 잰다)
  const [line, setLine] = useState<{ top: number; height: number; left: number } | null>(null);
  useEffect(() => {
    const el = list.current;
    if (!el) return;
    const measure = () => {
      const nos = el.querySelectorAll<HTMLElement>(".intro-step__no");
      if (nos.length < 2) return;
      const box = el.getBoundingClientRect();
      const a = nos[0].getBoundingClientRect();
      const b = nos[nos.length - 1].getBoundingClientRect();
      setLine({ top: a.top + a.height / 2 - box.top, height: b.top + b.height / 2 - (a.top + a.height / 2), left: a.left + a.width / 2 - box.left });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 고정 모드: 구역 안에서 스크롤한 비율(0~1) → 단계
  useEffect(() => {
    if (!pinned) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const el = wrap.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const total = r.height - window.innerHeight;
      if (total <= 0) return;
      const p = Math.min(1, Math.max(0, -r.top / total));
      setScrollP(p);
      const at = Math.min(n - 1, Math.floor(p * n));
      if (lock.current === at) lock.current = null;
      if (lock.current === null) setActive(at);
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [pinned, n]);

  // 진행 선: 각 단계 구간의 가운데에서 그 번호에 닿는다(고정이 아니면 고른 단계까지)
  const lineP = pinned ? Math.min(1, Math.max(0, (scrollP * n - 0.5) / (n - 1))) : active / (n - 1);

  const go = (i: number, focus = false) => {
    const to = (i + n) % n;
    setActive(to);
    if (focus) tabs.current[to]?.focus();
    const el = wrap.current;
    if (pinned && el) {
      const top = el.getBoundingClientRect().top + window.scrollY;
      const total = el.offsetHeight - window.innerHeight;
      const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      lock.current = to;
      window.setTimeout(() => {
        if (lock.current === to) lock.current = null; // 도착하지 못해도(스크롤을 멈춤 등) 1.5초 뒤에는 놓는다
      }, 1500);
      window.scrollTo({ top: top + total * ((to + 0.5) / n), behavior: smooth ? "smooth" : "auto" });
    }
  };

  const step = STEPS[active];
  return (
    <section ref={wrap} aria-labelledby="intro-title" className="intro-scroll mt-16 lg:mt-24" data-pinned={pinned ? "" : undefined}>
      <div className="intro-pin intro-band py-12 lg:py-16">
        <span className="intro-band__mark" aria-hidden="true">
          IEUMGIL ROUTE
        </span>
        <div className={inner}>
          <div className="relative z-10 grid items-center gap-12 lg:grid-cols-2">
            <div className="flex flex-col">
              <p className="intro-kicker">이음길은 이렇게 골라요</p>
              <h2 id="intro-title" className="intro-headline font-heading">
                갈 수 있는 곳만
                <br />
                <span className="text-primary">골라 드려요</span>
              </h2>
              <div ref={list} role="tablist" aria-label="이음길이 고르는 방법" aria-orientation="vertical" className="intro-steps mt-8">
                {/* 번호 사이 진행 선·원(결과 화면 타임라인과 같은 모양). 장식이라 읽지 않는다 */}
                <span className="intro-steps__line" aria-hidden="true" style={line ? { top: line.top, height: line.height, left: line.left } : { display: "none" }}>
                  <span className="intro-steps__fill" style={{ height: `${lineP * 100}%` }} />
                  <span className="intro-steps__dot" style={{ top: `${lineP * 100}%` }} />
                </span>
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
                    onClick={() => go(i)}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
                        e.preventDefault();
                        go(i + 1, true);
                      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
                        e.preventDefault();
                        go(i - 1, true);
                      }
                    }}
                    className="intro-step"
                  >
                    <span className="intro-step__no" data-timeline-marker="number" data-passed={lineP >= i / (n - 1) - 0.001 ? "" : undefined} aria-hidden="true">
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
                실제 화면 · {active + 1}/{n} {step.title}
              </figcaption>
            </figure>
          </div>
        </div>
      </div>
    </section>
  );
}
