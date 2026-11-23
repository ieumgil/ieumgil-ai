import Link from "next/link";
import { ChevronLeftIcon } from "./icons";

/**
 * 화면 맨 위 줄(사이트 머리줄 SiteHeader 아래).
 * - backHref 없음: 그리지 않는다(로고는 11/23부터 모든 화면의 사이트 머리줄에 있다)
 * - backHref 있음: 단계 화면형(왼쪽 뒤로 버튼만)
 * 글자 크기는 rem이라 휴대폰·브라우저의 글자 크기 설정과 확대를 그대로 따른다('가 글씨 크게' 버튼은 11/11에 뺐다).
 */
export function TopBar({ backHref, backLabel = "이전 화면으로", onBack }: { backHref?: string; backLabel?: string; onBack?: () => void }) {
  if (!backHref) return null;
  return (
    <div className="flex items-center">
      <Link
        href={backHref}
        onClick={onBack}
        aria-label={backLabel}
        className="flex size-touch shrink-0 items-center justify-center rounded-full bg-surface text-ink press hover:bg-line"
      >
        <ChevronLeftIcon size={20} />
      </Link>
    </div>
  );
}
