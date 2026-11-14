"use client";

// 결과 화면: AI가 만든 일정 2~3안 비교 → 고른 안의 날짜별 타임라인 → 이 일정으로 정하기.
// 가독성 원칙: 카드에는 핵심(시각·이름·판단·한 줄 이유·전화)만, 나머지는 [자세히]로 펼친다.
// 장소마다 [바꾸기]로 AI가 이미 판단한 근처 후보로 바꿀 수 있다(AI·서버 호출 없이 코드가 시각을 다시 계산·검사).
// 시각은 모두 코드가 계산한 값이다. 이동시간은 열 때마다 카카오 실제 값을 받아 다시 계산하고(저장 안 함), 못 받은 구간만 '추정'.
// 탭에 보관·바꾸기·확정에는 추정 기준 안(option)을 쓰고, 화면에만 실제 시간으로 다시 계산한 안(shown)을 보여준다.
// 배치(창 너비에 따라 바로 바뀐다):
// - 휴대폰·태블릿(<1024px): 요약 → 안 고르기 → 고른 안(제목 → 날짜 탭 → 지도 → 타임라인), 아래에 확정 버튼 고정
// - PC(1024px~): 왼쪽 요약·안 고르기·확정 버튼(고정) + 오른쪽 고른 안(지도는 날짜 탭 아래)
// - 넓은 PC(1280px~): 안 고르기 · 고른 안 · 지도 3칸(지도 고정)
// 지도 경로선은 열 때마다 받고 저장하지 않는다(일반 차량 경로).
import { CircleCheck, X } from "lucide-react";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { TopBar } from "@/components/TopBar";
import { TripMap } from "@/components/map/TripMap";
import { ConfirmButton, ConfirmSheet } from "@/components/trip/ConfirmSheet";
import { ExampleBanner } from "@/components/trip/ExampleBanner";
import { Footnotes } from "@/components/trip/Footnotes";
import { OptionDetail } from "@/components/trip/OptionDetail";
import { OptionPicker } from "@/components/trip/OptionPicker";
import { Summary } from "@/components/trip/Summary";
import { SwapSheet } from "@/components/trip/SwapSheet";
import { ButtonLink } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { euro } from "@/lib/text/particle";
import { swapPlace } from "@/lib/trip/edit";
import { tripHref, useTripFor } from "@/lib/trip/example";
import { useRealTravel } from "@/lib/trip/real-travel";
import { dayMapLabel, dayMapPoints, dayStopDetails, showStopInList } from "@/lib/trip/map-points";
import { confirmOption, isExampleTrip, saveEditedOption, useConfirmedOption, useEditedOptions } from "@/lib/trip/store";
import type { TripView } from "@/lib/trip/view";
import { useMedia, WIDE } from "@/lib/use-media";

// 창(바꾸기·확정): 휴대폰은 아래에서 올라오고, PC는 가운데 대화창
const PANEL =
  "mx-auto max-h-[85dvh] max-w-[34rem] overflow-y-auto rounded-t-3xl px-5 pb-8 lg:w-[34rem] lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-3xl lg:pb-6 lg:data-[side=bottom]:top-1/2 lg:data-[side=bottom]:right-auto lg:data-[side=bottom]:bottom-auto lg:data-[side=bottom]:left-1/2 lg:data-[side=bottom]:border-t-0";

export function TripScreen() {
  const { id } = useParams<{ id: string }>();
  const trip = useTripFor(id);
  if (trip === undefined) return null;
  if (trip === null) {
    return (
      <main className="mx-auto flex w-full max-w-[30rem] flex-1 flex-col gap-4 px-5 pt-4 pb-7">
        <TopBar backHref="/" backLabel="처음 화면으로" />
        <h1 className="mt-8 text-title font-bold">만든 일정이 없어요</h1>
        <p className="text-base text-ink-sub">일정은 이 탭에서만 보관해요. 조건을 고르고 다시 만들어 주세요.</p>
        <ButtonLink href="/plan/when">일정 만들기</ButtonLink>
        <ButtonLink href="/trip/example" variant="outline">
          예시 루트 먼저 보기
        </ButtonLink>
      </main>
    );
  }
  return <TripResult trip={trip} />;
}

