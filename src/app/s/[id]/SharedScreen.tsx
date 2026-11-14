"use client";

// 공유 링크 화면(읽기 전용): 확정 일정 화면을 그대로 쓰되 다른 안 보기·공유·전화 결과 기록은 뺀다.
import { useSyncExternalStore } from "react";
import { FinalOption } from "@/app/trip/[id]/final/FinalScreen";
import { TopBar } from "@/components/TopBar";
import { ButtonLink } from "@/components/ui/button";
import type { TripView } from "@/lib/trip/view";

const noop = () => () => {};

export function SharedScreen({ trip, until }: { trip: TripView; until: string }) {
  // 인쇄한 종이에 이 링크 주소를 적는다(서버에서는 모름 → 화면에서만)
  const link = useSyncExternalStore(noop, () => window.location.href, () => undefined);
  return <FinalOption trip={trip} o={trip.options[0]} shared={{ until, link }} />;
}

const TEXT = {
  없음: { title: "공유 링크를 찾지 못했어요", body: "주소가 맞는지 확인해 주세요. 보낸 사람에게 링크를 다시 받아도 돼요." },
  만료: { title: "공유 기간이 지났어요", body: "공유 링크는 여행이 끝나고 7일 뒤에 자동으로 지워져요. 보낸 사람에게 새 링크를 받아 주세요." },
  오류: { title: "지금은 일정을 불러오지 못했어요", body: "잠시 뒤 다시 열어 주세요." },
} as const;

export function SharedMissing({ reason }: { reason: keyof typeof TEXT }) {
  const t = TEXT[reason];
  return (
    <main className="mx-auto flex w-full max-w-[30rem] flex-1 flex-col gap-4 px-5 pt-4 pb-7">
      <TopBar backHref="/" backLabel="이음길 처음 화면으로" />
      <h1 className="mt-8 text-title font-bold">{t.title}</h1>
      <p className="text-base text-ink-sub">{t.body}</p>
      <ButtonLink href="/">이음길에서 내 일정 만들기</ButtonLink>
    </main>
  );
}
