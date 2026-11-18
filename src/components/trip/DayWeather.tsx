// 날짜 블록 위 날씨 칸: 그날 가는 시마다 한 칸. 왼쪽 큰 아이콘 · 첫 줄 "날씨 · 강릉"과 큰 기온(7~11℃) · 둘째 줄 "흐림 · 비 70%".
// 비·눈 확률이 60% 이상이면 칸에 주의 테두리·바탕과 "! 비 예보" 글자 표식이 붙는다(기호 + 글자, 색만으로 구분하지 않는다, D-08).
// 값은 /api/weather가 준 것을 day-view.ts가 정리한 것(화면 메모리뿐, 저장 안 함). 글은 고정 문구와 숫자뿐이다(기상청 원문을 그리지 않는다).
// 받지 못했으면(view가 null) 아무것도 그리지 않는다(D-05). 지난 날·범위 밖은 안내 한 줄(D-09).
import { Cloud, CloudRain, CloudSnow, CloudSun, Sun, type LucideIcon } from "lucide-react";
import type { DayWeatherView } from "@/lib/weather/day-view";
import type { WeatherIconName } from "@/lib/weather/labels";

const ICONS: Record<WeatherIconName, LucideIcon> = { snow: CloudSnow, rain: CloudRain, sun: Sun, "cloud-sun": CloudSun, cloud: Cloud };

export function DayWeather({ view }: { view: DayWeatherView | null }) {
  if (!view) return null;
  if (view.kind === "note") return <p className="mb-3 rounded-2xl bg-surface px-4 py-3 text-base text-ink-sub">{view.text}</p>;
  return (
    <ul aria-label="이날 날씨" className="mb-3 flex flex-col gap-2">
      {view.lines.map((line) => {
        const Icon = line.icon ? ICONS[line.icon] : null;
        if (!line.hasForecast) {
          return (
            <li key={line.region} className="rounded-2xl bg-surface px-4 py-3 text-base text-ink-sub">
              {line.text}
            </li>
          );
        }
        return (
          <li
            key={line.region}
            className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-base ${
              line.rain ? "border-[1.5px] border-caution-ink bg-caution-bg text-caution-ink" : "bg-surface text-ink"
            }`}
          >
            {Icon && <Icon size={32} strokeWidth={1.75} aria-hidden="true" className="shrink-0" />}
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-baseline gap-x-3 font-medium">
                <span>날씨 · {line.region}</span>
                {line.temp && <span className="text-heading tabular-nums">{line.temp}</span>}
              </p>
              {(line.detail || line.rain) && (
                <p className="flex flex-wrap items-baseline gap-x-3">
                  {line.detail && <span>{line.detail}</span>}
                  {line.rain && (
                    <span className="font-medium">
                      <span aria-hidden="true">!</span> {line.rain}
                    </span>
                  )}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
