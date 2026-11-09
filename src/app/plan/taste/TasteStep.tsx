"use client";

// 4단계 좋아하는 곳 (시안 Taste.dc.html)
import { useId, useState } from "react";
import { CloseIcon, SearchIcon } from "@/components/icons";
import { CheckDot, SegmentButton } from "@/components/plan/choices";
import { IncompleteNotice, incompleteLabel } from "@/components/plan/IncompleteNotice";
import { StepFooter, StepShell } from "@/components/plan/StepShell";
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
          nextHref="/trip/new"
          nextLabel="루트 만들기"
          blockedLabel={plan.categories.length === 0 ? "좋아하는 곳을 골라 주세요" : incompleteLabel(plan, 4)}
        />
      }
    >
      <IncompleteNotice plan={plan} step={4} />
      <div className="grid grid-cols-2 gap-2.5 px-5 pt-4">
        {(Object.keys(CATEGORY_DESC) as Category[]).map((c) => {
          const on = plan.categories.includes(c);
          return (
            <button
              key={c}
              type="button"
              aria-pressed={on}
              onClick={() => toggleCategory(c)}
              className={`flex min-h-24 flex-col gap-1.5 rounded-2xl border-2 p-3.5 text-left transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                on ? "border-primary bg-primary-soft" : "border-surface bg-surface"
              }`}
            >
              <span className="flex w-full items-center justify-between gap-1">
                <span className="text-[1.0625rem] font-bold text-ink">{c}</span>
                <CheckDot on={on} size="sm" />
              </span>
              <span className="text-sm leading-snug text-ink-sub">{CATEGORY_DESC[c]}</span>
            </button>
          );
        })}
      </div>

      <section className="flex flex-col gap-2.5 px-5 pt-6">
        <h2 className="text-lg font-bold" id="pace-title">
          하루에 얼마나 돌아볼까요?
        </h2>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-labelledby="pace-title">
          {PACES.map((p) => (
            <SegmentButton key={p.id} selected={plan.pace === p.id} onClick={() => updatePlan({ pace: p.id })} className="min-h-16">
              <span className="text-base font-bold">{p.label}</span>
              <span className="text-sm">{p.sub}</span>
            </SegmentButton>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2.5 px-5 pt-6">
        <h2 className="text-lg font-bold">
          꼭 가고 싶은 곳이 있나요? <span className="text-sm font-normal text-ink-sub">선택</span>
        </h2>
        <label
          htmlFor={searchId}
          className="flex h-12.5 items-center gap-2 rounded-xl border-[1.5px] border-surface bg-surface px-3.5 has-focus-visible:border-primary"
        >
          <SearchIcon size={20} className="shrink-0 text-ink-sub" />
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={places.length === 0}
            placeholder={places.length === 0 ? "관광지 정보를 준비하고 있어요" : "관광지 이름으로 찾기"}
            aria-label="관광지 이름 검색"
            className="min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-sub disabled:cursor-not-allowed"
          />
        </label>

        {q && (
          <ul className="flex flex-col overflow-hidden rounded-xl border border-line" aria-label="검색 결과">
            {results.length === 0 ? (
              <li className="px-4 py-3 text-base text-ink-sub">&lsquo;{q}&rsquo;(으)로 찾은 곳이 없어요</li>
            ) : (
              results.map((p) => (
                <li key={p.id} className="border-b border-line last:border-b-0">
                  <button
                    type="button"
                    onClick={() => {
                      updatePlan((cur) => ({ mustVisit: [...cur.mustVisit, p.id] }));
                      setQuery("");
                    }}
                    className="flex min-h-touch w-full items-center justify-between px-4 py-2 text-left text-base hover:bg-surface"
                  >
                    {p.name}
                    <span className="text-sm text-ink-sub">{p.region}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        )}

        {picked.length > 0 && (
          <ul className="flex flex-wrap gap-2" aria-label="꼭 가고 싶은 곳">
            {picked.map((p) => (
              <li key={p.id} className="flex items-center gap-0.5 rounded-full bg-primary-soft py-0.5 pl-3 text-base text-primary-ink">
                {p.name}
                <button
                  type="button"
                  aria-label={`${p.name} 빼기`}
                  onClick={() => updatePlan((cur) => ({ mustVisit: cur.mustVisit.filter((id) => id !== p.id) }))}
                  className="flex size-touch items-center justify-center rounded-full hover:bg-white/60"
                >
                  <CloseIcon size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <p className="text-sm leading-normal text-ink-sub">
          조건에 맞지 않는 곳을 고르면, 루트에 넣기 전에 어떤 점이 어려운지 먼저 알려드려요.
        </p>
      </section>
    </StepShell>
  );
}
