"use client";

// 하루 일정 지도(카카오 지도 JS SDK). 안 비교 화면과 확정 화면이 같이 쓴다.
// - 장소: 번호(타임라인 번호와 같음) + 옆에 짧은 이름. 번호를 누르면 작은 카드(사진·이름·시각·판단, '일정에서 보기').
// - 출발·도착: 점 위에 '출발'/'도착' 표(경로선을 가리지 않게 위로 띄운다).
// - 경로선: 구간(출발 → 1, 1 → 2 …)마다 흰 테두리 + 주황 선, 구간 한가운데에 진행 방향 화살표와 '11분' 같은 이동시간 표.
// 경로선은 /api/route-line(카카오 다중 경유지 길찾기)에서 열 때마다 받고 저장하지 않는다(캐싱 금지). "일반 차량 경로"다.
// 경로를 못 받으면 점선 직선(구간마다 화살표)으로 잇고 그렇다고 알린다. 지도 자체를 못 띄우면 안내 문구만 보여준다(일정은 그대로).
// 창 크기가 바뀌어 지도 칸 크기가 바뀌면 다시 맞춘다(PC ↔ 휴대폰 배치 전환).
import { useEffect, useRef, useState } from "react";
import { photosOf } from "@/lib/places/client-photos";
import { splitAtMiddle, type LatLngPair } from "@/lib/trip/map-geo";
import type { MapPoint, StopDetail } from "@/lib/trip/map-points";

export type { MapPoint };

type Section = { path: LatLngPair[]; km: number; minutes: number };
type Line = { path: LatLngPair[]; km: number; minutes: number; sections?: Section[] } | null;

/* 카카오 SDK에서 쓰는 것만 최소로 */
type KLatLng = object;
type KMap = { setBounds(b: object, ...pad: number[]): void; relayout(): void; panTo(p: KLatLng): void; panBy(dx: number, dy: number): void };
type KOverlay = { setMap(m: object | null): void };
interface KakaoMaps {
  load(cb: () => void): void;
  LatLng: new (lat: number, lng: number) => KLatLng;
  LatLngBounds: new () => { extend(p: KLatLng): void };
  Map: new (el: HTMLElement, o: { center: KLatLng; level: number }) => KMap;
  CustomOverlay: new (o: { position: KLatLng; content: HTMLElement; xAnchor?: number; yAnchor?: number; zIndex?: number; clickable?: boolean }) => KOverlay;
  Polyline: new (o: { path: KLatLng[]; strokeWeight: number; strokeColor: string; strokeOpacity: number; strokeStyle?: string; zIndex?: number }) => KOverlay;
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

const COLOR = { primary: "#1E6FD0", ink: "#191F28", sub: "#4E5968", route: "#E8743B", line: "#E5E8EB" };
const SHADOW = "0 1px 4px rgb(0 0 0/.3)";
const VERDICT_STYLE: Record<StopDetail["verdict"], { sym: string; bg: string; fg: string }> = {
  적합: { sym: "✓", bg: "#EAF2FD", fg: "#1450A3" },
  주의: { sym: "!", bg: "#FFF4E5", fg: "#7A4A00" },
  "확인 필요": { sym: "!", bg: "#FFF4E5", fg: "#7A4A00" },
  부적합: { sym: "✕", bg: "#FBEAE7", fg: "#8A2A1C" },
};

function el<K extends keyof HTMLElementTagNameMap>(tag: K, css: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.style.cssText = css;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** 장소: 누를 수 있는 번호(터치 영역 44px) + 오른쪽에 짧은 이름 */
function stopMarker(p: MapPoint, short: string, onClick: () => void): HTMLElement {
  const wrap = el("div", "position:relative;width:2.75rem;height:2.75rem");
  const btn = el("button", "display:flex;align-items:center;justify-content:center;width:100%;height:100%;padding:0;border:0;background:transparent;cursor:pointer");
  btn.type = "button";
  btn.setAttribute("aria-label", `${p.label}번 ${p.name} 정보 보기`);
  btn.append(el("span", `display:flex;align-items:center;justify-content:center;width:2rem;height:2rem;border-radius:9999px;background:${COLOR.primary};color:#fff;font-weight:700;font-size:1rem;border:3px solid #fff;box-shadow:${SHADOW}`, p.label));
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    onClick();
  });
  const name = el(
    "span",
    `position:absolute;left:calc(100% - 0.25rem);top:50%;transform:translateY(-50%);max-width:8rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0.125rem 0.5rem;border-radius:9999px;background:#fff;color:${COLOR.ink};font-weight:700;font-size:0.9375rem;line-height:1.4;box-shadow:${SHADOW};pointer-events:none`,
    short,
  );
  name.setAttribute("aria-hidden", "true");
  wrap.append(btn, name);
  return wrap;
}

