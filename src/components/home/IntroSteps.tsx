"use client";

// 시작 화면 소개: 단계 설명 + 휴대폰 화면 전환 + 스크롤 고정(11/23).
// 레퍼런스: 강진 문화관광재단 'MOBILITY'(설명 글을 본문보다 크게) · 울진 문화관광 '유튜브속 울진'(가운데 기기 틀 하나, 고르면 속 화면이 바뀜)
//   · 청양 문화관광 '투어패스'(오른쪽 화면 끝까지 찬 연한 면, globals.css .intro-band).
// 넓고 높은 화면(1024px 이상 · 높이 700px 이상): 구역이 화면 높이의 세 배로 길어지고 안쪽 한 화면이 고정(sticky)된 채,
//   스크롤한 만큼 1 → 2 → 3단계가 바뀐다. 단계 번호 사이 세로선은 결과 화면 타임라인과 같은 진행 선·원이고, 지나간 번호는 '클리어'.
//   3단계까지 보면 고정이 풀린다. 단계를 누르면 그 단계 위치로 스크롤한다.
// 좁거나 낮은 화면: 고정 없이 탭으로 고른다(한 화면에 다 들어가지 않음). 스크롤하면 단계 목록이 화면 위로 지나가 버리므로
//   휴대폰 화면이 보이는 동안 3초마다 자동으로 다음 단계로 넘긴다(고칠 목록 2, 11/24). 움직이는 내용이라 [멈추기]가 있고(WCAG 2.2.2),
//   단계를 직접 고르면 멈추며, 동작 줄이기 설정이면 멈춘 채로 시작한다. 화면 밖이면 넘기지 않는다.
//   한 칸 화면(1024px 미만)에서는 왼쪽 단계 목록 대신 휴대폰 바로 아래에 막대 탭 3칸 + 지금 단계 카드를 둬서 화면과 단계가 함께 보이고 함께 바뀐다.
// 어느 쪽이든 단계는 탭(role=tab)이라 키보드(←→↑↓)·화면 읽기 프로그램으로 그대로 고를 수 있다.
// 고정 모드는 스크롤 위치만 읽어 바꾸므로(시간 애니메이션 아님) 동작 줄이기 설정이어도 사용자가 움직인 만큼만 움직인다.
import Image from "next/image";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
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
/** 좁은 화면 자동 넘김 간격(globals.css .intro-progress 채움 시간과 같은 값) */
const AUTO_MS = 3000;

