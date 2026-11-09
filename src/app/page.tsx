// 시작 화면 (시안: docs/design/Main.dc.html)
import type { ReactNode } from "react";
import { TopBar } from "@/components/TopBar";
import { ButtonLink } from "@/components/ui/Button";
import { ChatIcon, CheckIcon, DocumentIcon } from "@/components/icons";

const FEATURES: { icon: ReactNode; title: string; body: string }[] = [
  {
    icon: <CheckIcon size={22} />,
    title: "조건을 어기는 곳은 빼요",
    body: "계단, 화장실, 걷는 거리처럼 꼭 필요한 조건을 유형별로 확인해요",
  },
  {
    icon: <DocumentIcon size={22} />,
    title: "판정마다 근거를 보여줘요",
    body: "어디서 확인한 정보인지, 언제 확인했는지 함께 알려드려요",
  },
  {
    icon: <ChatIcon size={22} />,
    title: "AI가 쉬운 말로 정리해요",
    body: "루트와 주의할 점, 챙길 것을 짧게 브리핑해요",
  },
];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-[30rem] flex-1 flex-col">
      <header className="flex flex-col gap-[1.125rem] px-6 pt-5 pb-2">
        <TopBar />
        <h1 className="mt-5 text-[1.875rem] leading-[1.35] font-bold">
          휠체어, 어르신, 유모차와
          <br />
          함께 가는 영동 여행
        </h1>
        <p className="text-[1.0625rem] leading-relaxed text-ink-sub">
          강릉·속초·동해 유명 관광지 중 우리 조건에 맞는 곳만 골라 지도 위 여행 루트로 짜 드려요.
        </p>
      </header>

      <ul className="flex flex-col gap-3 px-5 pt-6">
        {FEATURES.map((f) => (
          <li key={f.title} className="flex items-start gap-3.5 rounded-2xl bg-surface p-4">
            <span className="flex size-touch shrink-0 items-center justify-center rounded-full bg-white text-primary">
              {f.icon}
            </span>
            <span className="flex flex-col gap-1">
              <span className="text-[1.0625rem] font-bold">{f.title}</span>
              <span className="text-base leading-normal text-ink-sub">{f.body}</span>
            </span>
          </li>
        ))}
      </ul>

      <div className="grow" />

      <div className="flex flex-col gap-2.5 px-5 pt-4 pb-7">
        <ButtonLink href="/plan">여행 루트 만들기</ButtonLink>
        <ButtonLink href="/trip/example" variant="outline">
          예시 루트 바로 보기
        </ButtonLink>
        <p className="mt-1 text-center text-sm text-ink-sub">회원가입 없이 쓸 수 있어요 · 일반 차량 경로 기준</p>
      </div>
    </main>
  );
}