/** 출발·도착: 작은 점 + 위에 띄운 표(경로선을 가리지 않게) */
function endMarker(text: string): HTMLElement {
  const wrap = el("div", "position:relative;width:0.875rem;height:0.875rem");
  wrap.setAttribute("aria-hidden", "true");
  wrap.append(
    el("span", `display:block;width:100%;height:100%;border-radius:9999px;background:${COLOR.ink};border:2px solid #fff;box-shadow:${SHADOW}`),
    el(
      "span",
      `position:absolute;bottom:calc(100% + 0.25rem);left:50%;transform:translateX(-50%);white-space:nowrap;padding:0.125rem 0.5rem;border-radius:9999px;background:${COLOR.ink};color:#fff;font-weight:700;font-size:0.875rem;border:2px solid #fff;box-shadow:${SHADOW}`,
      text,
    ),
  );
  return wrap;
}

/** 구간 표: 진행 방향 화살표(구간 가운데에서의 방향으로 돌림) + 이동시간 */
function legLabel(angle: number, minutes?: number): HTMLElement {
  const e = el(
    "span",
    `display:flex;align-items:center;gap:0.125rem;padding:0.0625rem ${minutes ? "0.375rem 0.0625rem 0.125rem" : "0.125rem"};border-radius:9999px;background:#fff;color:${COLOR.route};font-weight:700;font-size:0.8125rem;line-height:1.4;border:1.5px solid ${COLOR.route};white-space:nowrap;box-shadow:0 1px 3px rgb(0 0 0/.18)`,
  );
  e.setAttribute("aria-hidden", "true");
  const arrow = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  arrow.setAttribute("viewBox", "0 0 16 16");
  arrow.setAttribute("width", "16");
  arrow.setAttribute("height", "16");
  arrow.style.cssText = `flex:none;transform:rotate(${angle}deg)`;
  arrow.innerHTML = `<path d="M3 8h9M8.5 4l4 4-4 4" fill="none" stroke="${COLOR.route}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`;
  e.append(arrow);
  if (minutes) e.append(document.createTextNode(`${minutes}분`));
  return e;
}

