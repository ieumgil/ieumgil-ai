"use client";

// 머리줄 오늘 날씨(11/25): 시작 화면 히어로에 있던 '오늘 영동 날씨'를 모든 화면의 머리줄(메뉴 줄) 안으로 옮겼다(히어로 배경이 너무 커져서).
//   따로 띠를 한 줄 더 만들지 않고 메뉴 옆 작은 칸으로 — 사용자 결정.
// 레퍼런스(웹쟁이 '관광' 검색): 계룡시 문화관광(메뉴 위쪽에 날짜·오늘 날씨 한 줄) + 함안군청(인기검색어가 몇 초마다 위로 굴러가며 바뀜).
// - 강릉 → 속초 → 동해를 3초마다 바꿔 보여 준다. 저절로 바뀌는 내용이라 멈출 수 있어야 해서(WCAG 2.2.2) 칸 자체가 버튼이다(누르는 자리 44px).
//   눈에 보이는 멈춤 아이콘·'기상청' 글자는 두지 않는다(11/25 사용자: 신경 쓰임) — 마우스를 올리면 '누르면 멈춰요', 출처는 화면 읽기 글자와 확정·공유 화면 날씨 칸에.
// - 화면 읽기 프로그램에는 세 도시를 한 번에 읽어 주고(sr-only), 바뀌는 글자는 읽지 않는다.
// - 동작 줄이기 설정이면 굴리지 않고 강릉만 보여 준다(세 도시는 화면 읽기 글자와 확정 화면 날씨에).
// - 못 받으면(키 없음·실패) 칸을 그리지 않는다.
// 값은 /api/weather(기상청 예보)를 열 때 받아 메모리에서만 쓴다(저장 안 함, 원칙 3). 문구는 코드가 정한 고정 문구와 숫자뿐.
import { Cloud, CloudRain, CloudSnow, CloudSun, Sun, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useMedia } from "@/lib/use-media";
import { skyPrecipText, tempText, weatherIcon, type WeatherIconName } from "@/lib/weather/labels";
import { useWeather } from "@/lib/weather/use-weather";
import type { Region } from "@/lib/types";

const ICONS: Record<WeatherIconName, LucideIcon> = { snow: CloudSnow, rain: CloudRain, sun: Sun, "cloud-sun": CloudSun, cloud: Cloud };
const REGIONS: Region[] = ["강릉", "속초", "동해"];
/** 다음 도시로 넘어가는 간격(globals.css .weather-roll 움직임은 이보다 짧다) */
const ROLL_MS = 3000;

type Item = { r: Region; icon: LucideIcon | null; temp: string | null; detail: string | null };

export function WeatherTicker() {
  const w = useWeather();
  const reduce = useMedia("(prefers-reduced-motion: reduce)");
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  const items: Item[] = w
    ? REGIONS.flatMap((r) => {
        const f = w.regions[r]?.[w.today];
        if (!f) return [];
        const icon = weatherIcon(f);
        return [{ r, icon: icon ? ICONS[icon] : null, temp: tempText(f), detail: skyPrecipText(f) }];
      })
    : [];
  const rolling = !reduce && items.length > 1;
  const running = rolling && !paused;

  useEffect(() => {
    if (!running) return;
    const t = window.setTimeout(() => setI((n) => (n + 1) % items.length), ROLL_MS);
    return () => window.clearTimeout(t);
  }, [running, i, items.length]);

  if (items.length === 0) return null;
  const it = items[rolling ? i % items.length : 0];
  const Icon = it.icon;

  const face = (
    // 바뀌는 글자(장식으로 읽지 않음): 한 줄 높이만 보이고 새 도시가 아래에서 올라온다
    <span aria-hidden="true" className="relative inline-flex h-7 items-center overflow-hidden">
      <span key={it.r} data-weather-current="" className="weather-roll items-center gap-1.5 whitespace-nowrap">
        {Icon && <Icon size={20} className="shrink-0 text-primary-ink" />}
        <span className="font-medium text-ink">{it.r}</span>
        {/* 하늘·강수는 넓은 PC에서만(그 밖에는 도시 + 기온) */}
        {it.detail && <span className="hidden 2xl:inline">{it.detail}</span>}
        {it.temp && <span className="tabular-nums">{it.temp}</span>}
      </span>
    </span>
  );

  return (
    <div role="group" aria-label="오늘 영동 날씨" className="flex shrink-0 items-center text-base text-ink-sub">
      {/* 화면 읽기: 세 도시를 한 번에 + 출처 */}
      <span className="sr-only">
        {items.map((x) => [x.r, x.detail, x.temp].filter(Boolean).join(" ")).join(", ")}. 기상청 예보
      </span>
      {rolling ? (
        // 칸 전체가 멈추기 버튼: 누르면 멈추고 다시 누르면 이어서 바뀐다
        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          aria-label={paused ? "날씨 넘김 다시 시작" : "날씨 넘김 멈추기"}
          title={paused ? "누르면 다시 넘겨요" : "누르면 멈춰요"}
          className="inline-flex min-h-touch items-center rounded-full px-3 hover:bg-surface focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {face}
        </button>
      ) : (
        <span className="inline-flex min-h-touch items-center px-3">{face}</span>
      )}
    </div>
  );
}
