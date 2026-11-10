import { TopBar } from "./TopBar";
import { ButtonLink } from "./ui/button";

// 아직 만들지 않은 화면의 임시 안내. 해당 화면을 만들면 지운다.
export function ComingSoon({ title }: { title: string }) {
  return (
    <main className="mx-auto flex w-full max-w-[30rem] flex-1 flex-col px-5 pt-4 pb-7">
      <TopBar backHref="/" backLabel="처음 화면으로" />
      <div className="flex flex-1 flex-col justify-center gap-3 text-center">
        <h1 className="text-title font-bold">{title}</h1>
        <p className="text-base text-ink-sub">지금 만들고 있어요. 조금만 기다려 주세요.</p>
      </div>
      <ButtonLink href="/" variant="secondary">
        처음 화면으로
      </ButtonLink>
    </main>
  );
}
