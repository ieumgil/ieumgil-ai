// 이 일정으로 정하기: 버튼(정했으면 확정 일정으로 가는 링크)과 정한 뒤 뜨는 창(전화로 확인할 곳 수).
import { CircleCheck, ListChecks, Map as MapIcon } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { euro } from "@/lib/text/particle";
import { tripHref } from "@/lib/trip/example";
import { callPlaces, questionsByPlace } from "@/lib/trip/questions";
import { confirmOption } from "@/lib/trip/store";
import type { OptionView, TripView } from "@/lib/trip/view";

/** single: 안이 하나뿐이면 'A안' 대신 '이 일정' */
export function ConfirmButton({ confirmed, onConfirm, optionId, single = false, finalHref }: { confirmed: boolean; onConfirm: () => void; optionId: string; single?: boolean; finalHref: string }) {
  return confirmed ? (
    <ButtonLink href={finalHref} variant="outline" className="w-full">
      <MapIcon aria-hidden="true" />
      정한 일정 · 지도로 보기
    </ButtonLink>
  ) : (
    <Button className="w-full" onClick={onConfirm}>
      <CircleCheck aria-hidden="true" />
      {optionId === "R" || single ? "이 일정으로 정하기" : `${optionId}안 일정으로 정하기`}
    </Button>
  );
}

export function ConfirmSheet({ o, trip, onChange }: { o: OptionView; trip: TripView; onChange: () => void }) {
  const calls = callPlaces(o);
  const qCount = calls.reduce((n, id) => n + (questionsByPlace(o).get(id)?.length ?? 0), 0);
  const quoted = `\u2018${o.title}\u2019${euro(o.title).slice(o.title.length)}`;
  return (
    <>
      <SheetHeader className="px-0 pt-6">
        <SheetTitle className="flex items-center gap-2 pr-12 text-xl font-bold">
          <CircleCheck className="shrink-0 text-primary" aria-hidden="true" />
          {quoted} 정했어요
        </SheetTitle>
        <SheetDescription>정한 일정은 이 탭에 보관돼요. 지도와 함께 다시 볼 수 있어요.</SheetDescription>
      </SheetHeader>
      {calls.length > 0 ? (
        <div className="flex items-start gap-3 rounded-2xl bg-surface p-4">
          <ListChecks size={22} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
          <p className="text-base leading-relaxed">
            <span className="font-bold">출발 전 전화로 확인할 곳 {calls.length}곳</span>
            <span className="text-ink-sub"> (물어볼 것 {qCount}개)</span>
            <br />
            확정 일정 화면에서 장소마다 전화하고, 확인한 곳을 표시할 수 있어요.
          </p>
        </div>
      ) : (
        <p className="rounded-2xl bg-surface p-4 text-base">따로 전화로 확인할 곳은 없어요.</p>
      )}
      <div className="mt-4 flex flex-col gap-2">
        <ButtonLink href={`${tripHref(trip)}/final`}>
          <MapIcon aria-hidden="true" />
          확정 일정 보기
        </ButtonLink>
        <Button variant="secondary" onClick={onChange}>
          닫기
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            confirmOption(trip, null);
            onChange();
          }}
        >
          정한 것 취소하고 다른 일정 보기
        </Button>
      </div>
    </>
  );
}
