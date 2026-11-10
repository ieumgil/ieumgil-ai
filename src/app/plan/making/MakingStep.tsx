"use client";

// 만드는 중: /api/plan 스트림의 단계를 보여주고, 끝나면 결과(/trip/new)로 넘어간다.
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { TopBar } from "@/components/TopBar";
import { ButtonLink, buttonClass } from "@/components/ui/Button";
import { firstIncompleteStep } from "@/lib/plan/progress";
import { usePlan } from "@/lib/plan/store";
import { saveTrip } from "@/lib/trip/store";
import type { TripView } from "@/lib/trip/view";

const STAGES = [
  { id: "rule", label: "조건에 맞는 장소 고르기", sub: "꼭 필요한 조건이 '불가'인 곳과 쉬는 날을 빼요" },
  { id: "judge", label: "AI가 장소마다 판단하기", sub: "관광공사 무장애 정보를 읽고 3번 판단해 맞춰 봐요" },
  { id: "plan", label: "AI가 일정 2~3가지 짜기", sub: "시간은 프로그램이 계산하고, 안 맞으면 AI가 다시 고쳐요" },
  { id: "review", label: "일정 점검하기", sub: "피로도·시간 여유·취향을 점검해요" },
] as const;
type StageId = (typeof STAGES)[number]["id"] | "done";

const subscribeNoop = () => () => {};

export function MakingStep() {
  const plan = usePlan();
  const hydrated = useSyncExternalStore(subscribeNoop, () => true, () => false);
  const router = useRouter();
  const started = useRef(false);
  const [stage, setStage] = useState<StageId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const missing = hydrated ? firstIncompleteStep(plan, 4) : null;

  useEffect(() => {
    if (!hydrated || missing || started.current) return;
    started.current = true;
    const t0 = Date.now();
    const timer = setInterval(() => setElapsed(Math.round((Date.now() - t0) / 1000)), 1000);
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
            const ev = JSON.parse(line) as { stage: StageId | "error"; trip?: TripView; message?: string };
            if (ev.stage === "error") throw new Error(ev.message);
            setStage(ev.stage);
            if (ev.stage === "done" && ev.trip) {
              saveTrip(ev.trip);
              router.replace("/trip/new");
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
    setElapsed(0);
    setAttempt((a) => a + 1);
  };

  const current = stage === "done" ? STAGES.length : STAGES.findIndex((s) => s.id === stage);

  return (
    <main className="mx-auto flex w-full max-w-[30rem] flex-1 flex-col px-5 pt-4 pb-7">
      <TopBar backHref="/plan/taste" backLabel="이전 단계로" />
      <h1 className="mt-8 text-[1.75rem] leading-[1.35] font-bold">{error ? "일정을 만들지 못했어요" : "일정을 만들고 있어요"}</h1>
      {missing ? (
        <div className="mt-6 flex flex-col gap-4">
          <p className="text-base text-ink-sub">앞 단계 &lsquo;{missing.name}&rsquo;에서 아직 고르지 않은 항목이 있어요.</p>
          <ButtonLink href={missing.href}>채우러 가기</ButtonLink>
        </div>
      ) : error ? (
        <div className="mt-6 flex flex-col gap-4">
          <p className="rounded-xl bg-blocked-bg px-4 py-3 text-base text-blocked-ink" role="alert">
            <span aria-hidden="true" className="font-bold">
              ✕{" "}
            </span>
            {error}
          </p>
          <button type="button" onClick={retry} className={buttonClass("primary")}>
            다시 만들기
          </button>
        </div>
      ) : (
        <>
          <p className="mt-2 text-base text-ink-sub" aria-live="polite">
            보통 20~40초 걸려요 · {elapsed}초
          </p>
          <ol className="mt-6 flex flex-col gap-3" aria-label="진행 단계">
            {STAGES.map((s, i) => {
              const state = i < current ? "done" : i === current ? "now" : "todo";
              return (
                <li key={s.id} className={`flex items-start gap-3 rounded-2xl p-4 ${state === "now" ? "bg-primary-soft" : "bg-surface"}`} aria-current={state === "now" ? "step" : undefined}>
                  <span
                    className={`flex size-8 shrink-0 items-center justify-center rounded-full text-base font-bold ${state === "done" ? "bg-primary text-white" : state === "now" ? "border-2 border-primary bg-white text-primary" : "bg-white text-ink-sub"}`}
                    aria-hidden="true"
                  >
                    {state === "done" ? "✓" : i + 1}
                  </span>
                  <span className="flex flex-col gap-0.5">
                    <span className="text-[1.0625rem] font-bold">
                      {s.label}
                      <span className="sr-only">{state === "done" ? " (끝남)" : state === "now" ? " (하는 중)" : " (대기)"}</span>
                    </span>
                    <span className="text-sm leading-normal text-ink-sub">{s.sub}</span>
                  </span>
                </li>
              );
            })}
          </ol>
          <p className="mt-6 text-sm leading-normal text-ink-sub">이름·연락처는 보내지 않아요. 고른 조건만 일정 계산에 써요.</p>
        </>
      )}
    </main>
  );
}
