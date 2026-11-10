import Link from "next/link";
import { FontSizeToggle } from "./FontSizeToggle";
import { Logo } from "./Logo";
import { ChevronLeftIcon } from "./icons";

/**
 * 화면 맨 위 줄.
 * - backHref 없음: 시작 화면형(왼쪽 로고, 오른쪽 글씨 크게)
 * - backHref 있음: 단계 화면형(왼쪽 뒤로, 가운데 이름, 오른쪽 글씨 크게)
 */
export function TopBar({ backHref, backLabel = "이전 화면으로" }: { backHref?: string; backLabel?: string }) {
  if (!backHref) {
    return (
      <div className="flex items-center justify-between gap-2">
        <Link href="/" aria-label="이음길 처음 화면" className="flex min-h-touch items-center">
          <Logo />
        </Link>
        <FontSizeToggle />
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between gap-2">
      <Link
        href={backHref}
        aria-label={backLabel}
        className="flex size-touch shrink-0 items-center justify-center rounded-full bg-surface text-ink"
      >
        <ChevronLeftIcon size={20} />
      </Link>
      <Link href="/" className="flex min-h-touch items-center px-2 text-[1.0625rem] font-bold text-primary">
        이음길
      </Link>
      <FontSizeToggle />
    </div>
  );
}
