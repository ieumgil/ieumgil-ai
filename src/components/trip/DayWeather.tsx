// 날짜 블록 위 날씨 줄: 그날 가는 시마다 한 줄(예: 강릉 · 흐림 · 비 20% · 8~14℃). 하늘 상태는 아이콘 + 글자(색만으로 구분하지 않는다).
// 값은 /api/weather가 준 것(화면 메모리뿐, 저장 안 함). 받지 못했거나 그날 예보가 없으면 아무것도 그리지 않는다(D-05).
import { Cloud, CloudRain, CloudSnow, CloudSun, Sun, type LucideIcon } from "lucide-react";
import { weatherIcon, weatherLine, type WeatherIconName } from "@/lib/weather/labels";
import type { WeatherPayload } from "@/lib/weather/types";
import type { DayView, TripView } from "@/lib/trip/view";
import type { Region } from "@/lib/types";

const ICONS: Record<WeatherIconName, LucideIcon> = { snow: CloudSnow, rain: CloudRain, sun: Sun, "cloud-sun": CloudSun, cloud: Cloud };

/** 그날 방문 장소의 시를 첫 방문 순서로, 중복 없이 */
function regionsOfDay(d: DayView, trip: TripView): Region[] {
  const out: Region[] = [];
  for (const it of d.items) {
    if (it.kind !== "visit") continue;
    const region = trip.places[it.placeId]?.region;
    if (region && !out.includes(region)) out.push(region);
  }
  return out;
}

export function DayWeather({ d, trip, weather }: { d: DayView; trip: TripView; weather: WeatherPayload | null }) {
  if (!weather) return null;
  const rows = regionsOfDay(d, trip).flatMap((region) => {
    const day = weather.regions[region]?.[d.date];
    return day ? [{ region, day }] : [];
  });
  if (rows.length === 0) return null;
  return (
    <ul aria-label="이날 날씨" className="mb-3 flex flex-col gap-1 rounded-2xl bg-surface px-3 py-2 text-base text-ink">
      {rows.map(({ region, day }) => {
        const name = weatherIcon(day);
        const Icon = name ? ICONS[name] : null;
        return (
          <li key={region} className="flex items-center gap-2">
            {Icon && <Icon size={18} aria-hidden="true" className="shrink-0" />}
            <span>{weatherLine(region, day)}</span>
          </li>
        );
      })}
    </ul>
  );
}
