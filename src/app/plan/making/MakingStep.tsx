"use client";

// 만드는 중: /api/plan 스트림을 받아 AI가 실제로 하는 일을 보여주고, 끝나면 결과(/trip/new)로 넘어간다.
// 보여주는 것: 진행 막대(단계·기록에 따라 차오름) · 단계 4개 · 살펴보는 장소 이름 · 진행 기록(서버가 보낸 문장 그대로)
import { CalendarRange, Check, ClipboardCheck, Loader2, ScanSearch, Sparkles, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { TopBar } from "@/components/TopBar";
import { ButtonLink, buttonClass } from "@/components/ui/button";
import { firstIncompleteStep } from "@/lib/plan/progress";
import { usePlan } from "@/lib/plan/store";
import { saveTrip } from "@/lib/trip/store";
import type { TripView } from "@/lib/trip/view";

type StageId = "rule" | "judge" | "plan" | "review" | "done";
type Tone = "info" | "ok" | "fix";
type Event = { stage: Exclude<StageId, "done"> } | { stage: "log"; text: string; tone: Tone } | { stage: "candidates"; names: string[] } | { stage: "error"; message?: string } | { stage: "done"; trip: TripView };

const STAGES: { id: Exclude<StageId, "done">; label: string; sub: string; icon: ReactNode; from: number; to: number }[] = [
  { id: "rule", label: "조건에 맞는 장소 고르기", sub: "꼭 필요한 조건이 '불가'인 곳과 쉬는 날을 빼요", icon: <ScanSearch size={20} />, from: 0, to: 12 },
  { id: "judge", label: "AI가 장소마다 판단하기", sub: "관광공사 무장애 정보를 읽고 3번 판단해 맞춰 봐요", icon: <Sparkles size={20} />, from: 12, to: 50 },
  { id: "plan", label: "AI가 일정 2~3가지 짜기", sub: "시간은 프로그램이 계산하고, 안 맞으면 AI가 고쳐요", icon: <CalendarRange size={20} />, from: 50, to: 84 },
  { id: "review", label: "일정 점검하기", sub: "피로도·시간 여유·취향을 점검해요", icon: <ClipboardCheck size={20} />, from: 84, to: 97 },
];

const subscribeNoop = () => () => {};
/** 이만큼 지나도 안 끝나면 '늦어요' 안내(서버 전체 한도는 90초) */
const SLOW_SEC = 40;
/** 살펴보는 장소 이름은 이만큼만 보이고 나머지는 '외 n곳' */
const NAMES_SHOWN = 8;

export function MakingStep() {
  const plan = usePlan();
  const hydrated = useSyncExternalStore(subscribeNoop, () => true, () => false);
  const router = useRouter();
  const started = useRef(false);
  const [stage, setStage] = useState<StageId | null>(null);
  const [logs, setLogs] = useState<{ id: number; text: string; tone: Tone }[]>([]);
  const [names, setNames] = useState<string[]>([]);
  const [target, setTarget] = useState(2);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const missing = hydrated ? firstIncompleteStep(plan, 4) : null;

  // 진행 막대: 목표값까지 부드럽게 따라가고, 기다리는 동안에도 그 단계 끝 직전까지 천천히 차오른다(멈춘 화면처럼 보이지 않게)
  useEffect(() => {
    const id = setInterval(() => {
      const ceiling = stage && stage !== "done" ? STAGES.find((s) => s.id === stage)!.to - 1 : 100;
      setProgress((p) => {
        const goal = Math.max(target, Math.min(ceiling, p + 0.25));
        return p + (goal - p) * 0.12;
      });
    }, 120);
    return () => clearInterval(id);
  }, [stage, target]);

  useEffect(() => {
    if (!hydrated || missing || started.current) return;
    started.current = true;
    const t0 = Date.now();
    const timer = setInterval(() => setElapsed(Math.round((Date.now() - t0) / 1000)), 1000);
    let n = 0;
    const push = (text: string, tone: Tone) => setLogs((l) => [...l, { id: n++, text, tone }]);
    (async () => {
      try {
        const res = await fetch("/api/plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(plan) });
        if (!res.ok || !res.body) {
          const msg = await res.json().catch(() => ({ message: "일정을 만들지 못했어요" }));
          throw new Error(msg.message);
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            const ev = JSON.parse(line) as Event;
            if (ev.stage === "error") throw new Error(ev.message);
            if (ev.stage === "log") {
              push(ev.text, ev.tone);
              if (ev.tone === "ok") setTarget((t) => t + 6);
              continue;
            }
            if (ev.stage === "candidates") {
              setNames(ev.names);
              continue;
            }
            setStage(ev.stage);
            if (ev.stage === "done") {
              setTarget(100);
              saveTrip(ev.trip);
              setTimeout(() => router.replace("/trip/new"), 450);
            } else {
              setTarget((t) => Math.max(t, STAGES.find((s) => s.id === ev.stage)!.from + 2));
            }
          }
        }
      } catch (err) {
        setError((err as Error).message || "일정을 만들지 못했어요");
      } finally {
        clearInterval(timer);
      }
    })();
  }, [hydrated, missing, plan, router, attempt]);

  const retry = () => {
    started.current = false;
    setError(null);
    setStage(null);
    setLogs([]);
    setNames([]);
    setTarget(2);
    setProgress(0);
    setElapsed(0);
    setAttempt((a) => a + 1);
  };

  const current = stage === "done" ? STAGES.length : STAGES.findIndex((s) => s.id === stage);
  const pct = Math.min(100, Math.round(progress));
  const latest = logs.at(-1)?.text;
  const earlier = stage === "done" ? logs : logs.slice(0, -1);

  return (
    <main className="mx-auto flex w-full max-w-[30rem] flex-1 flex-col px-5 pt-4 pb-7 md:max-w-[40rem] lg:max-w-[52rem]">
      <TopBar backHref="/plan/taste" backLabel="이전 단계로" />
      {missing ? (
        <div className="mt-8 flex flex-col gap-4">
          <h1 className="font-heading text-title font-bold text-balance">앞 단계를 먼저 채워 주세요</h1>
          <p className="text-base text-ink-sub">&lsquo;{missing.name}&rsquo;에서 아직 고르지 않은 항목이 있어요.</p>
          <ButtonLink href={missing.href}>채우러 가기</ButtonLink>
        </div>
      ) : error ? (
        <div className="mt-8 flex flex-col gap-4">
          <h1 className="font-heading text-title font-bold text-balance">일정을 만들지 못했어요</h1>
          <p className="flex items-start gap-2 rounded-xl bg-blocked-bg px-4 py-3 text-base text-blocked-ink" role="alert">
            <TriangleAlert size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
            {error}
          </p>
          <button type="button" onClick={retry} className={buttonClass("primary")}>
            다시 만들기
          </button>
        </div>
      ) : (
        <>
          {/* PC(1024px~)도 한 칸에 시선을 모은다: 세로 가운데, 단계는 가로 한 줄, 장소 이름은 칸 전체 폭 */}
          <div className="flex flex-1 flex-col lg:justify-center lg:pb-6">
            <section className="mt-6 lg:mt-0 lg:text-center" aria-label="진행 상황">
              <h1 className="font-heading text-title font-bold text-balance">{stage === "done" ? "일정이 나왔어요" : "AI가 일정을 만들고 있어요"}</h1>
              <p className="mt-1.5 min-h-[1.5rem] text-base text-ink-sub lg:mt-2" aria-live="polite">
                {latest ?? "조건을 확인하고 있어요"}
              </p>
              <div className="mt-4 flex items-center gap-3 lg:mt-6">
                <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-line lg:h-3" role="progressbar" aria-label="전체 진행" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
                  <div className="h-full rounded-full bg-primary transition-[width] duration-[var(--motion-medium)] ease-[var(--ease-state)]" style={{ width: `${pct}%` }} />
                </div>
                <span className="w-12 text-right text-base font-medium tabular-nums text-primary-ink">{pct}%</span>
              </div>
              <p className="mt-1.5 text-sm text-ink-sub lg:mt-2">보통 10~40초 걸려요 · {elapsed}초 지남</p>
              {elapsed >= SLOW_SEC && stage !== "done" && !error && (
                <div role="status" className="mt-3 rounded-2xl bg-caution-bg px-4 py-3 text-left text-base leading-normal text-caution-ink">
                  <p className="flex items-start gap-2">
                    <TriangleAlert size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
                    <span>AI 응답이 평소보다 늦어요. 늦어도 1분 30초 안에는 일정을 보여 드려요.</span>
                  </p>
                  <a
                    href="/trip/example"
                    target="_blank"
                    rel="noopener"
                    className="mt-1 inline-flex min-h-touch items-center gap-1 font-medium underline underline-offset-4"
                  >
                    기다리는 동안 예시 일정 보기(새 탭)
                  </a>
                </div>
              )}
            </section>

            <ol className="mt-6 flex flex-col gap-2 lg:mt-8 lg:grid lg:grid-cols-4 lg:gap-3" aria-label="진행 단계">
              {STAGES.map((s, i) => {
                const state = i < current ? "done" : i === current ? "now" : "todo";
                return (
                  <li
                    key={s.id}
                    className={`flex items-center gap-3 rounded-2xl px-4 py-3 transition-colors duration-[var(--motion-medium)] ease-[var(--ease-state)] lg:flex-col lg:justify-start lg:gap-2.5 lg:px-3 lg:py-5 lg:text-center ${state === "now" ? "bg-primary-soft" : state === "done" ? "bg-white ring-1 ring-line" : "bg-surface"}`}
                    aria-current={state === "now" ? "step" : undefined}
                  >
                    <span
                      className={`flex size-10 shrink-0 items-center justify-center rounded-full transition-colors duration-[var(--motion-medium)] ease-[var(--ease-state)] lg:size-12 ${state === "done" ? "bg-primary text-white" : state === "now" ? "bg-white text-primary ring-2 ring-primary" : "bg-white text-ink-sub"}`}
                      aria-hidden="true"
                    >
                      {state === "done" ? <Check size={20} strokeWidth={3} /> : state === "now" ? <Loader2 size={20} className="animate-spin" /> : s.icon}
                    </span>
                    <span className="flex min-w-0 flex-col lg:items-center">
                      <span className={`text-base font-medium ${state === "todo" ? "text-ink-sub" : "text-ink"}`}>
                        {s.label}
                        <span className="sr-only">{state === "done" ? " (끝남)" : state === "now" ? " (하는 중)" : " (대기)"}</span>
                      </span>
                      {state === "now" && <span className="text-sm leading-normal text-ink-sub">{s.sub}</span>}
                    </span>
                  </li>
                );
              })}
            </ol>

            {names.length > 0 && (
              <section className="mt-5 lg:mt-8" aria-label="AI가 살펴보는 장소">
                <h2 className="text-sm font-bold text-ink-sub">AI가 살펴보는 장소 {names.length}곳</h2>
                {/* 흐르는 띠(무한 반복 움직임)는 뺐다(11/18 모션 정리): 이름을 제자리에 두고 많으면 '외 n곳' */}
                <ul className="mt-2 flex flex-wrap gap-2">
                  {names.slice(0, NAMES_SHOWN).map((n) => (
                    <li key={n} className="rounded-full bg-surface px-3 py-1.5 text-sm whitespace-nowrap text-ink">
                      {n}
                    </li>
                  ))}
                  {names.length > NAMES_SHOWN && <li className="px-1 py-1.5 text-sm text-ink-sub">외 {names.length - NAMES_SHOWN}곳</li>}
                </ul>
              </section>
            )}

            {/* 지금 하는 일은 위 제목 아래 한 줄에 있으니, 기록에는 그 앞의 일만(끝나면 전부) */}
            {earlier.length > 0 && (
              <section className="mt-5 lg:mt-6" aria-label="진행 기록">
                <h2 className="text-sm font-bold text-ink-sub">진행 기록</h2>
                <ol className="mt-2 flex flex-col gap-1.5">
                  {earlier.slice(-5).map((l) => (
                    <li key={l.id} className="flex items-start gap-2 text-base leading-snug">
                      <span className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-sm font-medium ${l.tone === "ok" ? "bg-primary-soft text-primary-ink" : l.tone === "fix" ? "bg-caution-bg text-caution-ink" : "bg-surface text-ink-sub"}`} aria-hidden="true">
                        {l.tone === "ok" ? "✓" : l.tone === "fix" ? "!" : "·"}
                      </span>
                      <span className={l.tone === "fix" ? "text-caution-ink" : "text-ink"}>{l.text}</span>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            <p className="mt-auto pt-6 text-sm leading-normal text-ink-sub lg:mt-8 lg:pt-0">이름·연락처는 보내지 않아요. 고른 조건만 일정 계산에 써요.</p>
          </div>
        </>
      )}
    </main>
  );
}

