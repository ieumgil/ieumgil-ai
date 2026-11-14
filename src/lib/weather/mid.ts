// 중기예보(육상·기온) 응답 → 날짜별 하루 값(순수 함수, next/* import 금지). 값을 지어내지 않는다: 없는 값은 null이다.
//
// 규칙(근거: 기상청 중기예보 활용가이드(251212) 응답 명세와 하늘상태 절, 연구 문서 §3):
//  - 필드 이름의 N일은 오늘이 아니라 발표(tmFc) 날짜 + N일이다(Pitfall 4). 육상·기온이 서로 다른 발표로 받아졌을 수 있어 각자의 tmFc로 더한다.
//  - 4~7일은 오전/오후(rnStNAm·rnStNPm·wfNAm·wfNPm), 8~10일은 하루 한 값(rnStN·wfN)(Pitfall 5). 필드가 실제로 있을 때만 그 날짜를 만든다
//    (18시 발표는 4일 필드가 없다 — 옛 wf3Am 같은 필드는 읽지 않는다).
//  - 강수확률 = 오전·오후 중 큰 값, 하늘·강수 문장 = 강수확률이 큰 쪽(동률이면 오후).
//  - 날씨 문장은 가이드의 닫힌 값 표로만 해석한다. 표에 없으면 하늘 null — 문장을 그대로 화면·응답에 옮기지 않는다(D-06, T-02-11).
//  - 숫자는 단기(summary.ts)와 같은 규칙: 숫자·숫자 문자열만, 절댓값 900 이상은 결측, 강수확률은 0~100.
//  - 기온은 taMinN·taMaxN만 읽고 Low/High 범위 필드는 쓰지 않는다. 하늘·강수확률도 기온도 없는 날은 넣지 않는다.

import type { DayForecast } from "./types";

type Sky = 1 | 3 | 4;
type Precip = "비" | "눈" | "비/눈";

/** 한 번의 중기 응답(첫 item)과 그것을 받은 발표 시각 tmFc(YYYYMMDDHHMM) */
export interface MidInput {
  item: Record<string, unknown>;
  tmFc: string;
}

const RAIN_POP = 60; // 이 이상이면 문장에 비가 없어도 '비'로 본다(단기와 같은 안전 쪽 규칙)
const MISSING = 900; // |값| ≥ 900은 결측 표시
const DAY_MS = 86_400_000;

const SKY_BY_WORD: Record<string, Sky> = { 맑음: 1, 구름많: 3, 구름많음: 3, 흐림: 4, 흐리: 4 };
const PRECIP_BY_WORD: Record<string, Precip> = { 비: "비", 눈: "눈", "비/눈": "비/눈", 소나기: "비" };

/** 날씨 문장 → 하늘·강수 종류. 가이드 표(맑음 / 구름많음 / 흐림 / (구름많|흐리)고 비·눈·비/눈·소나기)에 없으면 null */
export function parseMidWf(text: unknown): { sky: Sky; precip: Precip | null } | null {
  if (typeof text !== "string") return null;
  const s = text.replace(/\s+/g, "");
  if (s === "맑음" || s === "구름많음" || s === "흐림") return { sky: SKY_BY_WORD[s], precip: null };
  const m = /^(구름많|흐리)고(비\/눈|비|눈|소나기)$/.exec(s);
  return m ? { sky: SKY_BY_WORD[m[1]], precip: PRECIP_BY_WORD[m[2]] } : null;
}

/** 숫자·숫자 문자열만 받고 결측(|값| ≥ 900)은 버린다 */
function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v.trim()) ? Number.parseFloat(v) : Number.NaN;
  return Number.isFinite(n) && Math.abs(n) < MISSING ? n : null;
}

const popOf = (v: unknown): number | null => {
  const n = num(v);
  return n !== null && n >= 0 && n <= 100 ? Math.round(n) : null;
};