function TripResult({ trip: base }: { trip: TripView }) {
  const confirmedId = useConfirmedOption(base);
  const edited = useEditedOptions(base);
  // 화면에는 장소를 바꾼 안을 보여준다(원래 안은 base에 그대로: 되돌리기·이유에 쓴다)
  const trip: TripView = { ...base, options: base.options.map((o) => edited[o.id] ?? o) };
  const params = useSearchParams();
  const swapParam = params.get("swap");
  const [selected, setSelected] = useState(confirmedId ?? trip.options[0]?.id);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [swapFor, setSwapFor] = useState<string | null>(swapParam && base.placeData[swapParam] ? swapParam : null);
  // 주소의 ?swap=은 한 번만 쓴다(새로고침해도 창이 다시 열리지 않게)
  useEffect(() => {
    if (swapParam) window.history.replaceState(null, "", window.location.pathname);
  }, [swapParam]);
  const [notice, setNotice] = useState("");
  // 안을 바꿀 때는 눈에 보이는 배너 없이 화면 읽기 프로그램에만 알린다(화면은 그 일정으로 내려간다)
  const [announce, setAnnounce] = useState("");
  const option = trip.options.find((o) => o.id === selected) ?? trip.options[0];
  const real = useRealTravel(base, trip.options);
  const shownTrip: TripView = { ...trip, options: real };
  const shown = real.find((o) => o.id === option.id) ?? option;
  const example = isExampleTrip(base);
  const finalHref = `${tripHref(base)}/final`;
  const [dayIndex, setDayIndex] = useState(0);
  const day = Math.min(dayIndex, option.days.length - 1);
  const wide = useMedia(WIDE);
  // 지도는 점의 내용(장소·순서·좌표)이 바뀔 때만 다시 그린다
  const points = dayMapPoints(base, option, day);
  const [focus, setFocus] = useState<{ id: string; n: number } | null>(null);
  const mapBox = useRef<HTMLDivElement>(null);
  // 일정 카드의 번호 → 지도로(휴대폰은 지도까지 올라가서) 그 장소 카드를 연다
  const showOnMap = (placeId: string) => {
    const d = shown.days.findIndex((x) => x.items.some((it) => it.kind === "visit" && it.placeId === placeId));
    if (d >= 0 && d !== day) setDayIndex(d);
    setFocus((f) => ({ id: placeId, n: (f?.n ?? 0) + 1 }));
    if (!wide) mapBox.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
  };
  const map = (
    <div ref={mapBox}>
      <TripMap
        points={points}
        label={dayMapLabel(base, option, day)}
        details={dayStopDetails(trip, shown, day)}
        onPick={showStopInList}
        focus={focus}
        className={wide ? "h-[calc(100dvh-7rem)] max-h-[56rem] min-h-[28rem]" : "h-64 md:h-80"}
      />
    </div>
  );

  const swap = (fromId: string, toId: string): string | null => {
    const r = swapPlace(base, option, fromId, toId);
    if (!r.ok) return r.reason;
    saveEditedOption(base, r.option);
    setSwapFor(null);
    setNotice(`${trip.places[fromId].name} 대신 ${euro(trip.places[toId].name)} 바꿨어요. 시각을 다시 계산했어요.`);
    return null;
  };
  const isConfirmed = confirmedId === option.id;
  const detailRef = useRef<HTMLElement>(null);
  const pick = (id: string) => {
    if (id === selected) return;
    setSelected(id);
    setDayIndex(0);
    setNotice("");
    setAnnounce(`${id}안 일정을 보여 드려요.`);
    // 모바일(한 줄 배치)에서는 바뀐 일정 제목으로 내려간다. 움직임 줄이기 설정이면 바로 이동
    if (window.matchMedia("(max-width: 1023px)").matches) {
      const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" }));
    }
  };

  const confirm = () => {
    confirmOption(trip, option.id);
    setSheetOpen(true);
  };

  return (
    <main className="mx-auto w-full max-w-[34rem] flex-1 pb-28 md:max-w-[48rem] lg:max-w-[72rem] lg:pb-12 xl:max-w-[96rem]">
      <div className="px-5 pt-4">
        <TopBar backHref={example ? "/" : "/plan/taste"} backLabel={example ? "처음 화면으로" : "조건 화면으로"} />
      </div>
      {example && <ExampleBanner />}
      <p role="status" className="sr-only">
        {announce}
      </p>

      <div className="lg:grid lg:grid-cols-[23rem_minmax(0,1fr)] lg:gap-8 lg:px-5 xl:grid-cols-[22rem_minmax(0,1fr)_minmax(0,1fr)]">
        {/* 왼쪽(PC) / 위(모바일): 요약 · 안 고르기 · 정하기(PC) */}
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <Summary trip={trip} />
          {trip.options.length > 1 && <OptionPicker trip={shownTrip} selected={option.id} confirmedId={confirmedId} onSelect={pick} />}
          <div className="mt-4 hidden lg:block">
            <ConfirmButton confirmed={isConfirmed} onConfirm={confirm} optionId={option.id} single={trip.options.length === 1} finalHref={finalHref} />
          </div>
        </aside>

        {/* 오른쪽(PC) / 아래(모바일): 고른 안 */}
        <section key={option.id} ref={detailRef} className="scroll-mt-4 animate-rise" aria-label={`${option.title} 일정`}>
          <div role="status" className="px-5 lg:px-0">
            {notice && (
              <p className="mt-5 flex animate-rise items-center gap-2 rounded-2xl bg-primary-soft py-1 pr-1 pl-4 text-base text-primary-ink">
                <CircleCheck size={20} className="shrink-0" aria-hidden="true" />
                <span className="flex-1 py-2">{notice}</span>
                <button
                  type="button"
                  onClick={() => setNotice("")}
                  aria-label="안내 닫기"
                  className="flex size-touch shrink-0 items-center justify-center rounded-xl transition-colors hover:bg-white/60"
                >
                  <X size={20} aria-hidden="true" />
                </button>
              </p>
            )}
          </div>
          <OptionDetail o={shown} trip={trip} onSwap={setSwapFor} onMap={showOnMap} day={day} onDay={setDayIndex} map={wide ? null : map} />
          <Footnotes trip={trip} estimated={shown.days.some((d) => d.estimated)} />
        </section>

        {/* 넓은 PC: 오른쪽 지도 칸(스크롤해도 고정) */}
        {wide && (
          <div className="sticky top-4 self-start pt-6" aria-label="고른 일정 지도" role="region">
            {map}
          </div>
        )}
      </div>

      {/* 모바일: 아래 고정 확정 버튼 */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white/95 px-5 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
        <div className="mx-auto max-w-[30rem]">
          <ConfirmButton confirmed={isConfirmed} onConfirm={confirm} optionId={option.id} single={trip.options.length === 1} finalHref={finalHref} />
        </div>
      </div>

      <Sheet open={swapFor !== null} onOpenChange={(v) => !v && setSwapFor(null)}>
        <SheetContent side="bottom" className={PANEL}>
          {swapFor && <SwapSheet key={swapFor} placeId={swapFor} o={option} trip={trip} onSwap={swap} onClose={() => setSwapFor(null)} />}
        </SheetContent>
      </Sheet>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className={PANEL}>
          <ConfirmSheet o={option} trip={trip} onChange={() => setSheetOpen(false)} />
        </SheetContent>
      </Sheet>
    </main>
  );
}
