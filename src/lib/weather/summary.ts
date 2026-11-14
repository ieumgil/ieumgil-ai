// 단기예보 항목 → 날짜별 하루 값(순수 함수). 값을 지어내지 않는다: 없는 값은 null이고, 쓸 수 있는 값이 낮 창에 하나도 없는 날은 넣지 않는다.
//
// 규칙(근거: 기상청 단기예보 활용가이드 코드값 표 SKY·PTY·POP·TMP·TMN·TMX와 결측 처리, 하루 대표값은 연구 문서에서 정하고 테스트로 고정):
//  - 오늘 전 날짜는 버린다. 오늘의 지난 시각(fcstTime의 시 < 지금 시)은 모든 카테고리에서 뺀다.
//  - 값은 숫자로 바꾼 뒤 걸러낸다: 절댓값 900 이상은 결측(가이드 'Missing 값' -999 등), POP는 0~100, SKY는 1·3·4, PTY는 0~4만 쓴다. 그 밖은 무시한다.
//  - 낮 창 = 06~21시(여행 활동 시간, 포함). 강수확률 = 창 안 최댓값, 하늘 = 창 안 최빈값(동률이면 더 흐린 쪽 4 > 3 > 1).
//  - 강수 종류(PTY, 창 안): 2가 있거나 3과 1·4가 섞이면 '비/눈', 3만 있으면 '눈', 1·4(소나기)만 있으면 '비'.
//    PTY가 모두 0(또는 없음)이어도 강수확률이 60% 이상이면 안전 쪽으로 '비', 아니면 null.
//  - 최저·최고 기온 = 그날 TMN·TMX, 없으면 그날 TMP의 최솟값·최댓값(이때 approxTemp: true — 화면이 '약'을 붙여 '대략'임을 알린다).
//    오늘은 이미 지난 시각의 TMN·TMX가 빠지므로 '남은 시각만의' TMP 값이 되는데, 이것도 approxTemp로 표시해 확정 값처럼 보이지 않게 한다.
//  - 창 안에 쓸 수 있는 값이 하나도 없는 날은 결과에 넣지 않는다.

import type { DayForecast, ShortItem } from "./types";

const WINDOW_FROM = "0600";
const WINDOW_TO = "2100";
const RAIN_POP = 60; // 이 이상이면 PTY가 0이어도 '비'로 본다
const MISSING = 900; // |값| ≥ 900은 결측 표시

const toISODate = (yyyymmdd: string) => `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;

/** 카테고리별로 쓸 수 있는 숫자인지 가려 숫자를, 아니면 null을 돌려준다 */
function parseValue(category: string, raw: string): number | null {
  if (!/^-?\d+(\.\d+)?$/.test(raw.trim())) return null;
  const n = Number.parseFloat(raw);
  if (!Number.isFinite(n) || Math.abs(n) >= MISSING) return null;
  switch (category) {
    case "POP":
      return n >= 0 && n <= 100 ? n : null;
    case "SKY":
      return n === 1 || n === 3 || n === 4 ? n : null;
    case "PTY":
      return Number.isInteger(n) && n >= 0 && n <= 4 ? n : null;
    case "TMP":
    case "TMN":
    case "TMX":
      return n;
    default:
      return null;
  }
}

function modeSky(values: number[]): 1 | 3 | 4 | null {
  const count = new Map<number, number>();
  for (const v of values) count.set(v, (count.get(v) ?? 0) + 1);
  let best: 1 | 3 | 4 | null = null;
  for (const code of [1, 3, 4] as const) {
    // 같은 횟수면 나중 코드(더 흐린 쪽)가 이긴다
    if ((count.get(code) ?? 0) > 0 && (best === null || (count.get(code) ?? 0) >= (count.get(best) ?? 0))) best = code;
  }
  return best;
}

function precipKind(pty: number[], pop: number | null): DayForecast["precip"] {
  const has = (code: number) => pty.includes(code);
  const wet = has(1) || has(4);
  if (has(2) || (has(3) && wet)) return "비/눈";
  if (has(3)) return "눈";
  if (wet) return "비";
  return pop !== null && pop >= RAIN_POP ? "비" : null;
}

/** today: 서버가 본 한국 날짜 YYYY-MM-DD, nowHour: 한국 시각의 시(0~23) */
export function summarizeShort(items: ShortItem[], today: string, nowHour: number): Record<string, DayForecast> {
  type Row = { category: string; time: string; value: number };
  const byDate = new Map<string, Row[]>();
  for (const it of items) {
    if (!/^\d{8}$/.test(it.fcstDate) || !/^\d{4}$/.test(it.fcstTime)) continue;
    const date = toISODate(it.fcstDate);
    if (date < today) continue;
    if (date === today && Number(it.fcstTime.slice(0, 2)) < nowHour) continue;
    const value = parseValue(it.category, it.fcstValue);
    if (value === null) continue;
    const list = byDate.get(it.fcstDate) ?? [];
    list.push({ category: it.category, time: it.fcstTime, value });
    byDate.set(it.fcstDate, list);
  }

  const out: Record<string, DayForecast> = {};
  for (const [date, rows] of [...byDate].sort(([a], [b]) => a.localeCompare(b))) {
    const inWindow = rows.filter((r) => r.time >= WINDOW_FROM && r.time <= WINDOW_TO);
    if (inWindow.length === 0) continue;
    const win = (category: string) => inWindow.filter((r) => r.category === category).map((r) => r.value);
    const all = (category: string) => rows.filter((r) => r.category === category).map((r) => r.value);

    const pops = win("POP");
    const pop = pops.length ? Math.round(Math.max(...pops)) : null;
    const tmn = all("TMN");
    const tmx = all("TMX");
    const tmp = all("TMP");
    const tmin = tmn.length ? Math.min(...tmn) : tmp.length ? Math.min(...tmp) : null;
    const tmax = tmx.length ? Math.max(...tmx) : tmp.length ? Math.max(...tmp) : null;
    const approx = (tmn.length === 0 && tmin !== null) || (tmx.length === 0 && tmax !== null);
    out[toISODate(date)] = {
      sky: modeSky(win("SKY")),
      precip: precipKind(win("PTY"), pop),
      pop,
      tmin,
      tmax,
      source: "short",
      ...(approx ? { approxTemp: true as const } : {}),
    };
  }
  return out;
}
