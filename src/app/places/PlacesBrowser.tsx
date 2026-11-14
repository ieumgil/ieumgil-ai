"use client";

// 관광지 둘러보기: 지역(강릉·속초·동해) → 분야 → 사진 카드(어떤 곳인지 한 줄 · 볼 거리 · 고른 유형 기준 접근성 요약) → [담기].
// 카드를 누르면 자세히(사진·관광공사 소개 원문·운영시간·전화·접근성 10항목). 담은 곳은 입력값의 '꼭 가고 싶은 곳'(mustVisit)이 된다.
// 4단계에서 왔으면(?from=plan) 아래 버튼이 '고른 곳 가지고 돌아가기', 시작 화면에서 왔으면 '이 곳들로 루트 만들기'.
import { Check, ChevronRight, Phone, Plus, Search as SearchIcon, Sparkles } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { PlacePhoto } from "@/components/photos/PlacePhoto";
import { SegmentButton } from "@/components/plan/choices";
import { TopBar } from "@/components/TopBar";
import { ButtonLink } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CONDITION_LABELS, TRAVELER_LABELS } from "@/lib/engine/conditions";
import { glance, matches, sortPlaces, type BrowsePlace, type GlanceItem } from "@/lib/places/browse";
import { photosOf } from "@/lib/places/client-photos";
import { firstIncompleteStep } from "@/lib/plan/progress";
import { updatePlan, usePlan } from "@/lib/plan/store";
import { CATEGORIES, REGIONS, type AccessStatus, type Category, type Region } from "@/lib/types";

const PANEL =
  "mx-auto max-h-[88dvh] max-w-[36rem] overflow-y-auto rounded-t-3xl px-5 pb-8 lg:w-[36rem] lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-3xl lg:pb-6 lg:data-[side=bottom]:top-1/2 lg:data-[side=bottom]:right-auto lg:data-[side=bottom]:bottom-auto lg:data-[side=bottom]:left-1/2 lg:data-[side=bottom]:border-t-0";

/** 접근성 값 → 기호 + 색(색만으로 구분하지 않게 기호와 글자를 함께) */
const STATUS: Record<AccessStatus, { sym: string; cls: string; sr: string }> = {
  가능: { sym: "✓", cls: "bg-primary-soft text-primary-ink", sr: "가능" },
  부분가능: { sym: "!", cls: "bg-caution-bg text-caution-ink", sr: "일부만 가능" },
  불가: { sym: "✕", cls: "bg-blocked-bg text-blocked-ink", sr: "어려움" },
  모름: { sym: "?", cls: "bg-surface text-ink-sub", sr: "공식 정보 없음" },
};

