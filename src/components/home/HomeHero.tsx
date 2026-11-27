// 시작 화면 히어로(11/27 새 시안 — 팀이 만든 PSD를 옮긴 것). 왼쪽부터 영동 사진 카드 3장 · 글 상자 · 사진 카드 1장, 뒤에 옅은 점선 길.
// 자리·크기는 시안 1920px 화면 기준이고 globals.css '.home-hero'가 화면 폭에 맞춰 줄인다(1200px 미만은 글 상자 → 사진 순서로 쌓음).
// 사진에 마우스를 올리면 카드만 떠오르고 사진은 확대하지 않는다(11/27 사용자). 사진은 꾸밈이 아니라 영동 관광지라 대체 글을 단다.
import Image from "next/image";
import type { CSSProperties } from "react";

const CARDS = [
  { src: "/home/hero/card-mountain.jpg", alt: "기암괴석 능선과 노란 들꽃이 핀 초록 산" },
  { src: "/home/hero/card-temple.jpg", alt: "단풍 든 산자락 아래 자리한 전통 사찰과 장독대" },
  { src: "/home/hero/card-rock.jpg", alt: "푸른 바다 위로 우뚝 솟은 촛대 모양 바위" },
  { src: "/home/hero/card-museum.jpg", alt: "파란 하늘 아래 나무 외벽의 아르떼뮤지엄 밸리 건물" },
];

export function HomeHero() {
  return (
    <section aria-labelledby="hero-title" className="home-hero">
      <div className="home-hero__canvas">
        {/* eslint-disable-next-line @next/next/no-img-element -- 장식 점선(SVG, 늘려 씀) */}
        <img className="home-hero__route" src="/home/hero/route-line.svg" alt="" aria-hidden="true" />
        {/* 휴대폰에서는 옆으로 넘기는 줄이라 키보드로도 넘길 수 있게 초점을 받는다(axe scrollable-region-focusable) */}
        <ul className="home-hero__cards" tabIndex={0} aria-label="영동 관광지 사진">
          {CARDS.map((c, i) => (
            <li key={c.src} className="home-hero__card" style={{ "--i": i } as CSSProperties}>
              <span className="home-hero__photo">
                <Image src={c.src} alt={c.alt} fill sizes="(min-width: 1200px) 300px, (min-width: 768px) 25vw, 46vw" className="object-cover" priority={i < 3} />
              </span>
            </li>
          ))}
        </ul>
        <div className="home-hero__box">
          <h1 id="hero-title" className="home-hero__title">
            <span>지도로 찾아가는</span> <span className="is-green">즐거운</span>{" "}
            <span>
              <em className="is-orange not-italic">영동</em> <em className="is-green not-italic">여행길</em>
            </span>
          </h1>
          <p className="home-hero__desc">휠체어, 어르신, 유모차와 함께 가는 영동</p>
        </div>
      </div>
    </section>
  );
}
