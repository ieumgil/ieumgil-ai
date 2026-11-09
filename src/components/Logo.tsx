// 이음길 글자 로고. 두 지점을 잇는 주황 길과 파란 원 두 개(시안 Main·ResultDesktop).
export function Logo({ size = "lg" }: { size?: "lg" | "md" }) {
  const lg = size === "lg";
  return (
    <span className="flex items-center gap-2">
      <svg width={lg ? 30 : 24} height={lg ? 30 : 24} viewBox="0 0 28 28" aria-hidden="true">
        <circle cx="6" cy="20" r="4" fill="none" stroke="var(--color-primary)" strokeWidth="2.5" />
        <circle cx="22" cy="8" r="4" fill="none" stroke="var(--color-primary)" strokeWidth="2.5" />
        <path d="M9 17c4-1 4-7 9-7" fill="none" stroke="var(--color-route)" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      <span className={`font-bold text-primary ${lg ? "text-[1.375rem]" : "text-[1.0625rem]"}`}>이음길</span>
    </span>
  );
}