function AccessChip({ item }: { item: Pick<GlanceItem, "label" | "value"> }) {
  const s = STATUS[item.value];
  return (
    <li className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-medium ${s.cls}`}>
      <span aria-hidden="true" className="font-bold">
        {s.sym}
      </span>
      <span className="sr-only">{s.sr}: </span>
      {item.label}
    </li>
  );
}

export function PlacesBrowser({ places }: { places: BrowsePlace[] }) {
  const plan = usePlan();
  const fromPlan = useSearchParams().get("from") === "plan";
  const [region, setRegion] = useState<Region>("강릉");
  const [category, setCategory] = useState<Category | null>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<BrowsePlace | null>(null);
  const travelers = plan.travelers.map((t) => TRAVELER_LABELS[t]).join(" · ");

  const counts = useMemo(() => Object.fromEntries(REGIONS.map((r) => [r, places.filter((p) => p.region === r).length])) as Record<Region, number>, [places]);
  const shown = useMemo(
    () =>
      sortPlaces(
        places.filter((p) => p.region === region && (!category || p.category === category) && matches(p, query)),
        (id) => !!photosOf(id)?.cover,
      ),
    [places, region, category, query],
  );
  const featured = shown.filter((p) => p.featured);
  const others = shown.filter((p) => !p.featured);
  const picked = plan.mustVisit.map((id) => places.find((p) => p.id === id)).filter((p): p is BrowsePlace => !!p);

  const toggle = (id: string) =>
    updatePlan((cur) => ({ mustVisit: cur.mustVisit.includes(id) ? cur.mustVisit.filter((x) => x !== id) : [...cur.mustVisit, id] }));

  const next = fromPlan ? "/plan/taste" : (firstIncompleteStep(plan, 4)?.href ?? "/plan/taste");

  return (
    <main className="mx-auto w-full max-w-[34rem] flex-1 pb-32 md:max-w-[48rem] lg:max-w-[72rem]">
      <div className="px-5 pt-4">
        <TopBar backHref={fromPlan ? "/plan/taste" : "/"} backLabel={fromPlan ? "좋아하는 곳 고르기로" : "처음 화면으로"} />
      </div>

      <header className="animate-rise px-5 pt-4">
        <h1 className="text-title font-bold">영동 관광지 둘러보기</h1>
        <p className="mt-1.5 text-base leading-normal text-ink-sub">
          어떤 곳인지 먼저 보고, 가고 싶은 곳을 담아 두세요. 담은 곳은 일정에 꼭 넣어요.
        </p>
        <p className="mt-2 text-sm leading-normal text-ink-sub">
          {travelers ? (
            <>
              <strong className="font-bold text-ink">{travelers}</strong> 기준으로 꼭 필요한 조건을 함께 보여 드려요.
            </>
          ) : (
            "함께 가는 분(휠체어·어르신·유모차)을 고르면 그 기준으로 접근성을 보여 드려요. 지금은 기본 항목이에요."
          )}
        </p>
        <p className="mt-1 text-sm text-ink-sub" aria-hidden="true">
          ✓ 가능 · ! 일부만 · ✕ 어려움 · ? 공식 정보 없음
        </p>
      </header>

      {/* 지역 */}
      <div className="grid grid-cols-3 gap-2 px-5 pt-5" role="radiogroup" aria-label="지역">
        {REGIONS.map((r) => (
          <SegmentButton key={r} selected={region === r} onClick={() => setRegion(r)}>
            <span className="text-lead font-bold">{r}</span>
            <span className="text-sm">{counts[r]}곳</span>
          </SegmentButton>
        ))}
      </div>

      {/* 분야 · 찾기 */}
      <div className="flex gap-2 overflow-x-auto px-5 pt-3 pb-1 [scrollbar-width:none]" role="group" aria-label="분야">
        {[null, ...CATEGORIES].map((c) => {
          const on = category === c;
          return (
            <button
              key={c ?? "all"}
              type="button"
              aria-pressed={on}
              onClick={() => setCategory(c)}
              className={`min-h-touch shrink-0 rounded-full border-[1.5px] px-3.5 text-base font-medium transition-colors ${on ? "border-primary bg-primary text-white" : "border-line bg-white text-ink hover:border-primary/40"}`}
            >
              {c ?? "전체"}
            </button>
          );
        })}
      </div>
      <div className="px-5 pt-2">
        <label className="flex h-12.5 items-center gap-2 rounded-xl border-[1.5px] border-surface bg-surface px-3.5 has-focus-visible:border-primary">
          <SearchIcon size={20} className="shrink-0 text-ink-sub" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="이름이나 볼 거리로 찾기(예: 해돋이, 박물관)"
            aria-label="관광지 찾기"
            className="min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-sub"
          />
        </label>
      </div>

      {shown.length === 0 && <p className="px-5 pt-8 text-center text-base text-ink-sub">조건에 맞는 곳이 없어요. 분야나 찾는 말을 바꿔 보세요.</p>}
      {featured.length > 0 && (
        <Section title="대표 관광지" sub={`${region}에서 많이 찾는 곳 ${featured.length}곳`}>
          {featured.map((p) => (
            <PlaceTile key={p.id} p={p} picked={plan.mustVisit.includes(p.id)} plan={plan} onToggle={toggle} onOpen={setOpen} />
          ))}
        </Section>
      )}
      {others.length > 0 && (
        <Section title={featured.length ? "그 밖의 곳" : "관광지"} sub={`${others.length}곳`}>
          {others.map((p) => (
            <PlaceTile key={p.id} p={p} picked={plan.mustVisit.includes(p.id)} plan={plan} onToggle={toggle} onOpen={setOpen} />
          ))}
        </Section>
      )}
      <p className="px-5 pt-6 text-sm leading-normal text-ink-sub">
        소개는 한국관광공사 관광지 소개 글을 AI가 한 줄로 정리했어요(원문에 없는 내용은 쓰지 않게 검사). 접근성은 관광공사 무장애 정보를 AI가 정리한 값이라 현장과
        다를 수 있어요. 사진: 한국관광공사 · 공공누리.
      </p>

      {/* 담은 곳 */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white/95 px-5 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur">
        <div className="mx-auto flex max-w-[34rem] items-center gap-3 md:max-w-[48rem]">
          <p className="min-w-0 flex-1 text-base" role="status">
            {picked.length ? (
              <>
                <span className="font-bold">담은 곳 {picked.length}곳</span>
                <span className="block truncate text-sm text-ink-sub">{picked.map((p) => p.name).join(" · ")}</span>
              </>
            ) : (
              <span className="text-ink-sub">아직 담은 곳이 없어요</span>
            )}
          </p>
          <ButtonLink href={next} className="shrink-0 px-5">
            {fromPlan ? "돌아가기" : "루트 만들기"}
            <ChevronRight aria-hidden="true" />
          </ButtonLink>
        </div>
      </div>

      <Sheet open={open !== null} onOpenChange={(v) => !v && setOpen(null)}>
        <SheetContent side="bottom" className={PANEL}>
          {open && <PlaceDetail p={open} picked={plan.mustVisit.includes(open.id)} plan={plan} onToggle={toggle} />}
        </SheetContent>
      </Sheet>
    </main>
  );
}

function Section({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  return (
    <section className="px-5 pt-6">
      <h2 className="flex items-baseline gap-2 text-lg font-bold">
        {title} <span className="text-sm font-normal text-ink-sub">{sub}</span>
      </h2>
      <ul className="mt-3 grid gap-3 lg:grid-cols-2">{children}</ul>
    </section>
  );
}

type PlanLike = ReturnType<typeof usePlan>;

function PickButton({ picked, onClick, name, full = false }: { picked: boolean; onClick: () => void; name: string; full?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={picked}
      aria-label={picked ? `${name} 담기 취소` : `${name} 꼭 가고 싶은 곳에 담기`}
      className={`inline-flex min-h-touch items-center justify-center gap-1.5 rounded-xl px-4 text-base font-bold transition-colors ${full ? "w-full" : ""} ${
        picked ? "bg-primary text-white hover:bg-primary-ink" : "border-[1.5px] border-primary bg-white text-primary hover:bg-primary-soft"
      }`}
    >
      {picked ? <Check size={18} aria-hidden="true" /> : <Plus size={18} aria-hidden="true" />}
      {picked ? "담았어요" : "담기"}
    </button>
  );
}

function PlaceTile({ p, picked, plan, onToggle, onOpen }: { p: BrowsePlace; picked: boolean; plan: PlanLike; onToggle: (id: string) => void; onOpen: (p: BrowsePlace) => void }) {
  const g = glance(p, plan);
  return (
    <li>
      <article className={`flex h-full flex-col gap-3 rounded-2xl bg-white p-4 ring-1 transition-shadow ${picked ? "ring-2 ring-primary" : "ring-line"}`}>
        <div className="flex gap-3">
          <PlacePhoto id={p.id} name={p.name} category={p.category} />
          <div className="min-w-0 flex-1">
            <h3 className="text-lg leading-snug font-bold">
              {p.name}
              {p.featured && <span className="ml-1.5 inline-block rounded-md bg-primary-soft px-1.5 align-middle text-sm font-bold text-primary-ink">대표</span>}
            </h3>
            <p className="text-sm text-ink-sub">
              {p.region} · {p.category}
            </p>
            <p className="mt-1 text-base leading-normal">{p.summary}</p>
          </div>
        </div>
        {p.highlights.length > 0 && (
          <p className="text-sm leading-normal text-ink-sub">
            <span className="font-bold text-ink">볼 거리</span> {p.highlights.join(" · ")}
          </p>
        )}
        <ul className="flex flex-wrap gap-1.5" aria-label={g.byTraveler ? "꼭 필요한 조건" : "접근성(기본 항목)"}>
          {g.items.map((i) => (
            <AccessChip key={i.key} item={i} />
          ))}
        </ul>
        {g.blocked.length > 0 && (
          <p className="rounded-xl bg-blocked-bg px-3 py-2 text-sm leading-normal text-blocked-ink">
            <span className="sr-only">주의: </span>공식 정보상 {g.blocked.map((b) => b.label).join(", ")}이(가) 어려워 일정을 만들 때 빠질 수 있어요.
          </p>
        )}
        <div className="mt-auto flex gap-2">
          <button
            type="button"
            onClick={() => onOpen(p)}
            className="inline-flex min-h-touch flex-1 items-center justify-center gap-1 rounded-xl bg-surface px-3 text-base font-medium text-ink transition-colors hover:bg-line"
          >
            자세히 보기
          </button>
          <PickButton picked={picked} onClick={() => onToggle(p.id)} name={p.name} />
        </div>
      </article>
    </li>
  );
}

const ACCESS_ORDER = ["step_free_entrance", "elevator", "slope", "surface", "accessible_toilet", "disabled_parking", "diaper_nursing", "rest_area", "rental_wheelchair", "rental_stroller"] as const;

function PlaceDetail({ p, picked, plan, onToggle }: { p: BrowsePlace; picked: boolean; plan: PlanLike; onToggle: (id: string) => void }) {
  const g = glance(p, plan);
  const must = new Set(g.byTraveler ? g.items.map((i) => i.key) : []);
  return (
    <>
      <SheetHeader className="px-0 pt-6 pb-0">
        <SheetTitle className="text-title leading-snug font-bold">{p.name}</SheetTitle>
        <SheetDescription className="text-base text-ink-sub">
          {p.region} · {p.category}
          {p.featured ? " · 대표 관광지" : ""}
        </SheetDescription>
      </SheetHeader>
      <div className="mt-3 flex gap-3">
        <PlacePhoto id={p.id} name={p.name} category={p.category} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="text-lead leading-normal font-medium">{p.summary}</p>
          {p.summaryBy === "ai" && (
            <p className="mt-1 inline-flex items-center gap-1 text-sm text-ink-sub">
              <Sparkles size={14} aria-hidden="true" /> AI가 관광공사 소개를 정리했어요
            </p>
          )}
        </div>
      </div>
      {p.highlights.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="볼 거리">
          {p.highlights.map((h) => (
            <li key={h} className="rounded-full bg-surface px-3 py-1 text-base">
              {h}
            </li>
          ))}
        </ul>
      )}

      <h3 className="mt-5 text-lg font-bold">관광공사 소개</h3>
      <div className="mt-1.5 flex flex-col gap-2 text-base leading-relaxed text-ink-sub">
        {p.overview.map((t, i) => (
          <p key={i}>{t}</p>
        ))}
      </div>

      <h3 className="mt-5 text-lg font-bold">운영시간 · 연락처</h3>
      <p className="mt-1.5 text-base">{p.hours}</p>
      {p.address && <p className="text-base text-ink-sub">{p.address}</p>}
      <a href={`tel:${p.phone}`} className="mt-2 inline-flex min-h-touch items-center gap-2 rounded-xl border-[1.5px] border-primary px-4 text-base font-bold text-primary hover:bg-primary-soft">
        <Phone size={18} aria-hidden="true" /> {p.phone}
      </a>

      <h3 className="mt-5 text-lg font-bold">접근성</h3>
      <p className="text-sm text-ink-sub">관광공사 무장애 정보를 AI가 정리한 값이에요. {must.size ? "굵은 항목은 고른 분께 꼭 필요한 조건이에요." : ""}</p>
      <ul className="mt-2 flex flex-col divide-y divide-line rounded-2xl ring-1 ring-line">
        {ACCESS_ORDER.map((k) => {
          const a = p.access[k];
          const s = STATUS[a.value];
          return (
            <li key={k} className="flex items-start gap-3 px-3.5 py-2.5 text-base">
              <span className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-sm font-bold ${s.cls}`} aria-hidden="true">
                {s.sym}
              </span>
              <span className="min-w-0 flex-1">
                <span className={must.has(k) ? "font-bold" : ""}>{CONDITION_LABELS[k]}</span>
                <span className="text-ink-sub"> · {a.value === "모름" ? "공식 정보 없음" : a.value}</span>
                {a.note && <span className="block text-sm text-ink-sub">{a.note}</span>}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="sticky bottom-0 mt-5 bg-white pt-2">
        <PickButton picked={picked} onClick={() => onToggle(p.id)} name={p.name} full />
      </div>
    </>
  );
}
