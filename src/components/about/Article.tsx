// 소개 글 두 편(/about 서비스 소개, /about/how 만든 방법)이 같이 쓰는 틀.
// 읽는 화면이라 글 폭을 40rem으로 묶고(한 줄 약 38자), 면 규칙 S0(카드·그림자 없이 간격과 구분선)만 쓴다.
// 제목 글꼴(고운바탕)은 h1·h2에만, 본문은 16px, 구역 사이 32px(PC 48px).
import Link from "next/link";
import type { ReactNode } from "react";
import { TopBar } from "@/components/TopBar";
import { ButtonLink } from "@/components/ui/button";

export function Article({ title, lead, hero, children, next }: { title: string; lead: string; hero?: ReactNode; children: ReactNode; next: { href: string; label: string; body: string } }) {
  return (
    <main className="mx-auto flex w-full max-w-[30rem] flex-1 flex-col px-4 pb-12 md:max-w-[40rem] md:px-6 lg:pb-16">
      <div className="pt-4">
        <TopBar />
      </div>

      <header className="flex flex-col gap-2 pt-8 lg:pt-12">
        <h1 className="font-heading text-title font-bold text-balance">{title}</h1>
        <p className="text-base text-ink-sub text-pretty">{lead}</p>
      </header>
      {hero && <div className="mt-6">{hero}</div>}

      <div className="mt-8 flex flex-col gap-8 lg:mt-12 lg:gap-12">{children}</div>

      <footer className="mt-12 flex flex-col gap-4 border-t border-line pt-8">
        <div className="flex flex-col gap-2 lg:flex-row lg:gap-3">
          <ButtonLink href="/plan" className="lg:flex-[3]">
            여행 루트 만들기
          </ButtonLink>
          <ButtonLink href="/trip/example" variant="outline" className="lg:flex-[2]">
            예시 루트 바로 보기
          </ButtonLink>
        </div>
        <Link href={next.href} className="flex min-h-touch flex-col justify-center gap-1 rounded-2xl border border-line px-4 py-3 hover:bg-surface">
          <span className="text-base font-bold text-primary">{next.label} →</span>
          <span className="text-sm text-ink-sub text-pretty">{next.body}</span>
        </Link>
      </footer>
    </main>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-heading text-heading font-bold text-balance">{title}</h2>
      {children}
    </section>
  );
}

/** 본문 문단 */
export function P({ children }: { children: ReactNode }) {
  return <p className="text-base text-pretty">{children}</p>;
}

/** 점 목록: 항목마다 굵은 머리말 + 설명 */
export function Points({ items }: { items: { head: string; body: ReactNode }[] }) {
  return (
    <ul className="flex flex-col border-t border-line">
      {items.map((it) => (
        <li key={it.head} className="flex flex-col gap-1 border-b border-line py-3">
          <span className="text-base font-bold">{it.head}</span>
          <span className="text-base text-ink-sub text-pretty">{it.body}</span>
        </li>
      ))}
    </ul>
  );
}

/** 순서 목록: 번호 + 굵은 머리말 + 설명 */
export function Steps({ items }: { items: { head: string; body: ReactNode }[] }) {
  return (
    <ol className="flex flex-col gap-4">
      {items.map((it, i) => (
        <li key={it.head} className="flex gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-base font-bold text-primary-ink">
            {i + 1}
          </span>
          <div className="flex min-w-0 flex-col gap-1 pt-1">
            <span className="text-base font-bold">{it.head}</span>
            <span className="text-base text-ink-sub text-pretty">{it.body}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}
