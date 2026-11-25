// 입력 단계 진행 표시(11/25, 단계 4): '2 / 4 단계 · 누구와' 글자 + 점 4개를 1px 점선으로 잇는다(청양 1박2일 코스의 일차 줄과 같은 문법).
// 지난 단계는 작은 파랑 점, 지금 단계는 큰 파랑 점 + 흰 고리, 남은 단계는 흰 점 + 파랑 테두리. 입력 단계라 파랑만 쓴다(초록 금지).
// 움직이지 않는다(단계마다 다른 화면이라 점이 바로 바뀜). 서버·클라이언트 어디서나 그릴 수 있게 훅을 쓰지 않는다.
import { Fragment } from "react";
import { STEPS } from "@/lib/plan/progress";

export function StepTrail({ step }: { step: 1 | 2 | 3 | 4 }) {
  const name = STEPS[step - 1].name;
  return (
    <div
      role="progressbar"
      aria-label="입력 진행"
      aria-valuemin={1}
      aria-valuemax={4}
      aria-valuenow={step}
      aria-valuetext={`${step}단계 / 4단계 · ${name}`}
      className="w-[min(100%,20rem)]"
    >
      <p className="text-sm text-ink-sub" aria-hidden="true">
        {step} / 4 단계 · <span className="font-medium text-ink">{name}</span>
      </p>
      <div className="mt-2 flex items-center gap-2" aria-hidden="true">
        {STEPS.map((s, i) => {
          const n = i + 1;
          return (
            <Fragment key={s.href}>
              {i > 0 && <span className={`h-0 flex-1 border-t border-dashed ${n <= step ? "border-primary" : "border-line-control"}`} />}
              {n < step ? (
                <span className="size-3 shrink-0 rounded-full bg-primary" />
              ) : n === step ? (
                <span className="size-4 shrink-0 rounded-full bg-primary ring-4 ring-white" />
              ) : (
                <span className="size-3 shrink-0 rounded-full border-[1.5px] border-primary bg-white" />
              )}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
