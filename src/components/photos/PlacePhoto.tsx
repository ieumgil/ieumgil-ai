"use client";

// 관광지 작은 사진 + 크게 보기.
// - 1유형 대표: 미리 줄여 둔 작은 사진(잘라서 꽉 채움)
// - 3유형 대표: 관광공사 원본을 그대로 불러와 자르지 않고 통째로(object-contain, 옅은 여백)
// - 사진이 한 장도 없으면 사진 자리를 아예 두지 않는다(빈 칸·아이콘 없이)
// - 대표로 쓸 사진이 없거나 못 불러오면 분류 아이콘(누르면 편의시설 사진 등은 볼 수 있다)
// - 누를 수 있다는 걸 알 수 있게 오른쪽 아래에 돋보기 + 장수 표시
// 누르면 크게 보기: 손가락으로 밀기 · 마우스 휠 · 마우스로 끌기 · 화살표 버튼 · 키보드 ←→로 넘긴다.
// 편의시설 사진은 "편의시설 사진: 화장실"처럼 표시, 사진마다 출처.
import { Binoculars, ChevronLeft, ChevronRight, Frame, Images, Landmark, Store, Trees, Waves, ZoomIn } from "lucide-react";
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

  if (!data || data.photos.length === 0) return null;
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
        <span className="absolute right-1 bottom-1 inline-flex items-center gap-0.5 rounded-md bg-ink/75 px-1 py-px text-xs font-bold text-white tabular-nums" aria-hidden="true">
          <ZoomIn size={12} strokeWidth={2.5} />
          {data.photos.length > 1 && data.photos.length}
        </span>
      </button>
      <PhotoViewer open={open} onOpenChange={setOpen} name={name} photos={data.photos} />
    </>
  );
}

function PhotoViewer({ open, onOpenChange, name, photos }: { open: boolean; onOpenChange: (v: boolean) => void; name: string; photos: LabeledPhoto[] }) {
  const [i, setI] = useState(0);
  // 대화창은 열린 뒤에 그려지므로 ref 객체 대신 상태로 받아야 넘기기 처리를 붙일 수 있다
  const [track, setTrack] = useState<HTMLUListElement | null>(null);
  const last = photos.length - 1;
  const go = (n: number) => {
    if (!track) return;
    const next = Math.max(0, Math.min(last, n));
    setI(next);
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    track.scrollTo({ left: next * track.clientWidth, behavior: smooth ? "smooth" : "auto" });
  };
  const goRef = useRef(go);
  useEffect(() => {
    goRef.current = go;
  });

  useEffect(() => {
    const el = track;
    if (!el) return;
    // 손가락으로 밀거나 끌어서 넘기면 지금 보이는 사진 번호를 맞춘다
    const onScroll = () => setI(Math.max(0, Math.min(last, Math.round(el.scrollLeft / el.clientWidth))));
    // 마우스 휠(위아래)로도 한 장씩 넘긴다. 연달아 오는 휠 신호는 한 번으로 친다
    let lock = 0;
    const onWheel = (e: WheelEvent) => {
      const d = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : 0;
      if (!d) return; // 옆으로 미는 터치패드는 브라우저가 알아서
      e.preventDefault();
      if (Date.now() < lock) return;
      lock = Date.now() + 350;
      const now = Math.round(el.scrollLeft / el.clientWidth);
      goRef.current(now + (d > 0 ? 1 : -1));
    };
    // 마우스로 끌어서 넘기기(손가락은 브라우저 기본 밀기)
    let startX: number | null = null;
    const onDown = (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button === 0) startX = e.clientX;
    };
    const onUp = (e: PointerEvent) => {
      if (startX === null) return;
      const dx = e.clientX - startX;
      startX = null;
      if (Math.abs(dx) > 40) goRef.current(Math.round(el.scrollLeft / el.clientWidth) + (dx < 0 ? 1 : -1));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    return () => {
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
    };
  }, [track, last]);
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
        <DialogDescription className="sr-only">사진 {photos.length}장. 옆으로 밀거나 화살표 버튼으로 넘겨 볼 수 있어요.</DialogDescription>
        <ul ref={setTrack} className="flex cursor-grab snap-x snap-mandatory overflow-x-auto overscroll-x-contain rounded-2xl bg-surface select-none [scrollbar-width:none] active:cursor-grabbing" aria-label={`${name} 사진 목록`}>
          {photos.map((x, n) => (
            <li key={x.url} className="w-full shrink-0 snap-center" aria-current={n === i ? "true" : undefined}>
              {/* eslint-disable-next-line @next/next/no-img-element -- 원본을 자르지 않고 그대로 */}
              <img
                src={x.url}
                alt={x.kind === "facility" ? `${name} 편의시설 사진: ${FACILITY_LABEL[x.facility ?? "etc"]}` : `${name} 사진 ${n + 1}`}
                loading={n < 2 ? "eager" : "lazy"}
                draggable={false}
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
