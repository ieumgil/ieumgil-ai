// 예시 루트 안내: 미리 만든 실제 AI 결과라는 것과 내 조건으로 만들러 가기.
import { Sparkles } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";

/** 예시 루트 안내: 미리 만든 결과라는 것과 내 조건으로 만들러 가기 */
export function ExampleBanner() {
  return (
    <div className="mx-5 mt-4 flex flex-col gap-3 rounded-2xl bg-primary-soft px-4 py-3 text-base text-primary-ink md:flex-row md:items-center">
      <p className="flex min-w-0 flex-1 items-start gap-2">
        <Sparkles size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
        <span>
          <span className="font-bold">예시 일정이에요.</span> 실제 AI가 미리 만든 결과라 바로 열려요. 장소 바꾸기·확정·지도를 그대로 해 볼 수 있어요.
        </span>
      </p>
      <ButtonLink href="/plan" variant="outline" className="min-h-touch w-full bg-white px-3 text-base md:w-auto">
        내 조건으로 만들기
      </ButtonLink>
    </div>
  );
}
