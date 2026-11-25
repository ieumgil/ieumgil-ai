// 시작 화면 히어로 장면(11/25, 팀이 직접 만든 디자인 시안 — 배경·조각은 AI로 만든 그림을 다듬은 것).
// 배경 한 장(public/hero/sky-hills.webp: 하늘 · 표지판 · 설악산 바위 · 정자 · 흰 길 · 바다 · 촛대바위) 위에
//   ① 흰 길을 따라 파란 점선 43개가 앞쪽부터 하나씩 찍히며 촛대바위까지 이어지고(처음 한 번),
//   ② 구름 4개가 왼쪽에서 오른쪽으로 천천히 흐르고, 갈매기 2마리가 활공하고, 배 1척이 물결에 흔들린다.
// 배치·움직임의 정답은 시안의 미리보기(reference/hero-preview/index.html — 저장소에 넣지 않음)이고, 값은 globals.css '.hero-scene'에 옮겼다.
// - 배경은 자르지 않는다(object-cover 금지): PC는 폭 100% · 높이 자동 · 아래 기준, 휴대폰은 높이 100% · 폭 자동 · 왼쪽 기준(표지판·바위·정자가 보이게).
//   점선 SVG(viewBox 2168×716 = 배경 원본 비율, 좌표는 public/hero/route-dashes.svg 그대로)도 배경과 같은 크기 규칙이라 흰 길 위에 정확히 얹힌다.
// - 전부 장식이라 화면 읽기 프로그램은 건너뛴다(alt="", aria-hidden). 움직임은 transform·opacity만.
// - 동작 줄이기면 점선은 처음부터 다 보이고 조각은 그 자리에 멈춘다.
import Image from "next/image";
import type { CSSProperties } from "react";

/** 점선 [x1, y1, x2, y2, 굵기] — 원근에 맞춰 멀어질수록 가늘고 짧다 */
const DASHES: [number, number, number, number, number][] = [
  [71.3, 704.8, 79.6, 702.4, 3.2],
  [86.8, 700.5, 98.4, 697.3, 3.4],
  [108.5, 694.5, 125.0, 690.3, 4.8],
  [139.2, 686.6, 161.9, 681.0, 6.6],
  [181.3, 675.5, 209.0, 662.9, 8.7],
  [231.1, 648.3, 256.4, 631.1, 8.7],
  [279.2, 617.6, 301.6, 606.0, 7.2],
  [321.5, 596.8, 342.0, 588.9, 6.2],
  [360.0, 582.7, 378.7, 576.9, 5.5],
  [395.1, 572.8, 412.4, 568.7, 5.0],
  [427.4, 565.8, 443.6, 562.8, 4.7],
  [457.7, 560.5, 473.2, 558.1, 4.4],
  [486.6, 556.1, 501.5, 554.0, 4.3],
  [514.4, 552.3, 528.8, 550.3, 4.1],
  [541.3, 548.7, 555.4, 546.9, 4.0],
  [567.6, 545.3, 581.3, 543.6, 3.9],
  [593.1, 542.2, 606.3, 540.6, 3.8],
  [617.8, 539.3, 630.7, 537.9, 3.7],
  [641.9, 536.7, 654.4, 535.3, 3.6],
  [665.3, 534.2, 677.5, 532.9, 3.5],
  [688.1, 531.8, 700.0, 530.6, 3.4],
  [710.3, 529.5, 721.9, 528.3, 3.3],
  [731.9, 527.3, 743.2, 526.1, 3.2],
  [753.0, 525.1, 764.0, 524.0, 3.2],
  [773.5, 523.0, 784.1, 521.9, 3.2],
  [793.4, 521.0, 803.8, 520.0, 3.2],
  [812.8, 519.0, 823.0, 518.0, 3.2],
  [831.8, 517.1, 841.8, 516.1, 3.2],
  [850.4, 515.2, 860.1, 514.2, 3.2],
  [868.5, 513.3, 878.0, 512.3, 3.2],
  [886.3, 511.5, 895.5, 510.4, 3.2],
  [903.5, 509.5, 912.4, 508.5, 3.2],
  [920.2, 507.5, 929.0, 506.5, 3.2],
  [936.6, 505.5, 945.2, 504.4, 3.2],
  [952.6, 503.3, 961.0, 502.1, 3.2],
  [968.2, 501.1, 976.4, 499.8, 3.2],
  [983.4, 498.6, 991.2, 497.2, 3.2],
  [998.0, 496.1, 1005.4, 494.4, 3.2],
  [1011.8, 492.7, 1018.8, 490.7, 3.2],
  [1024.9, 489.1, 1031.4, 486.9, 3.2],
  [1035.8, 482.7, 1040.9, 477.9, 3.2],
  [1045.2, 473.8, 1050.3, 469.0, 3.2],
  [1053.4, 464.0, 1056.0, 457.5, 3.2],
];

/** 움직이는 조각(구름 4 · 갈매기 2 · 배 1): 위치·크기·속도는 globals.css .hero-sp--c1~c4 · g1~g2 · boat */
const SPRITES = [
  { cls: "hero-sp--cloud hero-sp--c1", src: "/hero/cloud-1.webp", w: 392, h: 125 },
  { cls: "hero-sp--cloud hero-sp--c2", src: "/hero/cloud-4.webp", w: 165, h: 94 },
  { cls: "hero-sp--cloud hero-sp--c3", src: "/hero/cloud-2.webp", w: 394, h: 124 },
  { cls: "hero-sp--cloud hero-sp--c4", src: "/hero/cloud-5.webp", w: 191, h: 81 },
  { cls: "hero-sp--gull hero-sp--g1", src: "/hero/gull-1.webp", w: 163, h: 53 },
  { cls: "hero-sp--gull hero-sp--g2", src: "/hero/gull-3.webp", w: 108, h: 76 },
  { cls: "hero-sp--boat", src: "/hero/boat.webp", w: 269, h: 140 },
];

export function HeroScene() {
  return (
    <div className="hero-scene__scene" aria-hidden="true">
      <Image src="/hero/sky-hills.webp" alt="" width={1800} height={594} priority sizes="(min-width: 1024px) 100vw, 760px" className="hero-scene__bg" />
      <svg className="hero-scene__bg hero-scene__route" viewBox="0 0 2168 716" preserveAspectRatio="xMinYMax meet" focusable="false">
        <g stroke="#3580DB" strokeLinecap="round">
          {DASHES.map(([x1, y1, x2, y2, w], i) => (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth={w} style={{ "--i": i } as CSSProperties} />
          ))}
        </g>
      </svg>
      <div className="hero-scene__fx">
        {SPRITES.map((s) => (
          <div key={s.cls} className={`hero-sp ${s.cls}`}>
            {/* eslint-disable-next-line @next/next/no-img-element -- 작은 투명 장식 그림(1~8KB), 최적화·크기 계산 불필요 */}
            <img src={s.src} alt="" width={s.w} height={s.h} decoding="async" />
          </div>
        ))}
      </div>
    </div>
  );
}