/** 번호를 눌렀을 때 뜨는 작은 카드 */
function stopCard(id: string, d: StopDetail, onPick: (() => void) | undefined, onClose: () => void): HTMLElement {
  const card = el("div", `width:16.5rem;padding:0.75rem;border-radius:1rem;background:#fff;color:${COLOR.ink};box-shadow:0 4px 20px rgb(25 31 40/.22);font-size:1rem;line-height:1.45;text-align:left`);
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-label", `${d.no}번 ${d.name}`);
  const row = el("div", "display:flex;gap:0.625rem;align-items:flex-start");
  const cover = photosOf(id)?.cover;
  if (cover) {
    const img = el("img", `width:3.5rem;height:3.5rem;flex:none;border-radius:0.625rem;background:#F2F4F6;object-fit:${cover.thumb ? "cover" : "contain"}`);
    img.src = cover.thumb ?? cover.url;
    img.alt = "";
    row.append(img);
  }
  const text = el("div", "flex:1;min-width:0");
  text.append(el("p", "margin:0;font-weight:700;word-break:keep-all;overflow-wrap:anywhere", `${d.no}. ${d.name}`), el("p", `margin:0.125rem 0 0;color:${COLOR.primary};font-weight:700;font-variant-numeric:tabular-nums`, d.time));
  const v = VERDICT_STYLE[d.verdict];
  text.append(el("p", `display:inline-block;margin:0.25rem 0 0;padding:0 0.5rem;border-radius:0.5rem;background:${v.bg};color:${v.fg};font-weight:600;font-size:0.9375rem`, `${v.sym} ${d.verdictLabel}`));
  const close = el("button", `flex:none;display:flex;align-items:center;justify-content:center;width:2.75rem;height:2.75rem;margin:-0.5rem -0.375rem 0 0;border:0;border-radius:0.75rem;background:transparent;color:${COLOR.sub};font-size:1.25rem;cursor:pointer`, "✕");
  close.type = "button";
  close.setAttribute("aria-label", "카드 닫기");
  close.addEventListener("click", (e) => {
    e.stopPropagation();
    onClose();
  });
  row.append(text, close);
  card.append(row);
  if (onPick) {
    const go = el("button", `display:flex;align-items:center;justify-content:center;width:100%;min-height:2.75rem;margin-top:0.5rem;border:0;border-radius:0.75rem;background:#EAF2FD;color:#1450A3;font-weight:700;font-size:1rem;cursor:pointer`, "일정에서 보기");
    go.type = "button";
    go.addEventListener("click", (e) => {
      e.stopPropagation();
      onPick();
    });
    card.append(go);
  }
  return card;
}

type Drawn = { maps: KakaoMaps; map: KMap; points: MapPoint[]; open: (id: string) => void };

/**
 * 점(장소·순서·좌표)이 바뀔 때만 지도를 다시 그린다(배열이 새로 만들어져도 내용이 같으면 그대로).
 * details: 장소 번호 카드 내용(시각은 화면 기준). onPick: 카드의 '일정에서 보기'. focus: 바뀌면 그 장소로 옮기고 카드를 연다.
 */