/** tmFc(YYYYMMDDHHMM)의 날짜 + n일 → YYYY-MM-DD. 형식이 틀리면 null */
function dateAfter(tmFc: string, n: number): string | null {
  const m = /^(\d{4})(\d{2})(\d{2})\d{4}$/.exec(tmFc);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) + n * DAY_MS);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/** 육상예보에서 읽는 필드 표(날짜 하나 = 날짜 offset + 강수확률/날씨 필드 이름 쌍). 4~7일은 오전·오후, 8~10일은 하루 한 값 */
const LAND_FIELDS: { n: number; slots: { rn: string; wf: string; pm: boolean }[] }[] = [
  ...[4, 5, 6, 7].map((n) => ({
    n,
    slots: [
      { rn: `rnSt${n}Am`, wf: `wf${n}Am`, pm: false },
      { rn: `rnSt${n}Pm`, wf: `wf${n}Pm`, pm: true },
    ],
  })),
  ...[8, 9, 10].map((n) => ({ n, slots: [{ rn: `rnSt${n}`, wf: `wf${n}`, pm: true }] })),
];

const TA_FIELDS = [4, 5, 6, 7, 8, 9, 10].map((n) => ({ n, min: `taMin${n}`, max: `taMax${n}` }));

type LandDay = Pick<DayForecast, "sky" | "precip" | "pop">;

function readLand(land: MidInput): Record<string, LandDay> {
  const out: Record<string, LandDay> = {};
  for (const { n, slots } of LAND_FIELDS) {
    const date = dateAfter(land.tmFc, n);
    if (!date) continue;
    // 오전·오후 중 강수확률이 있는 쪽만 후보로, 큰 쪽(동률이면 오후)을 고른다
    let best: { pop: number; wf: unknown } | null = null;
    for (const slot of slots) {
      const pop = popOf(land.item[slot.rn]);
      if (pop === null) continue;
      if (best === null || pop > best.pop || (pop === best.pop && slot.pm)) best = { pop, wf: land.item[slot.wf] };
    }
    // 강수확률이 하나도 없으면 날씨 문장(있는 쪽, 오후 우선)만으로 하루를 만든다
    const wf = best ? best.wf : [...slots].reverse().map((s) => land.item[s.wf]).find((v) => parseMidWf(v) !== null);
    const parsed = parseMidWf(wf);
    const pop = best ? best.pop : null;
    if (pop === null && parsed === null) continue; // 쓸 수 있는 값이 없는 날은 만들지 않는다
    out[date] = {
      sky: parsed ? parsed.sky : null,
      precip: parsed?.precip ?? (pop !== null && pop >= RAIN_POP ? "비" : null),
      pop,
    };
  }
  return out;
}

function readTa(ta: MidInput): Record<string, { tmin: number | null; tmax: number | null }> {
  const out: Record<string, { tmin: number | null; tmax: number | null }> = {};
  for (const { n, min, max } of TA_FIELDS) {
    const date = dateAfter(ta.tmFc, n);
    if (!date) continue;
    const tmin = num(ta.item[min]);
    const tmax = num(ta.item[max]);
    if (tmin !== null || tmax !== null) out[date] = { tmin, tmax };
  }
  return out;
}

/** 육상·기온 응답 → 날짜별 하루 값(source "mid"). 육상이 없으면 빈 결과, 기온이 없으면 tmin/tmax만 null */
export function summarizeMid(land: MidInput | null, ta: MidInput | null): Record<string, DayForecast> {
  if (!land) return {};
  const days = readLand(land);
  const temps = ta ? readTa(ta) : {};
  const out: Record<string, DayForecast> = {};
  for (const date of Object.keys(days).sort()) {
    out[date] = { ...days[date], tmin: temps[date]?.tmin ?? null, tmax: temps[date]?.tmax ?? null, source: "mid" };
  }
  return out;
}

/** 단기와 중기를 합친다. 같은 날이면 단기 값을 쓴다(D-01). 날짜 순서로 돌려준다 */
export function mergeDays(short: Record<string, DayForecast>, mid: Record<string, DayForecast>): Record<string, DayForecast> {
  const merged = { ...mid, ...short };
  const out: Record<string, DayForecast> = {};
  for (const date of Object.keys(merged).sort()) out[date] = merged[date];
  return out;
}
