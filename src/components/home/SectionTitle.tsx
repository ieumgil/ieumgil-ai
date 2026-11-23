// 시작 화면 구역 제목(레퍼런스: 공주·청양·홍성 관광 — 위에 작은 설명 줄, 제목 핵심 단어에 색).
// 위 줄은 솔숲 초록(장소·지역 정체성), 강조 단어는 기본 파랑. 글자 크기는 규칙 안(16 · 28px).
import type { ReactNode } from "react";

export function SectionTitle({ id, kicker, children, align = "left" }: { id: string; kicker: string; children: ReactNode; align?: "left" | "center" }) {
  return (
    <div className={`flex flex-col gap-2 ${align === "center" ? "items-center text-center" : ""}`}>
      <p className="flex items-center gap-2 text-base font-medium text-pine">
        <span className="h-0.5 w-6 rounded-full bg-pine" aria-hidden="true" />
        {kicker}
      </p>
      <h2 id={id} className="font-heading text-title font-bold text-balance">
        {children}
      </h2>
    </div>
  );
}
