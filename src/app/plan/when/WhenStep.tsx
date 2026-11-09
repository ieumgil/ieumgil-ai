"use client";

// 1단계 언제, 어디서 (시안 When.dc.html)
import { Calendar } from "@/components/plan/Calendar";
import { ChoiceButton, CheckRow } from "@/components/plan/choices";
import { Section, StepFooter, StepShell } from "@/components/plan/StepShell";
import { formatRange, tripLabel } from "@/lib/plan/dates";
import { missingWhen, nightsOf } from "@/lib/plan/progress";
import { updatePlan, usePlan } from "@/lib/plan/store";
import { ARRIVAL_POINTS, type LodgingRegion, type Transport } from "@/lib/plan/types";

const START_TIMES = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00"];
const END_TIMES = ["14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00"];
const TRANSPORTS: { id: Transport; label: string }[] = [
  { id: "car", label: "자가용·렌터카" },
  { id: "taxi", label: "택시" },
];
const LODGINGS: LodgingRegion[] = ["강릉", "속초", "동해", "미정"];

const selectClass =
  "h-12 w-full rounded-xl border-[1.5px] border-surface bg-surface px-3 text-base text-ink focus-visible:outline-3 focus-visible:outline-primary";

export function WhenStep() {
  const plan = usePlan();
  const nights = nightsOf(plan);
  const missing = missingWhen(plan);
  const arrivalLabel = ARRIVAL_POINTS.find((a) => a.id === plan.arrival)?.label;
  const sameDay = nights === 0;

  return (
    <StepShell
      step={1}
      backHref="/"
      title="언제 여행하나요?"
      description="가는 날과 오는 날을 눌러 주세요. 하루만 누르면 당일 여행이에요."
      footer={
        <StepFooter
          nextHref="/plan/who"
          nextLabel="다음 · 누구와 가나요"
          blockedLabel={missing[0] ?? null}
        />
      }
    >
      <Calendar
        start={plan.startDate}
        end={plan.endDate}
        onChange={({ start, end }) => updatePlan({ startDate: start, endDate: end })}
      />

      <div
        className={`mx-5 mt-3 flex items-center justify-between gap-2 rounded-[0.875rem] px-4 py-3.5 ${
          nights === null ? "bg-surface text-ink-sub" : "bg-primary text-white"
        }`}
        aria-live="polite"
      >
        {plan.startDate && plan.endDate && nights !== null ? (
          <>
            <span className="text-base font-medium">{formatRange(plan.startDate, plan.endDate)}</span>
            <span className="shrink-0 text-lg font-bold">{tripLabel(nights)}</span>
          </>
        ) : (
          <span className="text-base">아직 날짜를 고르지 않았어요</span>
        )}
      </div>

      <Section title="영동에 어디로 도착하나요?" hint="서울에서 오는 시간은 빼고, 도착한 곳부터 루트를 짜요.">
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="도착 지점">
          {ARRIVAL_POINTS.map((a) => (
            <ChoiceButton
              key={a.id}
              role="radio"
              selected={plan.arrival === a.id}
              onClick={() =>
                // 떠나는 곳을 같은 곳으로 따로 골라 뒀다면 '도착한 곳과 같음'으로 되돌린다
                updatePlan((cur) => ({ arrival: a.id, departure: cur.departure === a.id ? "same" : cur.departure }))
              }
            >
              {a.label}
            </ChoiceButton>
          ))}
        </div>
      </Section>

      <Section title="무엇으로 이동하나요?">
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="이동수단">
          {TRANSPORTS.map((t) => (
            <ChoiceButton
              key={t.id}
              role="radio"
              shape="tile"
              className="min-h-14 font-medium"
              selected={plan.transport === t.id}
              onClick={() => updatePlan({ transport: t.id })}
            >
              {t.label}
            </ChoiceButton>
          ))}
        </div>
        {plan.transport === "car" && (
          <>
            <CheckRow checked={plan.disabledPermit} onChange={(v) => updatePlan({ disabledPermit: v })}>
              장애인 사용 자동차 표지가 있어요
            </CheckRow>
            <p className="text-sm leading-normal text-ink-sub">
              표지가 있으면 장애인 전용 주차구역이 있는 곳을 우선 확인해요.
            </p>
          </>
        )}
        {plan.transport === "taxi" && (
          <p className="text-sm leading-normal text-ink-sub">
            택시는 입구 앞에서 타고 내린다고 보고, 주차 조건은 확인하지 않아요.
          </p>
        )}
      </Section>

      <div className="grid grid-cols-2 gap-2.5 px-5 pt-6">
        <label className="flex flex-col gap-1.5 text-base font-medium">
          {sameDay ? "시작 시각" : "첫날 시작 시각"}
          <select
            className={selectClass}
            value={plan.startTime}
            onChange={(e) => updatePlan({ startTime: e.target.value })}
          >
            {START_TIMES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-base font-medium">
          {sameDay ? "마치는 시각" : "마지막 날 마치는 시각"}
          <select className={selectClass} value={plan.endTime} onChange={(e) => updatePlan({ endTime: e.target.value })}>
            {END_TIMES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="px-5 pt-3">
        <label className="flex flex-col gap-1.5 text-base font-medium">
          {sameDay ? "어디서 떠나나요?" : "마지막 날 어디서 떠나나요?"}
          <select
            className={selectClass}
            value={plan.departure}
            onChange={(e) => updatePlan({ departure: e.target.value as typeof plan.departure })}
          >
            <option value="same">도착한 곳과 같음{arrivalLabel ? ` (${arrivalLabel})` : ""}</option>
            {ARRIVAL_POINTS.filter((a) => a.id !== plan.arrival).map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {nights !== null && nights > 0 && (
        <Section
          title="숙소는 어느 쪽인가요?"
          hint="둘째 날부터 숙소 근처에서 출발해요. 중간 날은 09:30 출발 ~ 18:00 숙소 도착으로 짜고, 결과에서 바꿀 수 있어요. 숙소 추천은 하지 않아요."
        >
          <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="숙소 지역">
            {LODGINGS.map((l) => (
              <ChoiceButton
                key={l}
                role="radio"
                shape="tile"
                className="px-1"
                selected={plan.lodging === l}
                onClick={() => updatePlan({ lodging: l })}
              >
                {l}
              </ChoiceButton>
            ))}
          </div>
        </Section>
      )}
    </StepShell>
  );
}
