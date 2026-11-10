// 기본 정보(data/build/places-base.json) + ① 읽기 결과(data/ai/read/*.json) + 사람 확인 값 → data/places.json
// 사용: npx tsx scripts/ai/merge-places.ts
// 코드가 다시 강제하는 것(LLM이 무엇을 내도):
//  - 근거 id는 그 장소 문단에 실제로 있는 것만 남긴다. 근거가 하나도 없으면 값을 '모름' + 질문으로 바꾼다.
//  - '모름'에 질문이 없으면 기본 질문, 부분가능에 메모가 없으면 '모름' + 질문.
//  - 운영시간은 HH:MM·여는 시각 < 닫는 시각을 검사하고, 틀리면 버리고 질문으로 대체.
//  - 엘리베이터: 관광공사 분류가 자연관광·도시공원(야외 시설)이고 AI가 '모름'이면 '가능(층이 없는 야외 시설)'으로 둔다.
//    조건표의 엘리베이터는 '층이 있는 시설'에만 해당하기 때문(근거: class-1 분류 문단).
//  - 사람 확인 값(data/eval/human.json, 있으면)이 AI 값을 덮어쓴다(등급 human).
// 읽기 결과가 있는 장소만 places.json에 들어간다(점점 늘어남).

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { DEFAULT_ASK, DEFAULT_HOURS_ASK } from "../../src/lib/places/asks";
import { validatePlaces } from "../../src/lib/places/validate";
import { ACCESS_KEYS, type AccessItem, type AccessKey, type AccessStatus, type OpeningHours, type Place, type PlaceHours, type Weekday } from "../../src/lib/types";

interface Base extends Omit<Place, "access" | "hours"> {
  _verified_at: string;
  _evidence_ids: string[];
  _outdoor: boolean;
}
interface ReadItem {
  value: AccessStatus;
  note?: string;
  ask?: string;
  evidence: string[];
}
interface ReadResult {
  placeId: string;
  access: Record<AccessKey, ReadItem>;
  hours: {
    known: boolean;
    always_open?: boolean;
    summer?: OpeningHours;
    winter?: OpeningHours;
    closed_weekdays?: Weekday[];
    closed_dates?: string[];
    note?: string;
    ask?: string;
    evidence: string[];
  };
  on_site: { text: string; evidence: string[] };
}
/** data/eval/human.json (scripts/ai/human-import.ts가 양식에서 만든다) */
type HumanOverride = Record<
  string,
  {
    access?: Partial<Record<AccessKey, Omit<AccessItem, "grade">>>;
    parking_to_entrance?: { meters?: number; note?: string };
    route_length?: { meters?: number; note?: string };
  }
>;

const READ = "data/ai/read";
const base: Base[] = JSON.parse(readFileSync("data/build/places-base.json", "utf8"));
const human: HumanOverride = existsSync("data/eval/human.json") ? JSON.parse(readFileSync("data/eval/human.json", "utf8")) : {};

const nonBlank = (s?: string) => (s && s.trim() ? s.trim() : undefined);
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
function okTime(h?: OpeningHours): OpeningHours | undefined {
  if (!h || !HHMM.test(h.open) || !HHMM.test(h.close) || mins(h.open) >= mins(h.close)) return undefined;
  const last = h.last_entry && HHMM.test(h.last_entry) && mins(h.last_entry) >= mins(h.open) && mins(h.last_entry) <= mins(h.close) ? h.last_entry : undefined;
  return { open: h.open, close: h.close, ...(last ? { last_entry: last } : {}) };
}

const stats = { places: 0, unknown: 0, total: 0, demoted: 0, hoursUnknown: 0, human: 0, outdoorElevator: 0 };
const out: Place[] = [];

