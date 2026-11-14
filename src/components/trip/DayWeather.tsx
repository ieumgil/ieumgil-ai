// 날짜 블록 위 날씨 줄: 그날 가는 시마다 한 줄(예: 강릉 · 흐림 · 비 20% · 8~14℃). 하늘 상태는 아이콘 + 글자(색만으로 구분하지 않는다, D-08).
// 값은 /api/weather가 준 것을 day-view.ts가 정리한 것(화면 메모리뿐, 저장 안 함). 글은 고정 문구와 숫자뿐이다(기상청 원문을 그리지 않는다).
// 받지 못했으면(view가 null) 아무것도 그리지 않는다(D-05). 지난 날·범위 밖은 안내 한 줄(D-09).
import { Cloud, CloudRain, CloudSnow, CloudSun, Sun, type LucideIcon } from "lucide-react";
import type { DayWeatherView } from "@/lib/weather/day-view";
import type { WeatherIconName } from "@/lib/weather/labels";

const ICONS: Record<WeatherIconName, LucideIcon> = { snow: CloudSnow, rain: CloudRain, sun: Sun, "cloud-sun": CloudSun, cloud: Cloud };

export function DayWeather({ view }: { view: DayWeatherView | null }) {
  if (!view) return null;
  if (view.kind === "note") return <p className="mb-3 rounded-2xl bg-surface px-3 py-2 text-base text-ink-sub">{view.text}</p>;
  return (
    <ul aria-label="이날 날씨" className="mb-3 flex flex-col gap-1 rounded-2xl bg-surface px-3 py-2 text-base text-ink">
      {view.lines.map((line) => {
        const Icon = line.icon ? ICONS[line.icon] : null;
        return (
          <li key={line.region} className="flex items-center gap-2">
            {Icon && <Icon size={18} aria-hidden="true" className="shrink-0" />}
            <span>{line.text}</span>
          </li>
        );
      })}
    </ul>
  );
}
