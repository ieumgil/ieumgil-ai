import Link from "next/link";
import { Logo } from "./Logo";
import { ChevronLeftIcon } from "./icons";

/**
 * 화면 맨 위 줄.
 * - backHref 없음: 시작 화면형(왼쪽 로고)
 * - backHref 있음: 단계 화면형(왼쪽 뒤로, 가운데 로고, 오른쪽은 뒤로 버튼만큼 비워 가운데를 맞춘다)
 * 글자 크기는 rem이라 휴대폰·브라우저의 글자 크기 설정과 확대를 그대로 따른다('가 글씨 크게' 버튼은 11/11에 뺐다).
 */
export function TopBar({ backHref, backLabel = "이전 화면으로" }: { backHref?: string; backLabel?: string }) {
  if (!backHref) {
    return (
      <div className="flex items-center">
        <Link href="/" aria-label="이음길 처음 화면" className="flex min-h-touch items-center">
          <Logo />
        </Link>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-[2.75rem_1fr_2.75rem] items-center gap-2">
      <Link
        href={backHref}
        aria-label={backLabel}
        className="flex size-touch shrink-0 items-center justify-center rounded-full bg-surface text-ink transition-[background-color,transform] duration-150 hover:bg-line active:scale-[0.96]"
      >
        <ChevronLeftIcon size={20} />
      </Link>
      <Link href="/" aria-label="이음길 처음 화면" className="flex min-h-touch items-center justify-self-center px-2">
        <Logo size="md" />
      </Link>
      <span aria-hidden="true" />
    </div>
  );
}
