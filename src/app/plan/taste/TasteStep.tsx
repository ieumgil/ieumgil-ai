"use client";

// 4단계 좋아하는 곳 (시안 Taste.dc.html)
import { euro } from "@/lib/text/particle";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";
import { CloseIcon, SearchIcon } from "@/components/icons";
import { CheckDot, SegmentButton } from "@/components/plan/choices";
import { INCOMPLETE_ID, IncompleteNotice, incompleteLabel } from "@/components/plan/IncompleteNotice";
import { StepFooter, StepShell } from "@/components/plan/StepShell";
import { Disclosure } from "@/components/ui/disclosure";
import { categoryThumb } from "@/lib/places/category-photos";
import { updatePlan, usePlan } from "@/lib/plan/store";
import type { Pace } from "@/lib/plan/types";
import type { Category } from "@/lib/types";

const CATEGORY_DESC: Record<Category, string> = {
  "바다·해변": "해변 데크, 바다 전망",
  "자연·산책": "호수, 숲길, 공원",
  "역사·문화": "고택, 유적, 기념관",
  "전시·박물관": "실내 전시, 체험관",
  "시장·먹거리": "전통시장, 먹거리 거리",
  "전망·체험": "전망대, 케이블카",
};
const PACES: { id: Pace; label: string; sub: string }[] = [
  { id: "slow", label: "여유롭게", sub: "하루 2~3곳" },
  { id: "normal", label: "보통", sub: "하루 3~4곳" },
  { id: "busy", label: "많이", sub: "하루 4~5곳" },
];

export interface PlaceOption {
  id: string;
  name: string;
  region: string;
}

