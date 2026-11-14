"use client";

// 확정 일정: 정한 안 하나와 지도만(다른 안·비교·설계 과정은 뺀다). 장소를 바꿨으면 바꾼 일정으로 보여준다.
// 모바일: 위 지도 + 아래 일정, PC: 왼쪽 지도 + 오른쪽 일정. 지도 경로선은 열 때마다 받고 저장하지 않는다.
// 시각은 모두 코드가 계산한 값(이동시간은 열 때 받은 카카오 실제 값, 못 받으면 직선거리 어림, 저장 안 함)이고, 경로선은 "일반 차량 경로"다.
import { ArrowLeft, CircleCheck, Printer } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ScrollTop } from "@/components/ScrollTop";
import { TopBar } from "@/components/TopBar";
import { TripMap } from "@/components/map/TripMap";
import { Checklist } from "@/components/trip/Checklist";
import { DayWeather } from "@/components/trip/DayWeather";
import { DayList } from "@/components/trip/FinalDayList";
import { PrintSheet } from "@/components/trip/PrintSheet";
import { ShareButton } from "@/components/trip/ShareButton";
import { Button, ButtonLink } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDay, formatRange, nightsBetween, tripLabel } from "@/lib/plan/dates";
import { tripHref, useTripFor } from "@/lib/trip/example";
import { useRealTravel } from "@/lib/trip/real-travel";
import { dayMapLabel, dayMapPoints, dayStopDetails, showStopInList } from "@/lib/trip/map-points";
import { callPlaces, onSiteByPlace } from "@/lib/trip/questions";
import { useConfirmedOption, useEditedOptions } from "@/lib/trip/store";
import type { OptionView, TripView } from "@/lib/trip/view";
import { useWeather } from "@/lib/weather/use-weather";

export function FinalScreen() {
  const { id } = useParams<{ id: string }>();
  const trip = useTripFor(id);
  if (trip === undefined) return null;
  if (trip === null) return <Empty text="만든 일정이 없어요" body="일정은 이 탭에서만 보관해요. 조건을 고르고 다시 만들어 주세요." href="/plan/when" cta="일정 만들기" />;
  return <Final trip={trip} />;
}

function Empty({ text, body, href, cta, back = "/trip/new" }: { text: string; body: string; href: string; cta: string; back?: string }) {
  return (
    <main className="mx-auto flex w-full max-w-[30rem] flex-1 flex-col gap-4 px-5 pt-4 pb-7">
      <TopBar backHref={back} backLabel="일정 비교 화면으로" />
      <h1 className="mt-8 text-title font-bold">{text}</h1>
      <p className="text-base text-ink-sub">{body}</p>
      <ButtonLink href={href}>{cta}</ButtonLink>
    </main>
  );
}

function Final({ trip }: { trip: TripView }) {
  const confirmedId = useConfirmedOption(trip);
  const edited = useEditedOptions(trip);
  const base = trip.options.find((o) => o.id === confirmedId);
  if (!base) return <Empty text="아직 정한 일정이 없어요" body="일정 비교 화면에서 마음에 드는 안을 골라 '이 일정으로 정하기'를 눌러 주세요." href={tripHref(trip)} back={tripHref(trip)} cta="일정 고르러 가기" />;
  return <FinalOption trip={trip} o={edited[base.id] ?? base} />;
}

