"use client";

// 관광지 둘러보기: 지역(강릉·속초·동해) → 분야 → 사진 카드(어떤 곳인지 한 줄 · 볼 거리 · 고른 유형 기준 접근성 요약) → [담기].
// 카드를 누르면 자세히(사진·관광공사 소개 원문·운영시간·전화·접근성 10항목). 장애인 화장실·기저귀 교환대는 공공데이터 값이면 출처·기준일('공공데이터(YYYY-MM 기준)')을 붙인다. 담은 곳은 입력값의 '꼭 가고 싶은 곳'(mustVisit)이 된다.
// 4단계에서 왔으면(?from=plan) 아래 버튼이 '고른 곳 가지고 돌아가기', 시작 화면에서 왔으면 '이 곳들로 루트 만들기'.
import { Check, ChevronRight, Phone, Plus, Search as SearchIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { PlacePhoto } from "@/components/photos/PlacePhoto";
import { PhoneText } from "@/components/PhoneText";
import { ScrollTop } from "@/components/ScrollTop";
import { ChoiceButton, SegmentButton } from "@/components/plan/choices";
import { TopBar } from "@/components/TopBar";
import { ButtonLink } from "@/components/ui/button";
import { Disclosure } from "@/components/ui/disclosure";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CONDITION_LABELS, TRAVELER_LABELS } from "@/lib/engine/conditions";
import { glance, matches, sortPlaces, type BrowsePlace, type GlanceItem } from "@/lib/places/browse";
import { photosOf } from "@/lib/places/client-photos";
import { firstIncompleteStep } from "@/lib/plan/progress";
import { updatePlan, usePlan } from "@/lib/plan/store";
import { CATEGORIES, REGIONS, type AccessStatus, type Category, type Region } from "@/lib/types";

const PANEL =
  "mx-auto max-h-[88dvh] max-w-[36rem] overflow-y-auto rounded-t-3xl px-4 pb-8 md:px-6 lg:w-[36rem] lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-3xl lg:pb-6 lg:data-[side=bottom]:top-1/2 lg:data-[side=bottom]:right-auto lg:data-[side=bottom]:bottom-auto lg:data-[side=bottom]:left-1/2 lg:data-[side=bottom]:border-t-0";

/** 접근성 값 → 기호 + 색(색만으로 구분하지 않게 기호와 글자를 함께) */
const STATUS: Record<AccessStatus, { sym: string; cls: string; sr: string }> = {
  가능: { sym: "✓", cls: "bg-primary-soft text-primary-ink", sr: "가능" },
  부분가능: { sym: "!", cls: "bg-caution-bg text-caution-ink", sr: "일부만 가능" },
  불가: { sym: "✕", cls: "bg-blocked-bg text-blocked-ink", sr: "어려움" },
  모름: { sym: "?", cls: "bg-surface text-ink-sub", sr: "공식 정보 없음" },
};

/** 장소 항목에 보이는 접근성 칩 개수. 나머지는 '+N'으로 알리고 10항목 전체는 자세히 보기에 있다 */
const MAX_CHIPS = 4;

