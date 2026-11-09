// 이음길 로고: 표지판 아이콘 + 글자.
// 아이콘은 docs/brand/favicon.svg(16~48px용 단순 판)와 같은 그림이다. 큰 원본은 docs/brand/ieumgil-icon.svg.
export function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="shrink-0">
      <rect width="64" height="64" rx="14" fill="#1E6FD0" />
      <rect x="29" y="9" width="6" height="49" rx="3" fill="#FFFFFF" />
      <circle cx="32" cy="9" r="5" fill="#FFFFFF" />
      <path d="M13 17 H46 L52 23 L46 29 H13 Z" fill="#F5872A" stroke="#FFFFFF" strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M51 34 H18 L12 40 L18 46 H51 Z" fill="#7CC6FF" stroke="#FFFFFF" strokeWidth="2.5" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ size = "lg" }: { size?: "lg" | "md" }) {
  const lg = size === "lg";
  return (
    <span className="flex items-center gap-2">
      <LogoMark size={lg ? 30 : 24} />
      <span className={`font-bold text-primary ${lg ? "text-[1.375rem]" : "text-[1.0625rem]"}`}>이음길</span>
    </span>
  );
}