for (const b of base) {
  const file = `${READ}/${b.id}.json`;
  if (!existsSync(file)) continue;
  const { result } = JSON.parse(readFileSync(file, "utf8")) as { result: ReadResult };
  const allowed = new Set(b._evidence_ids);
  const keep = (ids: string[] = []) => ids.filter((id) => allowed.has(id));
  const meta = { grade: "ai" as const, method: "관광공사 API" as const, verified_at: b._verified_at };

  const access = {} as Record<AccessKey, AccessItem>;
  for (const key of ACCESS_KEYS) {
    const r = result.access?.[key];
    const evidence = keep(r?.evidence);
    let item: AccessItem;
    if (!r || r.value === "모름") {
      item = { value: "모름", ask: nonBlank(r?.ask) ?? DEFAULT_ASK[key], ...meta };
    } else if (evidence.length === 0 || (r.value === "부분가능" && !nonBlank(r.note))) {
      stats.demoted++;
      item = { value: "모름", ask: nonBlank(r.ask) ?? DEFAULT_ASK[key], ...meta };
    } else {
      item = { value: r.value, ...(nonBlank(r.note) ? { note: nonBlank(r.note) } : {}), evidence, ...meta };
    }
    if (key === "elevator" && item.value === "모름" && b._outdoor && allowed.has("class-1")) {
      item = { value: "가능", note: "층이 없는 야외 시설(관광공사 분류 기준)", evidence: ["class-1"], ...meta };
      stats.outdoorElevator++;
    }
    const h = human[b.id]?.access?.[key];
    if (h) {
      item = { ...h, grade: "human" } as AccessItem;
      stats.human++;
    }
    if (item.value === "모름") stats.unknown++;
    stats.total++;
    access[key] = item;
  }

  const rh = result.hours ?? { known: false, evidence: [] };
  const summer = okTime(rh.summer);
  const winter = okTime(rh.winter) ?? summer;
  const hoursEvidence = keep(rh.evidence);
  const hours: PlaceHours = { grade: "ai" };
  if (rh.always_open && hoursEvidence.length) hours.always_open = true;
  else if (rh.known && summer && hoursEvidence.length) Object.assign(hours, { summer, winter });
  else {
    hours.ask = nonBlank(rh.ask) ?? DEFAULT_HOURS_ASK;
    stats.hoursUnknown++;
  }
  if (rh.closed_weekdays?.length) hours.closed_weekdays = [...new Set(rh.closed_weekdays)];
  if (rh.closed_dates?.length) hours.closed_dates = rh.closed_dates.map((d) => d.trim()).filter(Boolean);
  if (nonBlank(rh.note)) hours.note = nonBlank(rh.note);
  if (hoursEvidence.length) hours.evidence = hoursEvidence;

  const onSiteEvidence = keep(result.on_site?.evidence);
  const onSiteText = nonBlank(result.on_site?.text);

  const { _verified_at: _v, _evidence_ids: _e, _outdoor: _o, ...rest } = b;
  void _v;
  void _e;
  void _o;
  const hp = human[b.id];
  out.push({
    ...rest,
    ...(hp?.parking_to_entrance ? { parking_to_entrance: hp.parking_to_entrance } : {}),
    ...(hp?.route_length ? { route_length: hp.route_length } : {}),
    hours,
    access,
    ...(onSiteText && onSiteEvidence.length >= 2 ? { on_site: { text: onSiteText, evidence: onSiteEvidence, grade: "ai" as const } } : {}),
    ...(rest.photos && rest.photos.length === 0 ? { photos: undefined } : {}),
  } as Place);
  stats.places++;
}

const cleaned = JSON.parse(JSON.stringify(out)) as Place[]; // undefined 필드 제거
const result = validatePlaces(cleaned);
writeFileSync("data/places.json", JSON.stringify(cleaned, null, 2) + "\n");
const pct = (n: number, d: number) => `${d ? Math.round((n / d) * 100) : 0}%`;
console.log(
  `${result.ok ? "✓" : "✕"} data/places.json ${stats.places}곳 · '모름' ${stats.unknown}/${stats.total}(${pct(stats.unknown, stats.total)}) · 근거 없어 모름으로 바꾼 값 ${stats.demoted} · 운영시간 모름 ${stats.hoursUnknown} · 사람 확인 값 ${stats.human} · 야외 시설 엘리베이터 ${stats.outdoorElevator}`,
);
if (!result.ok) {
  result.issues.slice(0, 20).forEach((i) => console.log(`  - ${i.placeId} ${i.path}: ${i.message}`));
  process.exit(1);
}
