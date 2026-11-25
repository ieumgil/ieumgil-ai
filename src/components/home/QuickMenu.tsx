// 히어로 바로 아래 바로가기 띠. 레퍼런스 비짓강릉의 아이콘 띠(.IconlinkFrame) CSS를 옮겨 왔다(globals.css .quick-band).
// 위쪽 색 줄무늬 8칸 · 연한 바탕 · 아래 5px 파란 테두리 · 아이콘 + 굵은 이름 · 마우스를 올리면 눌린 듯한 안쪽 그림자.
// 아이콘(11/25, 팀이 만든 디자인 시안): 히어로 세계관의 미니 일러스트(public/home/quick-*.webp, 192×192 투명 — 같은 캔버스라 겹치면 정확히 맞음).
//   여행 루트 만들기 = 언덕 위 표지판 · 예시 루트 보기 = 접이식 지도 + 점선 루트 · 관광지 둘러보기 = 호숫가 정자 + 위치 핀
//   · 서비스 소개 = 등대(길을 비춰 안내) · 작동 원리 = 설계도 + 연필.
//   움직이는 부분은 따로 떼어 낸 층(-sign · -route · -pin · -light): 마우스를 올리거나 키보드 초점이 가면 표지판 흔들림 · 점선 다시 그리기 ·
//   핀 톡 튀기 · 불빛 두 번 깜빡임 · 연필 사각사각(globals.css .quick-ic, 동작 줄이기면 없음).
// 그림은 장식이라 읽지 않는다(링크 이름은 옆 글자). 누르는 칸 44px 이상, 글자 17px.
import Link from "next/link";
import type { CSSProperties } from "react";

type Layer = { src: string; cls?: string };
const ITEMS: { href: string; label: string; layers: Layer[] }[] = [
  // 아래 층부터 순서대로(시안 미리보기와 같은 겹침)
  { href: "/plan", label: "여행 루트 만들기", layers: [{ src: "quick-route-sign", cls: "quick-ic__sign" }, { src: "quick-route" }] },
  { href: "/trip/example", label: "예시 루트 보기", layers: [{ src: "quick-example" }, { src: "quick-example-route", cls: "quick-ic__dash" }] },
  { href: "/places", label: "관광지 둘러보기", layers: [{ src: "quick-places" }, { src: "quick-places-pin", cls: "quick-ic__pin" }] },
  { href: "/about", label: "서비스 소개", layers: [{ src: "quick-about" }, { src: "quick-about-light", cls: "quick-ic__light" }] },
  { href: "/about/how", label: "작동 원리", layers: [{ src: "quick-how", cls: "quick-ic__whole" }] },
];

export function QuickMenu({ inner }: { inner: string }) {
  return (
    <nav aria-label="주요 바로가기" className="quick-band">
      <div className="quick-band__stripe" aria-hidden="true">
        {Array.from({ length: 8 }, (_, i) => (
          <span key={i} />
        ))}
      </div>
      <div className={inner}>
        <ul className="quick-band__list">
          {ITEMS.map((it, i) => (
            <li key={it.href} data-reveal="" style={{ "--reveal-i": i } as CSSProperties}>
              <Link href={it.href} className="quick-band__link">
                <span className="quick-band__icon" aria-hidden="true">
                  <span className="quick-ic">
                    {it.layers.map((l) => (
                      // eslint-disable-next-line @next/next/no-img-element -- 작은 투명 장식 그림(192px)을 겹쳐 쓴다, 최적화·크기 계산 불필요
                      <img key={l.src} src={`/home/${l.src}.webp`} alt="" width={192} height={192} decoding="async" className={l.cls} />
                    ))}
                  </span>
                </span>
                <span className="quick-band__label">{it.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
