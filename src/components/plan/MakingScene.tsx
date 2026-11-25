// 만드는 중 장면(11/25, 단계 4): 옅은 언덕 선 두 줄 위로 휜 길을 따라 파란 점 12개가 진행값만큼 하나씩 찍힌다(시작 화면 히어로 점선과 같은 세계).
// 다 되면 마지막 자리에 도착 고리가 나온다. 자체 타이머 없이 MakingStep의 진행값(pct)을 따라가고, transform·opacity만 움직인다(globals.css .making-dot).
// 동작 줄이기면 처음부터 모두 켜진 정지 그림. 장식이라 읽지 않는다 — 진행 정보는 진행 막대·퍼센트·aria-live 문장이 전한다. 입력 흐름이라 초록은 쓰지 않는다.
const DOTS = 12;
const points = Array.from({ length: DOTS }, (_, i) => ({
  cx: 24 + 28.36 * i,
  cy: 72 - 24 * Math.sin((i / (DOTS - 1)) * Math.PI),
}));

export function MakingScene({ pct, done }: { pct: number; done: boolean }) {
  const on = done ? DOTS : Math.floor((pct / 100) * DOTS);
  const last = points[DOTS - 1];
  return (
    <svg viewBox="0 36 360 60" className="pointer-events-none block h-auto w-[min(100%,22.5rem)]" aria-hidden="true" data-making-scene="">
      <g stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.16">
        <path d="M0 84C70 66 130 76 200 66S310 50 360 58" />
        <path d="M0 94C90 80 170 88 250 80S330 72 360 76" />
      </g>
      {points.map((p, i) => (
        <circle key={i} className="making-dot" data-on={i < on ? "" : undefined} cx={p.cx} cy={p.cy} r="3" fill="var(--color-primary)" />
      ))}
      <circle className="making-dot" data-on={done ? "" : undefined} cx={last.cx} cy={last.cy} r="7" fill="none" stroke="var(--color-primary)" strokeWidth="2" />
    </svg>
  );
}
