import Link from "next/link";
import type { ComponentProps } from "react";

// 시안 버튼. 높이는 터치 영역 44px 이상(큰 버튼 56px).
export type ButtonVariant = "primary" | "outline" | "secondary" | "disabled";

const base =
  "flex items-center justify-center rounded-[0.875rem] px-4 text-center font-bold no-underline transition-colors focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary";

const variants: Record<ButtonVariant, string> = {
  primary: "h-14 bg-primary text-lg text-white hover:bg-primary-ink",
  outline: "h-13 border-[1.5px] border-primary bg-white text-base text-primary hover:bg-primary-soft",
  secondary: "h-14 bg-surface text-[1.0625rem] font-medium text-ink hover:bg-line",
  disabled: "h-14 cursor-not-allowed bg-line text-[1.0625rem] text-ink-sub",
};

export function buttonClass(variant: ButtonVariant = "primary", extra = "") {
  return `${base} ${variants[variant]} ${extra}`.trim();
}

export function ButtonLink({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: Exclude<ButtonVariant, "disabled"> }) {
  return <Link className={buttonClass(variant, className)} {...props} />;
}