export function IntroSteps({ inner }: { inner: string }) {
  const [active, setActive] = useState(0);
  const [scrollP, setScrollP] = useState(0);
  const wrap = useRef<HTMLElement>(null);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const mtabs = useRef<(HTMLButtonElement | null)[]>([]);
  // 단계를 눌러 그 위치로 부드럽게 스크롤하는 동안에는 지나가는 단계로 바뀌지 않게 고른 단계를 붙잡아 둔다
  const lock = useRef<number | null>(null);
  const pinned = useMedia(PIN);
  const n = STEPS.length;
  const list = useRef<HTMLDivElement>(null);
  // 좁은 화면 자동 넘김: 사용자가 정하기 전에는 동작 줄이기 설정을 따른다(켜져 있으면 멈춘 채로)
  const reduce = useMedia("(prefers-reduced-motion: reduce)");
  const [autoChoice, setAutoChoice] = useState<boolean | null>(null);
  const auto = autoChoice ?? !reduce;
  const phone = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const running = !pinned && auto && inView;
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

  // 좁은 화면: 휴대폰 화면·단계 카드 묶음이 반 넘게 보일 때만 센다
  useEffect(() => {
    const el = phone.current;
    if (pinned || !el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
  }, [pinned]);

  // 좁은 화면 자동 넘김: 단계가 바뀔 때마다 3초를 새로 센다
  useEffect(() => {
    if (!running) return;
    const t = window.setTimeout(() => setActive((a) => (a + 1) % n), AUTO_MS);
    return () => window.clearTimeout(t);
  }, [running, active, n]);

  // 진행 선: 각 단계 구간의 가운데에서 그 번호에 닿는다(고정이 아니면 고른 단계까지)
  const lineP = pinned ? Math.min(1, Math.max(0, (scrollP * n - 0.5) / (n - 1))) : active / (n - 1);

  const go = (i: number, focus = false) => {
    const to = (i + n) % n;
    setActive(to);
    if (!pinned) setAutoChoice(false); // 직접 고르면 그 단계에 머문다
    if (focus) {
      // 보이는 쪽 탭에 초점(좁은 화면은 휴대폰 아래 막대 탭, 넓은 화면은 왼쪽 단계 목록)
      const m = mtabs.current[to];
      (m && m.offsetParent !== null ? m : tabs.current[to])?.focus();
    }
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

  // 화살표로 앞뒤 단계(두 탭 목록 공통)
  const onKey = (i: number) => (e: KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault();
      go(i + 1, true);
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault();
      go(i - 1, true);
    }
  };

  // 자동 넘김 진행 막대의 한 칸: 지난 칸은 꽉 차고, 지금 칸은 3초 동안 차오른다(멈추면 꽉 찬 채로)
  const seg = (i: number) => (
    <span className="intro-progress__seg" data-done={i < active ? "" : undefined}>
      {i === active && <span key={`${active}-${running}`} className="intro-progress__fill" />}
    </span>
  );

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
              {/* 넓은 화면(두 칸): 왼쪽 단계 목록. 한 칸 화면에서는 휴대폰 아래 막대 탭 + 지금 단계 카드가 대신한다 */}
              <div ref={list} role="tablist" aria-label="이음길이 고르는 방법" aria-orientation="vertical" className="intro-steps intro-steps--wide mt-8">
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
                    onKeyDown={onKey(i)}
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

            <div ref={phone} className="flex flex-col items-center">
              {/* 미리보기(figure) 안에는 누르는 곳을 두지 않는다 — 단계 막대 탭·자동 넘김 버튼은 그 바로 아래 */}
              <figure aria-label="결과 화면 미리보기" className="mx-auto flex w-full flex-col items-center">
                <div id="intro-panel" role="tabpanel" aria-labelledby={`intro-tab-${active}`} className="intro-phone">
                  {/* 상태 줄(장식): 시계 · 신호 · 배터리. 가운데 카메라 알약은 CSS(::after) */}
                  <div className="intro-phone__status" aria-hidden="true">
                    <span>9:41</span>
                    <span className="intro-phone__icons">
                      <svg viewBox="0 0 17 11" fill="currentColor">
                        <rect x="0" y="7" width="3" height="4" rx="0.8" />
                        <rect x="4.5" y="5" width="3" height="6" rx="0.8" />
                        <rect x="9" y="2.5" width="3" height="8.5" rx="0.8" />
                        <rect x="13.5" y="0" width="3" height="11" rx="0.8" />
                      </svg>
                      <svg viewBox="0 0 25 12" fill="none">
                        <rect x="0.5" y="0.5" width="21" height="11" rx="3" stroke="currentColor" opacity="0.4" />
                        <rect x="2" y="2" width="18" height="8" rx="1.8" fill="currentColor" />
                        <rect x="23" y="4" width="1.6" height="4" rx="0.8" fill="currentColor" opacity="0.4" />
                      </svg>
                    </span>
                  </div>
                  <Image key={step.img} src={step.img} width={780} height={1688} sizes="(min-width: 1280px) 20rem, (min-width: 1024px) 17rem, 15rem" alt={step.alt} className="intro-phone__screen" />
                </div>
                {!pinned && (
                  // 넓지만 낮은 화면(두 칸, 고정 안 함): 진행 막대는 장식 — 단계는 왼쪽 목록에서 고른다
                  <div className="intro-progress intro-progress--wide mt-4" aria-hidden="true" data-running={running ? "" : undefined}>
                    {STEPS.map((s, i) => (
                      <span key={s.title} className="contents">
                        {seg(i)}
                      </span>
                    ))}
                  </div>
                )}
                <figcaption className="mt-3 text-base text-ink-sub max-lg:sr-only">
                  실제 화면 · {active + 1}/{n} {step.title}
                </figcaption>
              </figure>

              {/* 한 칸 화면(휴대폰·태블릿): 휴대폰 바로 아래 막대 탭(누르면 그 단계) + 지금 단계 카드가 화면과 함께 바뀐다(고칠 목록 2, 11/24) */}
              <div className="mt-4 flex w-full flex-col items-center lg:hidden">
                <div role="tablist" aria-label="이음길이 고르는 방법" className="intro-progress intro-progress--tabs" data-running={running ? "" : undefined}>
                  {STEPS.map((s, i) => (
                    <button
                      key={s.title}
                      ref={(el) => {
                        mtabs.current[i] = el;
                      }}
                      type="button"
                      role="tab"
                      id={`intro-mtab-${i}`}
                      aria-selected={active === i}
                      aria-controls="intro-panel"
                      tabIndex={active === i ? 0 : -1}
                      onClick={() => go(i)}
                      onKeyDown={onKey(i)}
                      className="intro-progress__tab"
                    >
                      {seg(i)}
                      <span className="sr-only">
                        {i + 1}단계 {s.title}. {s.body}
                      </span>
                    </button>
                  ))}
                </div>
                {/* 지금 단계 카드(넓은 화면의 고른 단계와 같은 모양). 같은 글을 막대 탭이 이미 읽어 주므로 화면 읽기에서는 뺀다 */}
                <div key={active} className="intro-step intro-mstep" aria-hidden="true">
                  <span className="intro-step__no">{active + 1}</span>
                  <span className="flex min-w-0 flex-col gap-1 text-left">
                    <span className="intro-step__title">{step.title}</span>
                    <span className="intro-step__body">{step.body}</span>
                  </span>
                </div>
              </div>
              {!pinned && (
                <button
                  type="button"
                  onClick={() => setAutoChoice(!auto)}
                  className="press mt-2 inline-flex min-h-touch items-center gap-2 rounded-full px-4 text-base font-medium text-primary-ink"
                >
                  <span aria-hidden="true">{auto ? "❚❚" : "▶"}</span>
                  {auto ? "자동 넘김 멈추기" : "자동으로 넘기기"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
