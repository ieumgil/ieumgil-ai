// 히어로 바로 아래 바로가기 5칸(11/27 새 시안): 연회색 판 위에 그림 + 이름(여기어때 잘난체 고딕). 모양은 globals.css '.home-quick'.
// 그림은 장식이라 읽지 않는다(링크 이름은 옆 글자). 마우스를 올리거나 키보드 초점이 가면 그림이 조금 떠오르고 이름이 파래진다.
// '여행 루트 만들기'가 첫 화면의 주 버튼 역할을 한다(머리줄 버튼은 시작 화면에서 숨김).
import Link from "next/link";

const ITEMS: { href: string; label: string; icon: string; w: number; h: number }[] = [
  { href: "/plan", label: "여행 루트 만들기", icon: "icon-route", w: 63, h: 84 },
  { href: "/trip/example", label: "예시 루트 보기", icon: "icon-map", w: 78, h: 74 },
  { href: "/places", label: "관광지 둘러보기", icon: "icon-car", w: 93, h: 68 },
  { href: "/about", label: "서비스 소개", icon: "icon-tube", w: 93, h: 58 },
  { href: "/about/how", label: "작동 원리", icon: "icon-bag", w: 81, h: 70 },
];

export function QuickMenu({ inner }: { inner: string }) {
  return (
    <nav aria-label="주요 바로가기" className="home-quick">
      <div className={inner}>
        <ul className="home-quick__list">
          {ITEMS.map((it) => (
            <li key={it.href}>
              <Link href={it.href} className="home-quick__link">
                <span className="home-quick__icon" aria-hidden="true">
                  {/* eslint-disable-next-line @next/next/no-img-element -- 작은 투명 장식 그림, 최적화 불필요 */}
                  <img src={`/home/quick/${it.icon}.png`} alt="" width={it.w} height={it.h} decoding="async" />
                </span>
                <span className="home-quick__label">{it.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
