// 단기예보 항목 → 날짜별 하루 값(순수 함수). 값을 지어내지 않는다: 없는 값은 null이고, 낮 창에 행이 없는 날은 넣지 않는다.
// 하루 대표값 규칙: 낮 창 = 06~21시(여행 활동 시간, 포함). 강수확률 = 창 안 최댓값, 하늘 = 창 안 최빈값(동률이면 더 흐린 쪽 4 > 3 > 1),
// 최저·최고 기온 = 그날 TMN·TMX, 없으면 그날 TMP의 최솟값·최댓값. 비·눈 종류(PTY)·지난 시각·결측 처리는 02-02에서 이 함수에 더한다.

import type { DayForecast, ShortItem } from "./types";

const WINDOW_FROM = "0600";
const WINDOW_TO = "2100";

const toISODate = (yyyymmdd: string) => `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;

function num(raw: string): number | null {
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : null;
}

function modeSky(values: number[]): 1 | 3 | 4 | null {
  const count = new Map<number, number>();
  for (const v of values) if (v === 1 || v === 3 || v === 4) count.set(v, (count.get(v) ?? 0) + 1);
  let best: 1 | 3 | 4 | null = null;
  for (const code of [1, 3, 4] as const) {
    // 같은 횟수면 나중 코드(더 흐린 쪽)가 이긴다
    if ((count.get(code) ?? 0) > 0 && (best === null || (count.get(code) ?? 0) >= (count.get(best) ?? 0))) best = code;
  }
  return best;
}

export function summarizeShort(items: ShortItem[]): Record<string, DayForecast> {
  const byDate = new Map<string, ShortItem[]>();
  for (const it of items) {
    if (!/^\d{8}$/.test(it.fcstDate)) continue;
    const list = byDate.get(it.fcstDate) ?? [];
    list.push(it);
    byDate.set(it.fcstDate, list);
  }

  const out: Record<string, DayForecast> = {};
  for (const [date, rows] of [...byDate].sort(([a], [b]) => a.localeCompare(b))) {
    const inWindow = rows.filter((r) => r.fcstTime >= WINDOW_FROM && r.fcstTime <= WINDOW_TO);
    if (inWindow.length === 0) continue;
    const win = (category: string) => inWindow.filter((r) => r.category === category).map((r) => num(r.fcstValue)).filter((n): n is number => n !== null);
    const all = (category: string) => rows.filter((r) => r.category === category).map((r) => num(r.fcstValue)).filter((n): n is number => n !== null);

    const pops = win("POP").filter((n) => n >= 0 && n <= 100);
    const tmn = all("TMN");
    const tmx = all("TMX");
    const tmp = all("TMP");
    out[toISODate(date)] = {
      sky: modeSky(win("SKY")),
      precip: null,
      pop: pops.length ? Math.round(Math.max(...pops)) : null,
      tmin: tmn.length ? Math.min(...tmn) : tmp.length ? Math.min(...tmp) : null,
      tmax: tmx.length ? Math.max(...tmx) : tmp.length ? Math.max(...tmp) : null,
      source: "short",
    };
  }
  return out;
}