export function TasteStep({ places }: { places: PlaceOption[] }) {
  const plan = usePlan();
  const [query, setQuery] = useState("");
  const searchId = useId();

  const toggleCategory = (c: Category) =>
    updatePlan((cur) => ({
      categories: cur.categories.includes(c) ? cur.categories.filter((x) => x !== c) : [...cur.categories, c],
    }));

  const q = query.trim();
  const results = q
    ? places.filter((p) => p.name.includes(q) && !plan.mustVisit.includes(p.id)).slice(0, 6)
    : [];
  const picked = plan.mustVisit
    .map((id) => places.find((p) => p.id === id))
    .filter((p): p is PlaceOption => !!p);

  return (
    <StepShell
      step={4}
      backHref="/plan/conditions"
      title="어떤 곳을 좋아하세요?"
      description="여러 개 골라도 돼요. 고른 곳 위주로 추천해요."
      footer={
        <StepFooter
          prevHref="/plan/conditions"
          nextHref="/plan/making"
          nextLabel="루트 만들기"
          blockedLabel={plan.categories.length === 0 ? "좋아하는 곳을 골라 주세요" : incompleteLabel(plan, 4)}
          blockedTarget={plan.categories.length === 0 ? "field-categories" : INCOMPLETE_ID}
        />
      }
    >
      <IncompleteNotice plan={plan} step={4} />
      <div id="field-categories" className="grid grid-cols-[repeat(auto-fit,minmax(9.5rem,1fr))] gap-3 px-4 md:px-6">
        {(Object.keys(CATEGORY_DESC) as Category[]).map((c) => {
          const on = plan.categories.includes(c);
          return (
            <button
              key={c}
              type="button"
              aria-pressed={on}
              onClick={() => toggleCategory(c)}
              className={`group relative flex min-h-20 items-center gap-3 rounded-2xl p-3 text-left transition-[background-color,border-color] duration-150 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                on ? "border-2 border-primary bg-primary-soft" : "border-[1.5px] border-line-control bg-white hover:border-primary"
              }`}
            >
              <span className="flex min-w-0 grow flex-col gap-1">
                <span className="text-base font-bold text-ink [overflow-wrap:anywhere]">{c}</span>
                <span className="text-sm leading-snug text-ink-sub">{CATEGORY_DESC[c]}</span>
              </span>
              {/* 사진은 또렷하게 오른쪽에(1유형 사진만, 출처는 아래 줄). 고른 표시는 사진 모서리에 걸친다 */}
              {/* eslint-disable-next-line @next/next/no-img-element -- 미리 줄여 둔 작은 사진 */}
              <img src={categoryThumb(c)} alt="" aria-hidden="true" className="size-14 shrink-0 rounded-xl object-cover" />
              <span className="absolute top-1 right-1">
                <CheckDot on={on} size="sm" />
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 px-4 text-sm text-ink-sub md:px-6">사진: 한국관광공사 · 공공누리 제1유형</p>

      <section className="mt-8 flex flex-col gap-2 px-4 md:px-6">
        <h2 className="font-heading text-heading font-bold" id="pace-title">
          하루에 얼마나 돌아볼까요?
        </h2>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(6.5rem,1fr))] gap-2" role="radiogroup" aria-labelledby="pace-title">
          {PACES.map((p) => (
            <SegmentButton key={p.id} selected={plan.pace === p.id} onClick={() => updatePlan({ pace: p.id })} className="min-h-16">
              <span className="text-base font-bold">{p.label}</span>
              <span className="text-sm font-normal">{p.sub}</span>
            </SegmentButton>
          ))}
        </div>
      </section>

      <section className="mt-8 px-4 md:px-6">
        <Disclosure className="border-y border-line" summary={`꼭 가고 싶은 곳 · ${picked.length > 0 ? `${picked.length}곳 담음` : "선택"}`}>
          <div className="flex flex-col gap-3 pt-1 pb-4">
            <Link href="/places?from=plan" className="group flex min-h-touch items-center justify-between gap-3">
              <span className="min-w-0">
                <span className="block text-base font-bold text-primary group-hover:underline group-hover:underline-offset-4">관광지 둘러보고 고르기</span>
                <span className="block text-sm leading-snug text-ink-sub">강릉·속초·동해의 대표 관광지와 어떤 곳인지, 접근성을 먼저 보고 담아요</span>
              </span>
              <ChevronRight size={20} className="shrink-0 text-primary" aria-hidden="true" />
            </Link>
            <label
              htmlFor={searchId}
              className="flex min-h-12 items-center gap-2 rounded-xl border-[1.5px] border-line-control bg-white px-4 has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary"
            >
              <SearchIcon size={20} className="shrink-0 text-ink-sub" />
              <input
                id={searchId}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                disabled={places.length === 0}
                placeholder={places.length === 0 ? "관광지 정보를 준비하고 있어요" : "이름을 알면 바로 찾기"}
                aria-label="관광지 이름 검색"
                className="min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-sub disabled:cursor-not-allowed"
              />
            </label>

            {q && (
              <ul className="flex flex-col overflow-hidden rounded-xl border border-line" aria-label="검색 결과">
                {results.length === 0 ? (
                  <li className="px-4 py-3 text-base text-ink-sub">&lsquo;{q}&rsquo;{euro(q).slice(q.length)} 찾은 곳이 없어요</li>
                ) : (
                  results.map((p) => (
                    <li key={p.id} className="border-b border-line last:border-b-0">
                      <button
                        type="button"
                        onClick={() => {
                          updatePlan((cur) => ({ mustVisit: [...cur.mustVisit, p.id] }));
                          setQuery("");
                        }}
                        className="flex min-h-touch w-full items-center justify-between gap-2 px-4 py-2 text-left text-base hover:bg-surface"
                      >
                        {p.name}
                        <span className="text-sm text-ink-sub">{p.region}</span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}

            <p className="text-sm leading-normal text-ink-sub">
              조건에 맞지 않는 곳을 고르면, 루트에 넣기 전에 어떤 점이 어려운지 먼저 알려드려요.
            </p>
          </div>
        </Disclosure>

        {/* 담은 곳은 선택 결과라 접혀 있어도 보인다 */}
        {picked.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2" aria-label="꼭 가고 싶은 곳">
            {picked.map((p) => (
              <li key={p.id} className="flex items-center gap-0.5 rounded-full bg-primary-soft py-0.5 pl-3 text-base text-primary-ink">
                {p.name}
                <button
                  type="button"
                  aria-label={`${p.name} 빼기`}
                  onClick={() => updatePlan((cur) => ({ mustVisit: cur.mustVisit.filter((id) => id !== p.id) }))}
                  className="flex min-h-touch min-w-touch items-center justify-center rounded-full hover:bg-white/60"
                >
                  <CloseIcon size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </StepShell>
  );
}
