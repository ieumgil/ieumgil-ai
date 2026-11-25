// 대표 관광지 사진 줄(레퍼런스: 강진·계룡·보령 관광 — 사진 카드 줄 + 지역·분류 글자).
// 조사표의 대표 관광지(data/featured.json) 가운데 사진이 있는 곳을 도시마다 고루 8곳. 누르면 관광지 둘러보기에서 그 관광지가 바로 열린다(/places?place=ID).
// 사진(11/25 고화질): data/featured-photos.json에 있는 곳은 저작권 걱정이 없는 원본(CC0 · CC BY · 공공누리 제1유형)을
//   1200×900으로 줄인 public/photos/featured/{id}.webp(scripts/tour/featured-photos.ts), 나머지는 한국관광공사 사진(공공누리 제1유형, public/photos/{id}.webp).
//   CC BY는 작가 · 라이선스 · 원본 · 바꾼 점을 적어야 해서 구역 아래 '사진 출처'에 모두 둔다(누르는 글자 16px 규칙 때문에 펼치기 안, 접혀도 라이선스 종류는 보임).
import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import credits from "../../../data/featured-photos.json";
import places from "../../../data/places.json";
import { Disclosure } from "../ui/disclosure";
import { SectionTitle } from "./SectionTitle";

const PICK = ["GN03", "GN12", "GN81", "SC11", "SC21", "SC22", "DH18", "DH06"];

type Row = { id: string; name_ko: string; region: string; category: string };
const BY_ID = new Map((places as Row[]).map((p) => [p.id, p]));
const CREDIT = new Map(credits.photos.map((c) => [c.id, c]));

// 출처 링크도 누르는 높이 44px(a11y 규칙) — 줄 안에서 글자 높이만 쓰지 않게 inline-flex
const LINK = "inline-flex min-h-touch items-center text-primary underline underline-offset-4 hover:text-primary-ink";

export function FeaturedPlaces({ className = "" }: { className?: string }) {
  const list = PICK.flatMap((id) => {
    const p = BY_ID.get(id);
    return p ? [p] : [];
  });
  const kto = list.filter((p) => !CREDIT.has(p.id)).map((p) => p.name_ko);
  return (
    <section aria-labelledby="featured-title" className={className}>
      <div className="flex flex-wrap items-end justify-between gap-4" data-reveal="">
        <SectionTitle id="featured-title" kicker="영동 대표 관광지">
          강릉·속초·동해, <span className="text-primary">어디부터</span> 가 볼까요?
        </SectionTitle>
        <Link href="/places" className="inline-flex min-h-touch items-center text-base font-medium text-primary underline-offset-4 hover:underline">
          관광지 152곳 모두 보기 →
        </Link>
      </div>
      <ul className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {list.map((p, i) => (
          // 스크롤 등장: 한 줄(PC 4장) 안에서 왼쪽부터 차례로
          <li key={p.id} data-reveal="" style={{ "--reveal-i": (i % 4) + 1 } as CSSProperties}>
            <Link href={`/places?place=${p.id}`} className="group flex flex-col gap-3">
              <span className="relative block aspect-[4/3] overflow-hidden rounded-2xl bg-surface">
                <Image
                  src={CREDIT.has(p.id) ? `/photos/featured/${p.id}.webp` : `/photos/${p.id}.webp`}
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 22vw, 45vw"
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </span>
              <span className="flex flex-col gap-1">
                <span className="text-sm text-pine">
                  {p.region} · {p.category}
                </span>
                <span className="text-base font-medium text-ink group-hover:underline">{p.name_ko}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {/* 사진 출처: 목록(li)이 아니라 문단으로 — 위 카드 목록과 섞이지 않게 */}
      <Disclosure summary="사진 출처 · CC0 · CC BY · 공공누리 제1유형" className="mt-6" summaryClassName="text-ink-sub">
        <div className="flex flex-col pb-2 text-base text-ink-sub">
          {credits.photos.map((c) => (
            <p key={c.id}>
              <a href={c.page} target="_blank" rel="noopener noreferrer" className={LINK}>
                {c.place}
              </a>{" "}
              — {c.author},{" "}
              <a href={c.licenseUrl} target="_blank" rel="noopener noreferrer" className={LINK}>
                {c.license}
              </a>
            </p>
          ))}
          <p>{kto.join(" · ")} — 한국관광공사, 공공누리 제1유형</p>
          <p className="text-sm">위 {credits.photos.length}장은 {credits.changes}</p>
        </div>
      </Disclosure>
    </section>
  );
}
