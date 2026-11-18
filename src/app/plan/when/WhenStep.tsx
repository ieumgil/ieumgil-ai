"use client";

// 1단계 언제, 어디서 (시안 When.dc.html)
import { useState } from "react";
import { Calendar } from "@/components/plan/Calendar";
import { ChoiceButton, CheckRow } from "@/components/plan/choices";
import { Section, StepFooter, StepShell } from "@/components/plan/StepShell";
import { Disclosure } from "@/components/ui/disclosure";
import { formatRange, tripLabel } from "@/lib/plan/dates";
import { missingWhenFields, nightsOf } from "@/lib/plan/progress";
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
  "min-h-12 w-full rounded-xl border-[1.5px] border-line-control bg-white px-3 text-base text-ink focus-visible:outline-3 focus-visible:outline-primary";
/** 숙소 선택 칸 틀: 칸 폭이 5rem 아래로 줄면 줄바꿈(글자가 커지면 두 줄로) */
const LODGING_GRID = "grid grid-cols-[repeat(auto-fit,minmax(5rem,1fr))] gap-2";

export function WhenStep() {
  const plan = usePlan();
  const nights = nightsOf(plan);
  const missing = missingWhenFields(plan);
  const arrivalLabel = ARRIVAL_POINTS.find((a) => a.id === plan.arrival)?.label;
  const sameDay = nights === 0;
  // 시작·마치는 시각과 떠나는 곳은 기본값이 있어 한 줄 요약 뒤에 접어 둔다(저장된 값을 그대로 보여 준다)
  const [timesOpen, setTimesOpen] = useState(false);
  const departText =
    plan.departure === "same"
      ? "도착한 곳에서 떠나요"
      : `${ARRIVAL_POINTS.find((a) => a.id === plan.departure)?.label ?? "도착한 곳"}에서 떠나요`;

  return (
    <StepShell
      step={1}
      backHref="/"
      title="언제 여행하나요?"
      description="가는 날과 오는 날을 눌러 주세요. 하루만 누르면 당일 여행이고, 2박 3일까지 계획할 수 있어요."
      footer={
        <StepFooter
          nextHref="/plan/who"
          nextLabel="다음 · 누구와 가나요"
          blockedLabel={missing[0]?.text ?? null}
          blockedTarget={missing[0]?.id}
        />
      }
    >
      <div id="field-dates">
        <Calendar
          start={plan.startDate}
          end={plan.endDate}
          onChange={({ start, end }) => updatePlan({ startDate: start, endDate: end })}
        />
      </div>

      <div
        className={`mx-4 mt-3 flex items-center justify-between gap-2 rounded-xl px-4 py-3 md:mx-6 ${
          nights === null ? "bg-surface text-ink-sub" : "bg-primary text-white"
        }`}
        aria-live="polite"
      >
        {plan.startDate && plan.endDate && nights !== null ? (
          <>
            <span className="text-base font-medium">{formatRange(plan.startDate, plan.endDate)}</span>
            <span className="shrink-0 text-base font-medium">{tripLabel(nights)}</span>
          </>
        ) : (
          <span className="text-base">아직 날짜를 고르지 않았어요</span>
        )}
      </div>

      <Section id="field-arrival" title="영동에 어디로 도착하나요?" hint="영동까지 오는 시간은 빼고, 도착한 곳부터 루트를 짜요.">
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

      <Section id="field-transport" title="무엇으로 이동하나요?">
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="이동수단">
          {TRANSPORTS.map((t) => (
            <ChoiceButton
              key={t.id}
              role="radio"
              shape="tile"
              className="min-h-14"
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
            <p className="text-sm text-ink-sub">표지가 있으면 장애인 전용 주차구역도 꼭 필요한 조건으로 확인해요.</p>
          </>
        )}
        {plan.transport === "taxi" && (
          <p className="text-sm text-ink-sub">택시는 입구 앞에서 타고 내린다고 보고, 주차 조건은 확인하지 않아요.</p>
        )}
      </Section>

      <div className="mt-8 px-4 md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="min-w-0 text-base">
            {plan.startTime} 시작 · {plan.endTime} 마침 · {departText}
          </p>
          <button
            type="button"
            aria-expanded={timesOpen}
            aria-controls="when-times"
            aria-label="시각·떠나는 곳 설정 바꾸기"
            onClick={() => setTimesOpen((v) => !v)}
            className="min-h-touch px-1 text-base font-medium text-primary underline underline-offset-4 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            바꾸기
          </button>
        </div>
        <div id="when-times">
          {timesOpen && (
            <div className="mt-4 flex flex-col gap-4">
              <div className="grid grid-cols-[repeat(auto-fit,minmax(10rem,1fr))] gap-3">
                <label className="flex flex-col gap-2 text-base font-medium">
                  {sameDay ? "시작 시각" : "첫날 시작 시각"}
                  <select className={selectClass} value={plan.startTime} onChange={(e) => updatePlan({ startTime: e.target.value })}>
                    {START_TIMES.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-2 text-base font-medium">
                  {sameDay ? "마치는 시각" : "마지막 날 마치는 시각"}
                  <select className={selectClass} value={plan.endTime} onChange={(e) => updatePlan({ endTime: e.target.value })}>
                    {END_TIMES.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="flex flex-col gap-2 text-base font-medium">
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
          )}
        </div>
      </div>

      {nights !== null && nights > 0 && (
        <Section id="field-lodging" title="숙소는 어느 쪽인가요?" hint="숙소 추천은 하지 않아요.">
          {nights > 1 && <h3 className="text-base font-medium text-ink-sub">첫째 밤</h3>}
          <div className={LODGING_GRID} role="radiogroup" aria-label={nights > 1 ? "첫째 밤 숙소 지역" : "숙소 지역"}>
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
          {nights > 1 && (
            <div className="flex animate-rise flex-col gap-2 pt-2">
              <h3 className="text-base font-medium text-ink-sub">둘째 밤</h3>
              <div className={LODGING_GRID} role="radiogroup" aria-label="둘째 밤 숙소 지역">
                <ChoiceButton
                  role="radio"
                  shape="tile"
                  className="col-span-full"
                  selected={plan.lodging2 === "same"}
                  onClick={() => updatePlan({ lodging2: "same" })}
                >
                  첫째 밤과 같음{plan.lodging && plan.lodging !== "미정" ? ` (${plan.lodging})` : ""}
                </ChoiceButton>
                {LODGINGS.map((l) => (
                  <ChoiceButton
                    key={l}
                    role="radio"
                    shape="tile"
                    className="px-1"
                    selected={plan.lodging2 === l}
                    onClick={() => updatePlan({ lodging2: l })}
                  >
                    {l}
                  </ChoiceButton>
                ))}
              </div>
            </div>
          )}
          <Disclosure summary="숙소는 이렇게 짜요">
            <p className="pb-2 text-sm text-ink-sub">
              {nights > 1
                ? "밤마다 고를 수 있어요. 가운데 날은 09:30에 출발해 18:00에 숙소로 돌아와요. 숙소를 옮기면 2일째는 첫째 밤 숙소에서 출발해 둘째 밤 숙소 쪽으로 가며 둘러봐요."
                : "둘째 날은 숙소 근처에서 09:30에 출발해, 마치는 시각까지 둘러봐요."}
            </p>
          </Disclosure>
        </Section>
      )}
    </StepShell>
  );
}