/** shared: 공유 링크로 연 읽기 전용(다른 안 보기·공유·전화 결과 기록 없음). until = 열려 있는 마지막 날 */
export function FinalOption({ trip, o: kept, shared }: { trip: TripView; o: OptionView; shared?: { until: string; link?: string } }) {
  // 보관된 안(추정 시각) → 열 때 받은 실제 이동시간으로 다시 계산해 보여준다(저장 안 함)
  const [o] = useRealTravel(trip, [kept]);
  // 날씨는 열 때 받아 화면 메모리에만 둔다(저장 안 함). 못 받으면 날씨 줄만 빠진다
  const weather = useWeather();
  const [dayIndex, setDayIndex] = useState(0);
  const day = o.days[dayIndex] ?? o.days[0];
  // 날짜·장소가 바뀔 때만 새 배열 → 그때만 지도를 다시 그린다
  const points = useMemo(() => dayMapPoints(trip, o, dayIndex), [trip, o, dayIndex]);
  const mapLabel = dayMapLabel(trip, o, dayIndex);
  const nights = trip.input.startDate && trip.input.endDate ? nightsBetween(trip.input.startDate, trip.input.endDate) : 0;
  const callSet = new Set(callPlaces(o));
  const onSite = onSiteByPlace(o);

  return (
    <>
    {/* 인쇄·PDF: 화면 배치 대신 A4 1~2장짜리 일정표만 */}
    <PrintSheet trip={trip} o={o} link={shared?.link} />
    <main className="mx-auto w-full max-w-[34rem] flex-1 pb-10 md:max-w-[48rem] lg:max-w-[76rem] xl:max-w-[88rem] print:hidden">
      <div className="px-5 pt-4 print:hidden">
        {shared ? <TopBar backHref="/" backLabel="이음길 처음 화면으로" /> : <TopBar backHref={tripHref(trip)} backLabel="일정 비교 화면으로" />}
      </div>

      <header className="animate-rise px-5 pt-5">
        <div className={`flex flex-wrap items-center gap-2 print:hidden ${shared ? "justify-end" : "justify-between"}`}>
          {!shared && (
            <Link href={tripHref(trip)} className="inline-flex min-h-touch items-center gap-1.5 text-base font-medium text-primary-ink underline-offset-4 hover:underline">
              <ArrowLeft size={18} aria-hidden="true" />
              다른 안 보기
            </Link>
          )}
          <div className="flex flex-wrap gap-1">
            {!shared && <ShareButton trip={trip} o={kept} />}
            <Button variant="ghost" size="sm" onClick={() => window.print()}>
              <Printer aria-hidden="true" />
              인쇄·PDF로 저장
            </Button>
          </div>
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-sm font-bold text-primary-ink">
          <CircleCheck size={16} aria-hidden="true" />
          {shared ? "공유받은 일정 · 읽기 전용" : "확정한 일정"}
        </p>
        <h1 className="mt-1 text-title font-bold">{o.title}</h1>
        <p className="mt-1 text-base text-ink-sub">
          {trip.input.startDate && trip.input.endDate ? formatRange(trip.input.startDate, trip.input.endDate) : ""} · {tripLabel(nights)} · {o.stats.places}곳
        </p>
      </header>

      {o.days.length > 1 && (
        <Tabs value={day.date} onValueChange={(v) => setDayIndex(Math.max(0, o.days.findIndex((d) => d.date === v)))} className="mt-4 px-5 print:hidden">
          <TabsList className="w-full">
            {o.days.map((d, i) => (
              <TabsTrigger key={d.date} value={d.date} className="flex-col gap-0 font-bold data-active:text-primary-ink">
                {i + 1}일째
                <span className="text-sm font-normal">{formatDay(d.date)}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      <div className="mt-4 lg:grid lg:grid-cols-[minmax(0,1fr)_26rem] lg:gap-8 lg:px-5 xl:grid-cols-[minmax(0,1fr)_30rem]">
        <div className="px-5 lg:sticky lg:top-4 lg:self-start lg:px-0 print:hidden">
          <TripMap
            key={dayIndex}
            points={points}
            label={mapLabel}
            details={dayStopDetails(trip, o, dayIndex)}
            onPick={showStopInList}
            className="h-72 md:h-96 lg:h-[calc(100dvh-14rem)] lg:min-h-[28rem]"
          />
        </div>

        <div className="px-5 lg:px-0">
          {o.days.map((d, i) => (
            <section key={d.date} className={i === dayIndex ? "animate-rise" : "hidden print:block"} aria-label={`${i + 1}일째 일정`}>
              {o.days.length > 1 && (
                <h2 className={`mb-2 text-lg font-bold ${i === dayIndex ? "hidden print:block" : ""}`}>
                  {i + 1}일째 · {formatDay(d.date)}
                </h2>
              )}
              <DayWeather d={d} trip={trip} weather={weather} />
              <DayList d={d} trip={trip} calls={callSet} onSite={onSite} />
            </section>
          ))}
          <Checklist o={o} trip={trip} readOnly={!!shared} />
          <section className="mt-8 flex flex-col gap-1.5 text-sm leading-normal text-ink-sub">
            <p>지도의 선은 일반 차량 경로예요. 휠체어 안전 경로를 뜻하지 않아요.</p>
            <p>
              {o.days.some((d) => d.estimated) ? "일정의 이동 시간은 카카오 차량 길찾기 값이고, 받지 못한 구간은 직선거리 추정치예요." : "일정의 이동 시간은 카카오 차량 길찾기 값이에요(열 때마다 새로 받아요)."} 이
              {shared ? `공유 링크는 ${shared.until}까지 열려요.` : "일정은 이 탭에만 보관돼요."}
            </p>
          </section>
        </div>
      </div>
      <ScrollTop />
    </main>
    </>
  );
}
