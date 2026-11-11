"use client";

// 하루 일정 지도(카카오 지도 JS SDK): 출발·도착 깃발, 장소 번호(타임라인 번호와 같음), 일반 차량 경로선.
// 경로선은 /api/route-line(카카오 다중 경유지 길찾기)에서 열 때마다 받고 저장하지 않는다(캐싱 금지).
// 경로를 못 받으면 점선 직선으로 잇고 그렇다고 알린다. 지도 자체를 못 띄우면 안내 문구만 보여준다(일정은 그대로).
// 안 비교 화면과 확정 화면이 같이 쓴다. 창 크기가 바뀌어 지도 칸 크기가 바뀌면 다시 맞춘다(PC ↔ 휴대폰 배치 전환).
import { useEffect, useRef, useState } from "react";
import type { MapPoint } from "@/lib/trip/map-points";

export type { MapPoint };

type Line = { path: [number, number][]; km: number; minutes: number } | null;

/* 카카오 SDK에서 쓰는 것만 최소로 */
type KLatLng = object;
interface KakaoMaps {
  load(cb: () => void): void;
  LatLng: new (lat: number, lng: number) => KLatLng;
  LatLngBounds: new () => { extend(p: KLatLng): void };
  Map: new (el: HTMLElement, o: { center: KLatLng; level: number }) => { setBounds(b: object, ...pad: number[]): void; relayout(): void };
  CustomOverlay: new (o: { position: KLatLng; content: HTMLElement; yAnchor?: number; zIndex?: number }) => { setMap(m: object | null): void };
  Polyline: new (o: { path: KLatLng[]; strokeWeight: number; strokeColor: string; strokeOpacity: number; strokeStyle?: string }) => { setMap(m: object | null): void };
}
declare global {
  interface Window {
    kakao?: { maps: KakaoMaps };
  }
}

const JS_KEY = process.env.NEXT_PUBLIC_KAKAO_JS_KEY?.trim();
let sdk: Promise<KakaoMaps> | null = null;

