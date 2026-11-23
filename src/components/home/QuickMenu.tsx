// 히어로 바로 아래 바로가기 띠. 레퍼런스 비짓강릉의 아이콘 띠(.IconlinkFrame) CSS를 옮겨 왔다(globals.css .quick-band).
// 위쪽 색 줄무늬 8칸 · 연한 바탕 · 아래 5px 파란 테두리 · 아이콘 + 굵은 이름 · 마우스를 올리면 눌린 듯한 안쪽 그림자.
// 아이콘은 임시(home/icons.tsx 한 파일만 바꾸면 된다). 누르는 칸 44px 이상, 글자 17px.
import Link from "next/link";
import { HomeIcon, type HomeIconName } from "./icons";

const ITEMS: { href: string; label: string; icon: HomeIconName }[] = [
  { href: "/plan", label: "여행 루트 만들기", icon: "route" },
  { href: "/trip/example", label: "예시 루트 보기", icon: "example" },
  { href: "/places", label: "관광지 둘러보기", icon: "places" },
  { href: "/about", label: "서비스 소개", icon: "about" },
  { href: "/about/how", label: "만든 방법", icon: "how" },
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
          {ITEMS.map((it) => (
            <li key={it.href}>
              <Link href={it.href} className="quick-band__link">
                <span className="quick-band__icon">
                  <HomeIcon name={it.icon} size={56} />
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