function AccessChip({ item }: { item: Pick<GlanceItem, "label" | "value"> }) {
  const s = STATUS[item.value];
  return (
    <li className={`inline-flex items-center gap-1 rounded-full px-3 py-0.5 text-sm font-bold ${s.cls}`}>
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
      <div className="px-4 pt-4 md:px-6">
        <TopBar backHref={fromPlan ? "/plan/taste" : "/"} backLabel={fromPlan ? "좋아하는 곳 고르기로" : "처음 화면으로"} />
      </div>

      {/* 머리 예산 300px: 제목 · 설명 · (유형 기준 한 줄) · 범례 펼치기 · 지역 분할 · 분야 칩 · 검색칸. 장소 목록이 첫 화면에 바로 보이게 한다 */}
      <header className="animate-rise px-4 pt-4 md:px-6">
        <h1 className="font-heading text-title font-bold text-balance">영동 관광지 둘러보기</h1>
        <p className="mt-1 text-base text-ink-sub text-pretty">어떤 곳인지 먼저 보고, 가고 싶은 곳을 담아 두세요. 담은 곳은 일정에 꼭 넣어요.</p>
        {travelers && (
          <p className="mt-1 text-sm text-ink-sub">
            <strong className="font-bold text-ink">{travelers}</strong> 기준으로 꼭 필요한 조건을 함께 보여 드려요.
          </p>
        )}
        <Disclosure summary="접근성 표시 보는 법">
          <p className="text-sm text-ink-sub">✓ 가능 · ! 일부만 · ✕ 어려움 · ? 공식 정보 없음</p>
          {!travelers && (
            <p className="mt-1 text-sm text-ink-sub">
              함께 가는 분(휠체어·어르신·유모차)을 고르면 그 기준으로 접근성을 보여 드려요. 지금은 기본 항목이에요.
            </p>
          )}
        </Disclosure>
      </header>

      {/* 지역: 한 줄 분할 */}
      <div className="mt-2 flex flex-wrap gap-2 px-4 md:px-6" role="radiogroup" aria-label="지역">
        {REGIONS.map((r) => (
          <SegmentButton key={r} selected={region === r} onClick={() => setRegion(r)} fluid className="grow basis-[5.5rem]">
            <span className="flex flex-wrap items-baseline justify-center gap-x-1">
              <span>{r}</span>
              <span className={`text-sm ${region === r ? "text-pine" : "text-ink-sub"}`}>{counts[r]}곳</span>
            </span>
          </SegmentButton>
        ))}
      </div>

      {/* 분야 · 찾기 */}
      <div className="mt-1 flex gap-2 overflow-x-auto px-4 py-1 md:px-6 [scrollbar-width:none]" role="group" aria-label="분야">
        {[null, ...CATEGORIES].map((c) => (
          <ChoiceButton key={c ?? "all"} selected={category === c} onClick={() => setCategory(c)} className="shrink-0">
            {c ?? "전체"}
          </ChoiceButton>
        ))}
      </div>
      <div className="mt-1 px-4 md:px-6">
        <label className="flex min-h-12 items-center gap-2 rounded-xl border-[1.5px] border-line-control bg-white px-4 has-focus-visible:border-primary has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary">
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

      {shown.length === 0 && <p className="px-4 pt-8 text-center text-base text-ink-sub md:px-6">조건에 맞는 곳이 없어요. 분야나 찾는 말을 바꿔 보세요.</p>}
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
      <p className="mt-8 px-4 text-sm text-ink-sub md:px-6">
        소개는 한국관광공사 관광지 소개 글을 AI가 한 줄로 정리했어요(원문에 없는 내용은 쓰지 않게 검사). 접근성은 관광공사 무장애 정보를 AI가 정리한 값(장애인
        화장실·기저귀 교환대 일부는 행정안전부 공중화장실 공공데이터)이라 현장과 다를 수 있어요. 사진: 한국관광공사 · 공공누리.
      </p>

      {/* 담은 곳: 불투명 흰 바탕 + 위 그림자(S3). 세로가 아주 짧은 창에서는 따라다니지 않는다 */}
      <div
        data-bottom-bar
        className="fixed inset-x-0 bottom-0 z-20 max-h-[30dvh] overflow-y-auto bg-white px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgb(25_31_40/0.08)] md:px-6 [@media(max-height:30rem)]:static"
      >
        <div className="mx-auto flex max-w-[32rem] items-center gap-3 md:max-w-[45rem] lg:max-w-[69rem]">
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
          <ButtonLink href={next} className="shrink-0 px-4">
            {fromPlan ? "돌아가기" : "루트 만들기"}
            <ChevronRight aria-hidden="true" />
          </ButtonLink>
        </div>
      </div>

      {/* 맨 위로: 아래 '담은 곳' 막대 위에 */}
      <ScrollTop bottom="calc(6.5rem + env(safe-area-inset-bottom))" />

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
    <section className="mt-8 px-4 md:px-6">
      <h2 className="flex flex-wrap items-baseline gap-x-2 font-heading text-heading font-bold">
        {title} <span className="font-sans text-sm font-normal text-ink-sub">{sub}</span>
      </h2>
      <ul className="mt-3 grid gap-4 lg:grid-cols-2">{children}</ul>
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
      // 보이는 글자('담기'·'담았어요')가 이름 안에 그대로 들어가게 한다(label-in-name)
      aria-label={picked ? `${name} 담았어요, 누르면 담기 취소` : `${name} 꼭 가고 싶은 곳에 담기`}
      className={`inline-flex min-h-touch items-center justify-center gap-2 rounded-xl border-[1.5px] px-4 text-base font-bold transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary ${full ? "w-full" : ""} ${
        picked ? "border-primary bg-primary text-white hover:bg-primary-ink" : "border-primary bg-white text-primary hover:bg-primary-soft hover:text-primary-ink"
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
      <article className={`flex h-full flex-col gap-3 rounded-2xl bg-white p-4 ${picked ? "border-2 border-primary" : "border border-line"}`}>
        <div className="flex flex-wrap gap-3">
          <PlacePhoto id={p.id} name={p.name} category={p.category} />
          {/* min-w-0를 두지 않는다: 이름 낱말이 사진 옆 칸에 안 들어가면 칸이 사진 아래 줄로 내려가 넓게 쓰고, 그래도 안 들어갈 때만 글자 사이에서 끊긴다 */}
          <div className="grow basis-40 [overflow-wrap:break-word]">
            <h3 className="text-heading leading-snug font-bold">
              {p.featured ? `${p.name} ` : p.name}
              {p.featured && <span className="text-sm font-bold whitespace-nowrap text-ink-sub">대표</span>}
            </h3>
            <p className="text-sm font-bold text-pine">
              {p.region} · {p.category}
            </p>
            <p className="mt-1 text-base [overflow-wrap:anywhere]">{p.summary}</p>
          </div>
        </div>
        <ul className="flex flex-wrap items-center gap-2" aria-label={g.byTraveler ? "꼭 필요한 조건" : "접근성(기본 항목)"}>
          {g.items.slice(0, MAX_CHIPS).map((i) => (
            <AccessChip key={i.key} item={i} />
          ))}
          {g.items.length > MAX_CHIPS && (
            // 나머지 항목은 자세히 보기의 10항목에 모두 있다
            <li className="text-sm font-bold text-ink-sub">
              +{g.items.length - MAX_CHIPS}
              <span className="sr-only">개 더 — 자세히 보기에서</span>
            </li>
          )}
        </ul>
        {g.blocked.length > 0 && (
          <p className="rounded-xl bg-blocked-bg px-3 py-2 text-base text-blocked-ink">
            <span className="sr-only">주의: </span>공식 정보상 {g.blocked.map((b) => b.label).join(", ")}이(가) 어려워 일정을 만들 때 빠질 수 있어요.
          </p>
        )}
        <div className="mt-auto flex gap-2">
          <button
            type="button"
            onClick={() => onOpen(p)}
            className="inline-flex min-h-touch flex-1 items-center justify-center gap-1 rounded-xl bg-surface px-3 text-base font-bold text-ink transition-colors hover:bg-line focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary"
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
  const hasPublic = ACCESS_ORDER.some((k) => p.access[k].source);
  return (
    <>
      <SheetHeader className="px-0 pt-6 pb-0">
        <SheetTitle>{p.name}</SheetTitle>
        <SheetDescription className="text-sm font-bold text-pine">
          {p.region} · {p.category}
          {p.featured ? " · 대표 관광지" : ""}
        </SheetDescription>
      </SheetHeader>
      <div className="mt-3 flex gap-3">
        <PlacePhoto id={p.id} name={p.name} category={p.category} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold">{p.summary}</p>
          {p.summaryBy === "ai" && <p className="mt-1 text-sm text-ink-sub">AI가 관광공사 소개를 정리했어요</p>}
        </div>
      </div>
      {p.highlights.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-x-2 text-base" aria-label="볼 거리">
          {p.highlights.map((h, i) => (
            <li key={h} className="flex gap-2">
              {h}
              {i < p.highlights.length - 1 && <span aria-hidden="true">·</span>}
            </li>
          ))}
        </ul>
      )}

      <h3 className="mt-6 text-base font-bold">관광공사 소개</h3>
      <div className="mt-1.5 flex flex-col gap-2 text-base leading-relaxed text-ink-sub">
        {p.overview.map((t, i) => (
          <p key={i}>{t}</p>
        ))}
      </div>

      <h3 className="mt-6 text-base font-bold">운영시간 · 연락처</h3>
      <p className="mt-1.5 text-base">{p.hours}</p>
      {p.address && <p className="text-base text-ink-sub">{p.address}</p>}
      <a
        href={`tel:${p.phone}`}
        className="mt-2 inline-flex min-h-touch items-center gap-2 rounded-xl border-[1.5px] border-primary px-4 text-base font-bold text-primary hover:bg-primary-soft hover:text-primary-ink focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <Phone size={18} aria-hidden="true" />
        <span>
          <PhoneText phone={p.phone} />
        </span>
      </a>

      <h3 className="mt-6 text-base font-bold">접근성</h3>
      <p className="text-sm text-ink-sub">
        {hasPublic ? "관광공사 무장애 정보를 AI가 정리한 값이고, '공공데이터' 표시는 행정안전부 공중화장실 정보예요." : "관광공사 무장애 정보를 AI가 정리한 값이에요."}{" "}
        {must.size ? "굵은 항목은 고른 분께 꼭 필요한 조건이에요." : ""}
      </p>
      <ul className="mt-2 flex flex-col divide-y divide-line rounded-2xl border border-line">
        {ACCESS_ORDER.map((k) => {
          const a = p.access[k];
          const s = STATUS[a.value];
          return (
            <li key={k} className="flex items-start gap-3 px-4 py-3 text-base">
              <span className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-sm font-bold ${s.cls}`} aria-hidden="true">
                {s.sym}
              </span>
              <span className="min-w-0 flex-1">
                {a.label ? (
                  // 공공데이터 기저귀 교환대: 수유실이 있다는 말로 읽히지 않게 교환대 문장으로 쓴다(✓ 기호 + 글자)
                  <span className={must.has(k) ? "font-bold" : ""}>{a.label}</span>
                ) : (
                  <>
                    <span className={must.has(k) ? "font-bold" : ""}>{CONDITION_LABELS[k]}</span>
                    <span className="text-ink-sub"> · {a.value === "모름" ? "공식 정보 없음" : a.value}</span>
                  </>
                )}
                {a.noNursing && <span className="block text-base text-ink-sub">수유실은 정보 없음</span>}
                {(a.note || a.source) && (
                  <span className="block text-sm text-ink-sub">
                    {a.note}
                    {a.note && a.source ? " · " : ""}
                    {a.source && <span className="font-bold text-ink">{a.source}</span>}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="sticky bottom-0 mt-6 bg-white pt-2">
        <PickButton picked={picked} onClick={() => onToggle(p.id)} name={p.name} full />
      </div>
    </>
  );
}
