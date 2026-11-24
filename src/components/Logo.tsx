// 이음길 로고: 아이콘 + 글자.
// 아이콘은 브랜드 원본 docs/brand/icon-1024.png(표지판·해·언덕)를 줄인 public/logo-mark.png(256px)이다.
// 파비콘·앱 아이콘(src/app/icon.png·apple-icon.png·favicon.ico)도 같은 원본에서 만든다.
// 장식이라 대체 글은 비운다(옆에 '이음길' 글자가 있고, 링크 이름은 TopBar가 붙인다).
/* eslint-disable @next/next/no-img-element -- 미리 줄여 둔 작은 아이콘, 첫 화면 위쪽이라 바로 보여야 한다 */
export function LogoMark({ size = 30 }: { size?: number }) {
  return <img src="/logo-mark.png" width={size} height={size} alt="" aria-hidden="true" className="shrink-0" decoding="async" />;
}

export function Logo({ size = "lg" }: { size?: "lg" | "md" }) {
  const lg = size === "lg";
  return (
    <span className="flex items-center gap-2">
      <LogoMark size={lg ? 30 : 24} />
      <span className={`font-medium text-primary ${lg ? "text-heading" : "text-base"}`}>이음길</span>
    </span>
  );
}