function loadSdk(): Promise<KakaoMaps> {
  if (!JS_KEY) return Promise.reject(new Error("지도 키 없음"));
  sdk ??= new Promise<KakaoMaps>((resolve, reject) => {
    const done = () => window.kakao!.maps.load(() => resolve(window.kakao!.maps));
    if (window.kakao?.maps) return done();
    const s = document.createElement("script");
    s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${JS_KEY}&autoload=false`;
    s.async = true;
    s.onload = () => (window.kakao?.maps ? done() : reject(new Error("지도 SDK 없음")));
    s.onerror = () => reject(new Error("지도 SDK를 불러오지 못함"));
    document.head.appendChild(s);
  }).catch((e) => {
    sdk = null; // 다음에 다시 시도
    throw e;
  });
  return sdk;
}

/** 경로선(열 때마다 새로 받는다). undefined = 받는 중 */
function useRouteLine(points: MapPoint[]): Line | undefined {
  const key = points.map((p) => `${p.lat},${p.lng}`).join("|");
  const [state, setState] = useState<{ key: string; line: Line } | null>(null);
  useEffect(() => {
    const ctrl = new AbortController();
    fetch("/api/route-line", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ days: [{ points: key.split("|").map((s) => ({ lat: Number(s.split(",")[0]), lng: Number(s.split(",")[1]) })) }] }),
      signal: ctrl.signal,
    })
      .then((r) => (r.ok ? r.json() : { days: [null] }))
      .then((j: { days: Line[] }) => setState({ key, line: j.days[0] ?? null }))
      .catch(() => !ctrl.signal.aborted && setState({ key, line: null }));
    return () => ctrl.abort();
  }, [key]);
  return state?.key === key ? state.line : undefined;
}

function marker(p: MapPoint): HTMLElement {
  const el = document.createElement("div");
  el.textContent = p.label;
  el.title = p.name;
  el.setAttribute("aria-hidden", "true");
  el.style.cssText =
    p.kind === "stop"
      ? "display:flex;align-items:center;justify-content:center;width:2rem;height:2rem;border-radius:9999px;background:#1E6FD0;color:#fff;font-weight:700;font-size:1rem;border:3px solid #fff;box-shadow:0 1px 4px rgb(0 0 0/.3)"
      : "padding:0.125rem 0.5rem;border-radius:9999px;background:#191F28;color:#fff;font-weight:700;font-size:0.875rem;border:2px solid #fff;box-shadow:0 1px 4px rgb(0 0 0/.3);white-space:nowrap";
  return el;
}

type Drawn = { maps: KakaoMaps; map: InstanceType<KakaoMaps["Map"]>; points: MapPoint[] };

/** points는 바뀔 때만 새 배열이 되게(useMemo) 넘긴다 — 바뀌면 지도를 다시 그린다 */
export function TripMap({ points, label, className = "" }: { points: MapPoint[]; label: string; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const [drawn, setDrawn] = useState<Drawn | null>(null);
  const line = useRouteLine(points);

  // 1) 지도와 표시(장소가 바뀔 때만 다시)
  useEffect(() => {
    let cancelled = false;
    const overlays: { setMap(m: object | null): void }[] = [];
    loadSdk()
      .then((maps) => {
        if (cancelled || !box.current) return;
        const pts = points;
        const pos = (p: { lat: number; lng: number }) => new maps.LatLng(p.lat, p.lng);
        box.current.replaceChildren();
        const map = new maps.Map(box.current, { center: pos(pts[0]), level: 7 });
        const seen = new Set<string>();
        for (const p of pts) {
          const k = `${p.lat},${p.lng}`;
          if (p.kind !== "stop" && seen.has(k)) continue; // 출발·도착이 같은 곳이면 깃발 하나
          seen.add(k);
          const both = p.kind === "start" && pts.some((q) => q.kind === "end" && q.lat === p.lat && q.lng === p.lng);
          const o = new maps.CustomOverlay({ position: pos(p), content: marker(both ? { ...p, label: "출발·도착" } : p), yAnchor: 0.5, zIndex: p.kind === "stop" ? 3 : 2 });
          o.setMap(map);
          overlays.push(o);
        }
        setDrawn({ maps, map, points: pts });
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      overlays.forEach((o) => o.setMap(null));
    };
  }, [points]);

  // 지도 칸 크기가 바뀌면(배치 전환·창 크기) 지도를 다시 맞춘다
  const fit = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (!drawn || !box.current) return;
    const ro = new ResizeObserver(() => {
      drawn.map.relayout();
      fit.current?.();
    });
    ro.observe(box.current);
    return () => ro.disconnect();
  }, [drawn]);

  // 2) 경로선(받으면 그리고, 못 받으면 점선 직선)
  useEffect(() => {
    if (!drawn || line === undefined) return;
    const { maps, map, points: pts } = drawn;
    const path = line ? line.path.map(([lat, lng]) => new maps.LatLng(lat, lng)) : pts.map((p) => new maps.LatLng(p.lat, p.lng));
    const pl = new maps.Polyline({ path, strokeWeight: line ? 6 : 4, strokeColor: "#E8743B", strokeOpacity: 0.9, strokeStyle: line ? "solid" : "shortdash" });
    pl.setMap(map);
    const bounds = new maps.LatLngBounds();
    pts.forEach((p) => bounds.extend(new maps.LatLng(p.lat, p.lng)));
    path.forEach((p) => bounds.extend(p));
    fit.current = () => map.setBounds(bounds, 40, 40, 40, 40);
    fit.current();
    return () => {
      fit.current = null;
      pl.setMap(null);
    };
  }, [drawn, line]);

  if (failed) {
    return (
      <div className={`flex flex-col items-center justify-center gap-1 rounded-2xl bg-surface p-6 text-center text-ink-sub ${className}`} role="note">
        <p className="text-base font-medium">지도를 불러오지 못했어요</p>
        <p className="text-sm">일정과 순서는 아래 목록에서 그대로 볼 수 있어요.</p>
      </div>
    );
  }
  return (
    <figure className={`flex flex-col overflow-hidden rounded-2xl bg-surface ${className}`}>
      <div ref={box} className="min-h-0 flex-1" role="img" aria-label={label} />
      <figcaption className="border-t border-line px-3 py-2 text-sm text-ink-sub">
        {line === undefined
          ? "경로를 불러오는 중이에요"
          : line
            ? `일반 차량 경로 · 약 ${line.km}km · 약 ${line.minutes}분(카카오)`
            : "경로를 불러오지 못해 순서대로 직선으로 이었어요"}
      </figcaption>
    </figure>
  );
}
