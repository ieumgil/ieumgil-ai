import type { ReactNode } from "react";

// 조건 상태 표시. 색만으로 구분하지 않도록 기호(✓ ! ✕)와 글자를 함께 쓴다.
export type ChipStatus = "ok" | "caution" | "blocked";

const styles: Record<ChipStatus, { symbol: string; className: string; sr: string }> = {
  ok: { symbol: "✓", className: "bg-primary-soft text-primary-ink", sr: "충족" },
  caution: { symbol: "!", className: "bg-caution-bg text-caution-ink", sr: "주의" },
  blocked: { symbol: "✕", className: "bg-blocked-bg text-blocked-ink", sr: "어려움" },
};

export function StatusChip({ status, children }: { status: ChipStatus; children: ReactNode }) {
  const s = styles[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-medium ${s.className}`}>
      <span aria-hidden="true" className="font-bold">
        {s.symbol}
      </span>
      <span className="sr-only">{s.sr}: </span>
      {children}
    </span>
  );
}
