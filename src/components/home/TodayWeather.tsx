"use client";

// 히어로의 오늘 날씨 한 줄(레퍼런스: 울진·보령·청양 관광 — 첫 화면에 오늘 날짜·날씨).
// 값은 /api/weather(기상청 예보)를 열 때 받아 메모리에서만 쓴다(저장 안 함, 원칙 3). 문구는 코드가 정한 고정 문구와 숫자뿐.
// 받지 못하면 아무것도 그리지 않는다.
import { Cloud, CloudRain, CloudSnow, CloudSun, Sun, type LucideIcon } from "lucide-react";
import { skyPrecipText, tempText, weatherIcon, type WeatherIconName } from "@/lib/weather/labels";
import { useWeather } from "@/lib/weather/use-weather";
import type { Region } from "@/lib/types";

const ICONS: Record<WeatherIconName, LucideIcon> = { snow: CloudSnow, rain: CloudRain, sun: Sun, "cloud-sun": CloudSun, cloud: Cloud };
const REGIONS: Region[] = ["속초", "강릉", "동해"];

export function TodayWeather() {
  const w = useWeather();
  if (!w) return null;
  const items = REGIONS.flatMap((r) => {
    const f = w.regions[r]?.[w.today];
    if (!f) return [];
    const icon = weatherIcon(f);
    return [{ r, icon: icon ? ICONS[icon] : null, temp: tempText(f), detail: skyPrecipText(f) }];
  });
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-2 lg:items-end">
      <p className="text-base text-ink-sub">오늘 영동 날씨 · 기상청 예보</p>
      <ul className="flex flex-wrap gap-2 lg:justify-end">
        {items.map((it) => (
          <li key={it.r} className="flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 text-base text-ink">
            {it.icon && <it.icon size={20} aria-hidden="true" className="text-primary-ink" />}
            <span className="font-medium">{it.r}</span>
            {it.detail && <span>{it.detail}</span>}
            {it.temp && <span className="tabular-nums">{it.temp}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
