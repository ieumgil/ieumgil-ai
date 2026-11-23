// 대표 관광지 사진 줄(레퍼런스: 강진·계룡·보령 관광 — 사진 카드 줄 + 지역·분류 글자).
// 조사표의 대표 관광지(data/featured.json) 가운데 사진이 있는 곳을 도시마다 고루 8곳. 누르면 관광지 둘러보기로 간다.
// 사진: 한국관광공사 공공누리 제1유형(public/photos). 고화질 사진을 구하면 그 파일만 바꾼다.
import Image from "next/image";
import Link from "next/link";
import places from "../../../data/places.json";
import { SectionTitle } from "./SectionTitle";

const PICK = ["GN03", "GN12", "GN81", "SC11", "SC21", "SC22", "DH18", "DH06"];

type Row = { id: string; name_ko: string; region: string; category: string };
const BY_ID = new Map((places as Row[]).map((p) => [p.id, p]));

export function FeaturedPlaces({ className = "" }: { className?: string }) {
  const list = PICK.flatMap((id) => {
    const p = BY_ID.get(id);
    return p ? [p] : [];
  });
  return (
    <section aria-labelledby="featured-title" className={className}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <SectionTitle id="featured-title" kicker="영동 대표 관광지">
          강릉·속초·동해, <span className="text-primary">어디부터</span> 가 볼까요?
        </SectionTitle>
        <Link href="/places" className="inline-flex min-h-touch items-center text-base font-medium text-primary underline-offset-4 hover:underline">
          관광지 152곳 모두 보기 →
        </Link>
      </div>
      <ul className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {list.map((p) => (
          <li key={p.id}>
            <Link href="/places" className="group flex flex-col gap-3">
              <span className="relative block aspect-[4/3] overflow-hidden rounded-2xl bg-surface">
                <Image src={`/photos/${p.id}.webp`} alt="" fill sizes="(min-width: 1024px) 22vw, 45vw" className="object-cover transition-transform duration-300 group-hover:scale-105" />
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
    </section>
  );
}