export function TripMap({
  points,
  label,
  className = "",
  details = {},
  onPick,
  focus,
}: {
  points: MapPoint[];
  label: string;
  className?: string;
  details?: Record<string, StopDetail>;
  onPick?: (placeId: string) => void;
  focus?: { id: string; n: number } | null;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const [drawn, setDrawn] = useState<Drawn | null>(null);
  const line = useRouteLine(points);
  const pointsKey = points.map((p) => `${p.kind}:${p.id}:${p.label}:${p.lat},${p.lng}`).join("|");
  const pointsRef = useRef(points);
  useEffect(() => {
    pointsRef.current = points;
  });
  // 카드는 누를 때 최신 내용으로 만든다(시각이 실제 이동시간으로 바뀌어도 지도를 다시 그리지 않게)
  const latest = useRef({ details, onPick });
  useEffect(() => {
    latest.current = { details, onPick };
  });

  // 1) 지도와 표시(장소가 바뀔 때만 다시)
  useEffect(() => {
    let cancelled = false;
    const overlays: KOverlay[] = [];
    let card: KOverlay | null = null;
    const closeCard = () => {
      card?.setMap(null);
      card = null;
    };
    loadSdk()
      .then((maps) => {
        if (cancelled || !box.current) return;
        const pts = pointsRef.current;
        const pos = (p: { lat: number; lng: number }) => new maps.LatLng(p.lat, p.lng);
        box.current.replaceChildren();
        const map = new maps.Map(box.current, { center: pos(pts[0]), level: 7 });
        const open = (id: string) => {
          const p = pts.find((x) => x.kind === "stop" && x.id === id);
          const d = latest.current.details[id];
          if (!p || !d) return;
          closeCard();
          const pick = latest.current.onPick;
          card = new maps.CustomOverlay({
            position: pos(p),
            content: stopCard(id, d, pick && (() => (closeCard(), pick(id))), closeCard),
            yAnchor: 1.18,
            zIndex: 10,
            clickable: true,
          });
          card.setMap(map);
          // 카드가 번호 위에 뜨므로, 번호가 지도 아래쪽에 오게 옮겨 카드가 잘리지 않게 한다
          map.panTo(pos(p));
          const h = box.current?.clientHeight ?? 0;
          setTimeout(() => map.panBy(0, -Math.round(h * 0.28)), 260);
        };
        const seen = new Set<string>();
        for (const p of pts) {
          const k = `${p.lat},${p.lng}`;
          if (p.kind !== "stop" && seen.has(k)) continue; // 출발·도착이 같은 곳이면 표 하나
          seen.add(k);
          const both = p.kind === "start" && pts.some((q) => q.kind === "end" && q.lat === p.lat && q.lng === p.lng);
          const content =
            p.kind === "stop" ? stopMarker(p, latest.current.details[p.id]?.short ?? p.name, () => open(p.id)) : endMarker(both ? "출발·도착" : p.label);
          const o = new maps.CustomOverlay({ position: pos(p), content, xAnchor: 0.5, yAnchor: 0.5, zIndex: p.kind === "stop" ? 4 : 3, clickable: p.kind === "stop" });
          o.setMap(map);
          overlays.push(o);
        }
        setDrawn({ maps, map, points: pts, open });
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      closeCard();
      overlays.forEach((o) => o.setMap(null));
    };
  }, [pointsKey]);

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

  // 2) 경로선: 구간마다 흰 테두리 + 주황 선 + 한가운데 화살표·이동시간(못 받으면 점선 직선 + 화살표)
  useEffect(() => {
    if (!drawn || line === undefined) return;
    const { maps, map, points: pts } = drawn;
    const ll = ([lat, lng]: LatLngPair) => new maps.LatLng(lat, lng);
    const shown: KOverlay[] = [];
    const add = (o: KOverlay) => (o.setMap(map), shown.push(o));
    const sections: { path: LatLngPair[]; minutes?: number }[] = line?.sections?.length
      ? line.sections
      : pts.slice(1).flatMap((p, i) => (p.lat === pts[i].lat && p.lng === pts[i].lng ? [] : [{ path: [[pts[i].lat, pts[i].lng], [p.lat, p.lng]] as LatLngPair[] }]));
    const dashed = !line;
    for (const s of sections) {
      if (s.path.length < 2) continue;
      const path = s.path.map(ll);
      if (!dashed) add(new maps.Polyline({ path, strokeWeight: 10, strokeColor: "#FFFFFF", strokeOpacity: 0.95, zIndex: 1 }));
      add(new maps.Polyline({ path, strokeWeight: dashed ? 4 : 6, strokeColor: COLOR.route, strokeOpacity: 0.95, strokeStyle: dashed ? "shortdash" : "solid", zIndex: 2 }));
      const half = splitAtMiddle(s.path);
      // 구간 한가운데: 진행 방향 화살표 + 이동시간
      if (half) add(new maps.CustomOverlay({ position: ll(half.mid), content: legLabel(half.angle, s.minutes), xAnchor: 0.5, yAnchor: 0.5, zIndex: 2 }));
    }
    const bounds = new maps.LatLngBounds();
    pts.forEach((p) => bounds.extend(new maps.LatLng(p.lat, p.lng)));
    (line?.path ?? []).forEach((p) => bounds.extend(ll(p)));
    // 오른쪽은 이름표가 있어 조금 더 비운다
    fit.current = () => map.setBounds(bounds, 48, 72, 40, 40);
    fit.current();
    return () => {
      fit.current = null;
      shown.forEach((o) => o.setMap(null));
    };
  }, [drawn, line]);

  // 3) 일정 카드에서 '지도에서 보기'를 누르면 그 장소로 옮기고 카드를 연다
  useEffect(() => {
    if (drawn && focus) drawn.open(focus.id);
  }, [drawn, focus]);

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
      <div ref={box} className="min-h-0 flex-1" role="group" aria-label={label} />
      <figcaption className="border-t border-line px-3 py-2 text-sm text-ink-sub">
        {line === undefined
          ? "경로를 불러오는 중이에요"
          : line
            ? `일반 차량 경로 · 약 ${line.km}km · 약 ${line.minutes}분(카카오) · 번호를 누르면 장소 정보`
            : "경로를 불러오지 못해 순서대로 직선으로 이었어요 · 번호를 누르면 장소 정보"}
      </figcaption>
    </figure>
  );
}
