// 소개 글 두 편(/about 서비스 소개, /about/how 작동 원리)이 같이 쓰는 틀.
// 휴대폰·태블릿: 한 칸, 글 폭 40rem(한 줄 약 38자). PC(1024px~): 사이트 폭(SITE_WIDTH)을 쓰고
//   머리 = 왼쪽 제목·소개 + 오른쪽 그림, 본문 = 왼쪽 차례(지금 읽는 구역 표시) + 오른쪽 본문(문단은 42rem, 목록은 두 칸, 그림은 넓게).
// 면 규칙 S0(카드·그림자 없이 간격과 구분선). 제목은 h1·h2만 700, 본문 16px, 구역 사이 32px(PC 48px).
// 구역·그림·숫자는 스크롤해서 화면에 들어올 때 나타난다([data-reveal], Motion.tsx).
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { CountUp, RevealOnScroll } from "@/components/Motion";
import { Toc, type TocItem } from "@/components/about/Toc";
import { SITE_WIDTH } from "@/components/SiteHeader";
import { ButtonLink } from "@/components/ui/button";

/** 페이지가 구역 제목을 한곳에 적어 두고 차례와 구역이 함께 쓴다: { who: "이런 분을 위해…" } → [{ id: "who", title }] */
export function tocOf(titles: Record<string, string>): TocItem[] {
  return Object.entries(titles).map(([id, title]) => ({ id, title }));
}

export function Article({
  title,
  lead,
  hero,
  toc,
  children,
  next,
}: {
  title: string;
  lead: string;
  hero?: ReactNode;
  toc: TocItem[];
  children: ReactNode;
  next: { href: string; label: string; body: string };
}) {
  return (
    <main className="flex w-full flex-1 flex-col pb-12 lg:pb-16">
      {/* 머리 띠(11/25, 단계 4): 내부 화면 공용 .page-band(하늘색이 아래로 흐려짐). 오른쪽 그림이 있으면 무늬는 끈다(data-aside) */}
      <header className="page-band w-full print:hidden" data-aside={hero ? "" : undefined}>
        <div className={`${SITE_WIDTH} pt-8 pb-6 lg:pt-12 lg:pb-8`}>
        <div className={`mx-auto flex max-w-[30rem] flex-col gap-6 md:max-w-[40rem] lg:mx-0 lg:max-w-none lg:grid lg:items-center lg:gap-16 ${hero ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)]" : ""}`}>
          <div className="flex flex-col gap-2 lg:max-w-[42rem]">
            <h1 className="font-heading text-title font-bold text-balance">{title}</h1>
            <p className="text-base text-ink-sub text-pretty">{lead}</p>
          </div>
          {hero}
        </div>
        </div>
      </header>

      <div className={`${SITE_WIDTH} mt-2 lg:mt-4 lg:grid lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-16`}>
        <Toc items={toc} />
        <div className="mx-auto flex w-full min-w-0 max-w-[30rem] flex-col md:max-w-[40rem] lg:mx-0 lg:max-w-[62rem]">
          <div className="flex flex-col gap-8 lg:gap-12">{children}</div>

          <footer className="mt-12 flex flex-col gap-4 border-t border-line pt-8" data-reveal="">
            <div className="flex flex-col gap-2 lg:max-w-[42rem] lg:flex-row lg:gap-3">
              <ButtonLink href="/plan" className="lg:flex-[3]">
                여행 루트 만들기
              </ButtonLink>
              <ButtonLink href="/trip/example" variant="outline" className="lg:flex-[2]">
                예시 루트 바로 보기
              </ButtonLink>
            </div>
            <Link href={next.href} className="flex min-h-touch flex-col justify-center gap-1 rounded-2xl border border-line px-4 py-3 hover:bg-surface lg:max-w-[42rem]">
              <span className="text-base font-medium text-primary">{next.label} →</span>
              <span className="text-sm text-ink-sub text-pretty">{next.body}</span>
            </Link>
          </footer>
        </div>
      </div>
      <RevealOnScroll />
    </main>
  );
}

/** 구역. aside(휴대폰 화면 한 장 등)를 주면 PC에서는 글 오른쪽에 붙고, 휴대폰에서는 글 아래에 온다 */
export function Section({ id, title, aside, children }: { id: string; title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-8 flex flex-col gap-3" data-reveal="">
      <h2 id={`${id}-title`} className="font-heading text-heading font-bold text-balance">
        {title}
      </h2>
      {aside ? (
        <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_14rem] lg:items-start lg:gap-12">
          <div className="flex min-w-0 flex-col gap-3">{children}</div>
          <div className="lg:sticky lg:top-8">{aside}</div>
        </div>
      ) : (
        children
      )}
    </section>
  );
}

/** 본문 문단. PC에서도 한 줄이 너무 길지 않게 42rem */
export function P({ children }: { children: ReactNode }) {
  return <p className="text-base text-pretty lg:max-w-[42rem]">{children}</p>;
}

/** 점 목록: 항목마다 굵은 머리말 + 설명. PC는 두 칸 */
export function Points({ items }: { items: { head: string; body: ReactNode }[] }) {
  return (
    <ul className="flex flex-col border-t border-line lg:grid lg:grid-cols-2 lg:gap-x-8 lg:border-t-0">
      {items.map((it, i) => (
        <li key={it.head} className="flex flex-col gap-1 border-b border-line py-3 lg:border-t lg:border-b-0 lg:py-4" data-reveal="" style={{ "--reveal-i": i % 2 } as CSSProperties}>
          <span className="text-base font-medium">{it.head}</span>
          <span className="text-base text-ink-sub text-pretty">{it.body}</span>
        </li>
      ))}
    </ul>
  );
}

/** 순서 목록: 번호 + 굵은 머리말 + 설명. PC는 두 칸(1 2 / 3 4 / 5) */
export function Steps({ items }: { items: { head: string; body: ReactNode }[] }) {
  return (
    <ol className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:gap-x-8 lg:gap-y-6">
      {items.map((it, i) => (
        <li key={it.head} className="flex gap-3" data-reveal="" style={{ "--reveal-i": i % 2 } as CSSProperties}>
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-base font-medium text-primary-ink">
            {i + 1}
          </span>
          <div className="flex min-w-0 flex-col gap-1 pt-1">
            <span className="text-base font-medium">{it.head}</span>
            <span className="text-base text-ink-sub text-pretty">{it.body}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** 숫자 목록: 휴대폰은 한 줄씩, PC는 세 칸. 값은 화면에 들어올 때 0부터 올라간다 */
export function Numbers({ items }: { items: { label: string; value: string; note: string }[] }) {
  return (
    <dl className="flex flex-col border-t border-line md:grid md:grid-cols-2 md:gap-x-8 md:border-t-0 lg:grid-cols-3">
      {items.map((n, i) => (
        <div key={n.label} className="flex flex-col gap-1 border-b border-line py-3 md:border-t md:border-b-0 md:py-4" data-reveal="" style={{ "--reveal-i": i % 3 } as CSSProperties}>
          <dt className="text-base text-ink-sub text-pretty">{n.label}</dt>
          <dd className="flex flex-col">
            <CountUp value={n.value} className="text-title font-medium text-primary-ink" />
            <span className="text-sm text-ink-sub text-pretty">{n.note}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}
