// 예시 루트 안내: 미리 만든 실제 AI 결과라는 것 + 내 조건으로 만들러 가기(글자 버튼). 첫 화면의 색 띠는 이것 하나.
import Link from "next/link";

/** 예시 루트 안내: 미리 만든 결과라는 것과 내 조건으로 만들러 가기 */
export function ExampleBanner() {
  return (
    <p data-example-banner className="mx-4 mt-4 rounded-2xl bg-primary-soft px-4 py-3 text-base text-primary-ink md:mx-6">
      <span className="font-medium">예시 일정이에요.</span> 실제 AI가 미리 만든 결과라 바로 열려요. 장소 바꾸기·확정·지도를 그대로 해 볼 수 있어요.{" "}
      <Link href="/plan" className="-my-3 inline-flex min-h-touch items-center font-medium whitespace-normal text-primary-ink underline underline-offset-4">
        내 조건으로 만들기
      </Link>
    </p>
  );
}
