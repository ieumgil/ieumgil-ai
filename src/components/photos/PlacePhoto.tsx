"use client";

// 관광지 작은 사진 + 크게 보기.
// - 1유형 대표: 미리 줄여 둔 작은 사진(잘라서 꽉 채움)
// - 3유형 대표: 관광공사 원본을 그대로 불러와 자르지 않고 통째로(object-contain, 옅은 여백)
// - 사진이 없거나 못 불러오면 분류 아이콘
// 누르면 크게 보기: 사진을 옆으로 넘겨 보고, 편의시설 사진은 "편의시설 사진: 화장실"처럼 표시, 사진마다 출처.
import { Binoculars, ChevronLeft, ChevronRight, Frame, Images, Landmark, Store, Trees, Waves } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { photosOf } from "@/lib/places/client-photos";
import { FACILITY_LABEL, photoCredit, type LabeledPhoto } from "@/lib/places/photos";

const CATEGORY_ICON: Record<string, (size: number) => ReactNode> = {
  "바다·해변": (s) => <Waves size={s} />,
  "자연·산책": (s) => <Trees size={s} />,
  "역사·문화": (s) => <Landmark size={s} />,
  "전시·박물관": (s) => <Frame size={s} />,
  "시장·먹거리": (s) => <Store size={s} />,
  "전망·체험": (s) => <Binoculars size={s} />,
};

const SIZE = { sm: "size-14", md: "size-20", lg: "size-24" } as const;

/** 누를 수 없는 작은 사진(카드 전체가 버튼인 곳). 장식이라 화면 읽기에서는 숨긴다 */
export function PlaceThumb({ id, category, className = "size-11" }: { id: string; category?: string; className?: string }) {
  const cover = photosOf(id)?.cover;
  const [failed, setFailed] = useState(false);
  return (
    <span className={`shrink-0 overflow-hidden rounded-lg bg-white ring-1 ring-line ${className}`} aria-hidden="true">
      {cover && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element -- 3유형 원본은 그대로
        <img src={cover.thumb ?? cover.url} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} className={`size-full ${cover.thumb ? "object-cover" : "object-contain"}`} />
      ) : (
        <span className="flex size-full items-center justify-center text-ink-sub">{(category && CATEGORY_ICON[category]?.(18)) ?? <Images size={18} />}</span>
      )}
    </span>
  );
}

export function PlacePhoto({ id, name, category, size = "md", className = "" }: { id: string; name: string; category?: string; size?: keyof typeof SIZE; className?: string }) {
  const data = photosOf(id);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const cover = !failed ? data?.cover : undefined;
  const box = `${SIZE[size]} shrink-0 overflow-hidden rounded-xl bg-surface ${className}`;
  const icon = (
    <span className="flex size-full items-center justify-center text-ink-sub" aria-hidden="true">
      {(category && CATEGORY_ICON[category]?.(size === "sm" ? 22 : 28)) ?? <Images size={24} />}
    </span>
  );

  if (!data || data.photos.length === 0) {
    return <span className={box}>{icon}</span>;
  }
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${name} 사진 ${data.photos.length}장 크게 보기`}
        className={`${box} group relative transition-transform duration-150 active:scale-[0.97] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary`}
      >
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element -- 관광공사 원본(3유형)은 고치지 않고 그대로 불러온다
          <img
            src={cover.thumb ?? cover.url}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setFailed(true)}
            className={`size-full transition-transform duration-300 motion-safe:group-hover:scale-105 ${cover.thumb ? "object-cover" : "object-contain"}`}
          />
        ) : (
          icon
        )}
        {data.photos.length > 1 && (
          <span className="absolute right-1 bottom-1 rounded-md bg-ink/70 px-1 text-xs font-bold text-white tabular-nums" aria-hidden="true">
            {data.photos.length}
          </span>
        )}
      </button>
      <PhotoViewer open={open} onOpenChange={setOpen} name={name} photos={data.photos} />
    </>
  );
}

function PhotoViewer({ open, onOpenChange, name, photos }: { open: boolean; onOpenChange: (v: boolean) => void; name: string; photos: LabeledPhoto[] }) {
  const [i, setI] = useState(0);
  const track = useRef<HTMLUListElement>(null);
  const go = (n: number) => {
    const next = Math.max(0, Math.min(photos.length - 1, n));
    setI(next);
    const el = track.current?.children[next] as HTMLElement | undefined;
    el?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "nearest", inline: "center" });
  };
  // 손가락으로 넘기면 지금 보이는 사진 번호를 맞춘다
  useEffect(() => {
    const el = track.current;
    if (!open || !el) return;
    const onScroll = () => setI(Math.round(el.scrollLeft / el.clientWidth));
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [open]);
  const p = photos[i];

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) setI(0);
      }}
    >
      <DialogContent className="max-w-[calc(100%-1.5rem)] gap-3 rounded-3xl p-4 text-base sm:max-w-[44rem]" onKeyDown={(e) => (e.key === "ArrowRight" ? go(i + 1) : e.key === "ArrowLeft" ? go(i - 1) : undefined)}>
        <DialogTitle className="pr-12 text-lg font-bold">{name} 사진</DialogTitle>
        <DialogDescription className="sr-only">사진 {photos.length}장. 옆으로 넘기거나 화살표 버튼으로 볼 수 있어요.</DialogDescription>
        <ul ref={track} className="flex snap-x snap-mandatory overflow-x-auto rounded-2xl bg-surface [scrollbar-width:none]" aria-label={`${name} 사진 목록`}>
          {photos.map((x, n) => (
            <li key={x.url} className="w-full shrink-0 snap-center" aria-current={n === i ? "true" : undefined}>
              {/* eslint-disable-next-line @next/next/no-img-element -- 원본을 자르지 않고 그대로 */}
              <img
                src={x.url}
                alt={x.kind === "facility" ? `${name} 편의시설 사진: ${FACILITY_LABEL[x.facility ?? "etc"]}` : `${name} 사진 ${n + 1}`}
                loading={n < 2 ? "eager" : "lazy"}
                className="mx-auto aspect-[4/3] max-h-[60dvh] w-full object-contain"
              />
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => go(i - 1)} disabled={i === 0} aria-label="이전 사진" className="flex size-touch items-center justify-center rounded-full bg-surface text-ink transition-colors hover:bg-line disabled:opacity-40">
            <ChevronLeft size={22} aria-hidden="true" />
          </button>
          <p className="min-w-0 flex-1 text-center text-sm text-ink-sub" aria-live="polite">
            <span className="font-bold text-ink tabular-nums">
              {i + 1} / {photos.length}
            </span>
            {p?.kind === "facility" && <span className="ml-2 rounded-md bg-primary-soft px-1.5 py-0.5 font-medium text-primary-ink">편의시설 사진: {FACILITY_LABEL[p.facility ?? "etc"]}</span>}
            <span className="mt-0.5 block">{p ? photoCredit(p.kogl_type) : ""}</span>
          </p>
          <button type="button" onClick={() => go(i + 1)} disabled={i === photos.length - 1} aria-label="다음 사진" className="flex size-touch items-center justify-center rounded-full bg-surface text-ink transition-colors hover:bg-line disabled:opacity-40">
            <ChevronRight size={22} aria-hidden="true" />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
