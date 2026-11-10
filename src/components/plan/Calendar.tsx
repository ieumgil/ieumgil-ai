"use client";

// 여행 날짜 달력(시안 When.dc.html). 지난 날은 고를 수 없고, 최대 2박 3일.
import { useState, useSyncExternalStore } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";
import { MAX_NIGHTS, WEEKDAYS, monthCells, pickDate, todayISO, weekdayOf } from "@/lib/plan/dates";

const noop = () => () => {};
/** 오늘 날짜는 사용자 기기 기준이라 서버에서는 모른다(null) */
function useToday(): string | null {
  return useSyncExternalStore(noop, () => todayISO(), () => null);
}

type YM = { y: number; m: number };
const ymOf = (iso: string): YM => ({ y: Number(iso.slice(0, 4)), m: Number(iso.slice(5, 7)) });
const shift = ({ y, m }: YM, by: number): YM => {
  const idx = y * 12 + (m - 1) + by;
  return { y: Math.floor(idx / 12), m: (idx % 12) + 1 };
};
const cmp = (a: YM, b: YM) => a.y * 12 + a.m - (b.y * 12 + b.m);

export function Calendar({
  start,
  end,
  onChange,
}: {
  start: string | null;
  end: string | null;
  onChange: (range: { start: string; end: string }) => void;
}) {
  const today = useToday();
  const [view, setView] = useState<YM | null>(null);
  const [warn, setWarn] = useState(false);

  if (!today) {
    // 서버 렌더링·첫 화면: 자리만 잡아 둔다
    return <div className="mx-5 mt-4 h-[23rem] rounded-2xl bg-surface" aria-hidden="true" />;
  }

  const shown = view ?? ymOf(start ?? today);
  const min = ymOf(today);
  const max = shift(min, 11);
  const last = end ?? start;

  function pick(day: string) {
    const r = pickDate({ start, end }, day);
    if (r.warning) {
      setWarn(true);
      return;
    }
    setWarn(false);
    onChange({ start: r.start, end: r.end });
  }

  return (
    <div className="mx-5 mt-4 rounded-2xl bg-surface p-4">
      <div className="flex items-center justify-between">
        <MonthButton label="이전 달" disabled={cmp(shown, min) <= 0} onClick={() => setView(shift(shown, -1))}>
          <ChevronLeftIcon size={20} />
        </MonthButton>
        <span className="text-lg font-bold" aria-live="polite">
          {shown.y}년 {shown.m}월
        </span>
        <MonthButton label="다음 달" disabled={cmp(shown, max) >= 0} onClick={() => setView(shift(shown, 1))}>
          <ChevronRightIcon size={20} />
        </MonthButton>
      </div>

      <div className="mt-3 grid grid-cols-7 text-center text-sm text-ink-sub" aria-hidden="true">
        {WEEKDAYS.map((d, i) => (
          <span key={d} className={i === 0 ? "text-sunday" : i === 6 ? "text-primary" : ""}>
            {d}
          </span>
        ))}
      </div>

      <div className="mt-1.5 grid grid-cols-7 gap-y-1">
        {monthCells(shown.y, shown.m).map((day, i) => {
          if (!day) return <div key={`blank-${i}`} className="h-11" />;
          const past = day < today;
          const isEdge = day === start || day === last;
          const inRange = !!start && !!last && start !== last && day >= start && day <= last;
          const band = inRange
            ? `bg-primary-band ${day === start ? "rounded-l-full" : day === last ? "rounded-r-full" : ""}`
            : "";
          const d = Number(day.slice(8));
          return (
            <div key={day} className={`flex h-11 items-center justify-center ${band}`}>
              <button
                type="button"
                disabled={past}
                aria-pressed={isEdge}
                aria-label={`${shown.y}년 ${shown.m}월 ${d}일 ${weekdayOf(day)}요일${day === today ? ", 오늘" : ""}`}
                onClick={() => pick(day)}
                className={`size-touch rounded-full text-base focus-visible:outline-3 focus-visible:outline-primary ${
                  isEdge
                    ? "bg-primary font-bold text-white"
                    : past
                      ? "cursor-not-allowed text-past"
                      : "text-ink hover:bg-white"
                } ${day === today && !isEdge ? "underline underline-offset-4" : ""}`}
              >
                {d}
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-2.5 flex flex-wrap gap-x-3.5 text-sm text-ink-sub">
        <span>회색 날짜는 지난 날이에요</span>
        <span>최대 {MAX_NIGHTS}박 {MAX_NIGHTS + 1}일</span>
      </div>
      {warn && (
        <p className="mt-2 text-sm font-medium text-caution-ink" role="alert">
          이음길은 {MAX_NIGHTS}박 {MAX_NIGHTS + 1}일까지 계획할 수 있어요.
        </p>
      )}
    </div>
  );
}

function MonthButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-touch items-center justify-center rounded-full text-ink hover:bg-white disabled:cursor-not-allowed disabled:text-past disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}
