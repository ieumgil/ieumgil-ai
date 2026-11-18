// 버튼(shadcn/ui 방식: cva 변형 + Slot). 우리 규칙을 기본값으로 둔다:
// 글자 16px 이상, 터치 영역 44px 이상(기본 56px, 작은 버튼도 44px), 색만이 아니라 글자로 상태 표시.
// 글자는 모든 변형이 16px · 굵기 700, 반지름 12px. 높이는 고정하지 않고 최소 높이만 둬서 글자가 길거나 커지면 줄을 바꿔 잘리지 않게 한다.
// ※ shadcn의 `npx shadcn add button`을 다시 실행하면 이 파일을 덮어쓰니 쓰지 않는다(Windows는 Button/button을 같은 파일로 본다).
import Link from "next/link";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-xl px-4 text-center text-base leading-snug font-medium text-balance whitespace-normal no-underline press outline-hidden select-none focus-visible:outline-3 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-primary disabled:pointer-events-none aria-disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-primary-ink",
        outline: "border-[1.5px] border-primary bg-background text-primary hover:bg-primary-soft hover:text-primary-ink",
        secondary: "bg-secondary text-secondary-foreground hover:bg-line",
        ghost: "text-ink hover:bg-surface",
        disabled: "cursor-not-allowed bg-line text-ink-sub",
      },
      size: {
        /** 큰 버튼 56px(시안) */
        lg: "min-h-14 py-2",
        /** 보조 버튼 52px(시안 outline) */
        md: "min-h-13 py-2",
        /** 작은 버튼도 터치 44px */
        sm: "min-h-touch px-3",
        icon: "min-h-touch min-w-touch px-0",
      },
    },
    defaultVariants: { variant: "primary", size: "lg" },
  },
);

export type ButtonVariant = NonNullable<VariantProps<typeof buttonVariants>["variant"]>;

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "button";
  return <Comp data-slot="button" data-variant={variant} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

/** 기존 화면용: 변형 이름만으로 클래스(outline은 시안대로 52px) */
export function buttonClass(variant: ButtonVariant = "primary", extra = "") {
  return cn(buttonVariants({ variant, size: variant === "outline" ? "md" : "lg" }), "flex", extra);
}

export function ButtonLink({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: Exclude<ButtonVariant, "disabled"> }) {
  return <Link className={buttonClass(variant, className)} {...props} />;
}
