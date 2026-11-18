"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Tabs as TabsPrimitive } from "radix-ui"

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn(
        "group/tabs flex gap-2 data-horizontal:flex-col",
        className
      )}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit items-center justify-center rounded-xl p-1 text-muted-foreground group-data-horizontal/tabs:h-auto group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col data-[variant=line]:rounded-none",
  {
    variants: {
      variant: {
        default: "bg-muted",
        line: "w-full justify-start gap-0 border-b border-line bg-transparent p-0",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function TabsList({
  className,
  variant = "default",
  children,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> &
  VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), variant === "line" && "relative", className)}
      {...props}
    >
      {children}
      {variant === "line" && <LineIndicator />}
    </TabsPrimitive.List>
  )
}

/**
 * 밑줄형 탭(날짜 탭)의 움직이는 밑줄(11/18 움직임 ②): 고른 탭 아래로 옆으로 미끄러진다(보통 160ms · state 곡선).
 * 처음 놓일 때는 움직이지 않는다. 붙기 전(서버 화면)에는 탭마다 ::after 밑줄이 대신 보이고, 붙으면 data-indicator로 그것을 숨긴다.
 * 동작 줄이기면 globals.css가 전환을 0으로 만들어 바로 옮겨 간다. 장식이라 보조기술에는 숨긴다(고른 탭은 aria-selected로 알림).
 */
function LineIndicator() {
  const ref = React.useRef<HTMLSpanElement>(null)
  const [box, setBox] = React.useState<{ left: number; width: number } | null>(null)
  const [ready, setReady] = React.useState(false)
  React.useLayoutEffect(() => {
    // 자식 효과가 부모 ref보다 먼저 돌아서, 목록은 밑줄 자신의 부모로 찾는다
    const list = ref.current?.parentElement
    if (!list) return
    const measure = () => {
      const active = list.querySelector<HTMLElement>('[data-slot="tabs-trigger"][data-state="active"]')
      setBox(active ? { left: active.offsetLeft, width: active.offsetWidth } : null)
    }
    measure()
    list.dataset.indicator = "on"
    const mo = new MutationObserver(measure)
    mo.observe(list, { subtree: true, attributes: true, attributeFilter: ["data-state"] })
    const ro = new ResizeObserver(measure)
    ro.observe(list)
    const id = requestAnimationFrame(() => setReady(true))
    return () => {
      mo.disconnect()
      ro.disconnect()
      cancelAnimationFrame(id)
      delete list.dataset.indicator
    }
  }, [])
  return (
    <span
      ref={ref}
      aria-hidden="true"
      data-slot="tabs-indicator"
      className="pointer-events-none absolute bottom-0 left-0 h-0.5 bg-pine"
      style={{
        width: box?.width ?? 0,
        transform: `translateX(${box?.left ?? 0}px)`,
        visibility: box ? "visible" : "hidden",
        transition: ready ? "transform var(--motion-medium) var(--ease-state), width var(--motion-medium) var(--ease-state)" : "none",
      }}
    />
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 min-h-touch rounded-[0.65rem] border border-transparent px-2 py-1.5 text-base font-bold whitespace-nowrap text-ink-sub transition-all group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 has-data-[icon=inline-end]:pr-1 has-data-[icon=inline-start]:pl-1 dark:text-muted-foreground dark:hover:text-foreground group-data-[variant=default]/tabs-list:data-active:shadow-sm group-data-[variant=line]/tabs-list:data-active:shadow-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-active:bg-transparent dark:group-data-[variant=line]/tabs-list:data-active:border-transparent dark:group-data-[variant=line]/tabs-list:data-active:bg-transparent",
        // 밑줄형(날짜 탭): 높이는 글자를 따라가고(두 줄 라벨·큰 글자에서도 안 잘림), 고른 날은 솔숲 초록 글자 + 2px 밑줄
        "group-data-[variant=line]/tabs-list:h-auto group-data-[variant=line]/tabs-list:min-h-14 group-data-[variant=line]/tabs-list:whitespace-normal group-data-[variant=line]/tabs-list:py-2 group-data-[variant=line]/tabs-list:text-balance group-data-[variant=line]/tabs-list:data-active:text-pine group-data-[variant=line]/tabs-list:after:bg-pine group-data-horizontal/tabs:group-data-[variant=line]/tabs-list:after:bottom-0",
        "data-active:bg-background data-active:text-foreground dark:data-active:border-input dark:data-active:bg-input/30 dark:data-active:text-foreground",
        "after:absolute after:bg-foreground after:opacity-0 after:transition-opacity group-data-horizontal/tabs:after:inset-x-0 group-data-horizontal/tabs:after:bottom-[-5px] group-data-horizontal/tabs:after:h-0.5 group-data-vertical/tabs:after:inset-y-0 group-data-vertical/tabs:after:-right-1 group-data-vertical/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-active:after:opacity-100 group-data-[indicator=on]/tabs-list:after:hidden",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 text-base outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
