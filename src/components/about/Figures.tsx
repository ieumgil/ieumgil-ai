// 소개 글의 그림: 실제 화면 캡처(휴대폰 틀, scripts/readme/capture.ts가 만든 docs/readme/mock을 public/about에 줄여 둠)와 구조도.
// 그림은 누르는 곳이 없고(구조도만 원본 크기로 열기), 설명은 figcaption 글로 함께 둔다.
import Image from "next/image";

export type Shot = { src: string; alt: string; caption: string };

/** 휴대폰 화면 여러 장을 나란히. 휴대폰 cols칸, 태블릿·PC는 한 줄 */
export function Phones({ shots, label }: { shots: Shot[]; label: string }) {
  const md = shots.length >= 5 ? "md:grid-cols-5" : shots.length === 4 ? "md:grid-cols-4" : shots.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2";
  const base = shots.length >= 3 ? "grid-cols-3" : shots.length === 2 ? "grid-cols-2" : "grid-cols-1";
  return (
    <figure aria-label={label} className="rounded-2xl bg-surface px-3 py-4">
      <ul className={`grid ${base} ${md} gap-x-2 gap-y-4 ${shots.length === 1 ? "mx-auto max-w-[13rem]" : shots.length === 2 ? "mx-auto max-w-[26rem]" : ""}`}>
        {shots.map((s) => (
          <li key={s.src} className="flex flex-col items-center gap-2">
            <Image src={s.src} width={480} height={972} alt={s.alt} sizes="(min-width: 768px) 9rem, 33vw" className="h-auto w-full" />
            <span className="text-center text-sm text-ink-sub text-pretty">{s.caption}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

/** README 구조도. 휴대폰에서는 글자가 작아 원본 크기로 열 수 있게 링크를 둔다 */
export function Architecture() {
  return (
    <figure className="flex flex-col gap-2">
      <a href="/about/architecture.webp" target="_blank" rel="noreferrer" className="block overflow-hidden rounded-2xl border border-line">
        <Image
          src="/about/architecture.webp"
          width={1800}
          height={1299}
          sizes="(min-width: 768px) 40rem, 100vw"
          alt="구조도: 사용자 화면에서 조건을 보내면 서버가 코드로 후보 20곳을 거르고, AI가 장소를 세 번 판단하고, 코드가 근거와 안전 기준을 검사하고, AI가 일정 2~3개를 짜고, 코드가 시각을 계산·검사한 뒤 AI 평가자를 거쳐 화면으로 돌려준다. AI가 실패하면 규칙 일정. 옆에는 Gemini·OpenAI, 미리 만든 장소 데이터, Supabase 공유 링크, 카카오 지도·이동시간"
          className="h-auto w-full"
        />
        <span className="sr-only"> (원본 크기로 새 탭에서 열기)</span>
      </a>
      <figcaption className="text-sm text-ink-sub text-pretty">파란 칸은 AI가, 회색 칸은 코드가 하는 일이에요. 그림을 누르면 크게 볼 수 있어요.</figcaption>
    </figure>
  );
}
