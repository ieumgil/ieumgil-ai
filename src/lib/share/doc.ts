// 공유 링크에 저장하는 값(원칙 3·5, 11/14). 고른 안의 장소·순서·체류·이유·주의·확인 질문, 날짜·유형·이동수단·하루 틀만 담는다.
// 카카오 이동시간·시각·경로선은 넣지 않고(캐싱 금지) 열 때 다시 계산한다. 이름·연락처·IP 같은 개인정보 칸은 없다.
// 서버는 JSON 스키마(정해진 칸만) · 알려진 장소 · 크기를 검사한 뒤에만 저장한다. 여행 끝 + 7일(만든 날부터 최대 30일)에 사라진다.

import Ajv2020 from "ajv/dist/2020";
import type { Verdict } from "../ai/guards";
import type { DayFrame, PlanDraft } from "../engine/types";
import type { OptionView, TripView } from "../trip/view";

export interface ShareDoc {
  v: 1;
  input: TripView["input"];
  frames: DayFrame[];
  option: {
    id: string;
    strategy?: string;
    title: string;
    summary: string;
    draft: PlanDraft;
    cautions: { placeId: string; text: string }[];
    checkBeforeGo: { placeId: string; question: string }[];
    swapped?: Record<string, string>;
  };
  /** 일정에 든 장소의 판단(칩·이유 표시용) */
  judgments: Record<string, { verdict: Verdict; reasons: string[] }>;
}

export const SHARE_MAX_BYTES = 40_000;
export const SHARE_DAYS_AFTER_TRIP = 7;
export const SHARE_MAX_DAYS = 30;

/** 확정한 안(바꾸기·순서 고치기 반영)을 공유할 값으로 */
export function toShareDoc(trip: TripView, o: OptionView): ShareDoc {
  const ids = o.draft.days.flatMap((d) => d.stops.map((s) => s.placeId));
  const inPlan = new Set(ids);
  return {
    v: 1,
    input: trip.input,
    frames: trip.frames,
    option: {
      id: o.id,
      ...(o.strategy ? { strategy: o.strategy } : {}),
      title: o.title,
      summary: o.summary,
      draft: o.draft,
      cautions: o.cautions.filter((c) => inPlan.has(c.placeId)),
      checkBeforeGo: o.checkBeforeGo.filter((q) => inPlan.has(q.placeId)),
      ...(o.swapped && Object.keys(o.swapped).length ? { swapped: o.swapped } : {}),
    },
    judgments: Object.fromEntries(ids.map((id) => [id, { verdict: trip.judgments[id].verdict, reasons: trip.judgments[id].reasons.slice(0, 3) }])),
  };
}

const str = (max: number) => ({ type: "string", maxLength: max });
const date = { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" };
const pid = { type: "string", pattern: "^[A-Z]{2}\\d{2,3}$" };
const minute = { type: "integer", minimum: 0, maximum: 1440 };
const point = {
  type: "object",
  additionalProperties: false,
  required: ["id", "name", "lat", "lng"],
  properties: { id: str(40), name: str(60), lat: { type: "number", minimum: 37.2, maximum: 38.6 }, lng: { type: "number", minimum: 128.2, maximum: 129.4 } },
};
const strList = (max: number, n: number) => ({ type: "array", maxItems: n, items: str(max) });

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["v", "input", "frames", "option", "judgments"],
  properties: {
    v: { const: 1 },
    input: {
      type: "object",
      additionalProperties: false,
      required: ["startDate", "endDate", "travelers", "transport", "categories", "pace"],
      properties: {
        startDate: date,
        endDate: date,
        travelers: strList(20, 3),
        transport: str(20),
        disabledPermit: { type: "boolean" },
        categories: strList(20, 6),
        pace: str(20),
        lodging: str(20),
        lodging2: str(20),
        mustVisit: { type: "array", maxItems: 10, items: pid },
      },
    },
    frames: {
      type: "array",
      minItems: 1,
      maxItems: 3,
      items: { type: "object", additionalProperties: false, required: ["date", "startMin", "endMin", "start", "end"], properties: { date, startMin: minute, endMin: minute, start: point, end: point } },
    },
    option: {
      type: "object",
      additionalProperties: false,
      required: ["id", "title", "summary", "draft", "cautions", "checkBeforeGo"],
      properties: {
        id: str(4),
        strategy: str(20),
        title: str(80),
        summary: str(300),
        draft: {
          type: "object",
          additionalProperties: false,
          required: ["days"],
          properties: {
            days: {
              type: "array",
              minItems: 1,
              maxItems: 3,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["date", "stops"],
                properties: {
                  date,
                  stops: {
                    type: "array",
                    minItems: 1,
                    maxItems: 6,
                    items: { type: "object", additionalProperties: false, required: ["placeId", "stayMin"], properties: { placeId: pid, stayMin: minute, restAfter: { type: "boolean" }, why: str(300) } },
                  },
                },
              },
            },
          },
        },
        cautions: { type: "array", maxItems: 30, items: { type: "object", additionalProperties: false, required: ["placeId", "text"], properties: { placeId: pid, text: str(300) } } },
        checkBeforeGo: { type: "array", maxItems: 60, items: { type: "object", additionalProperties: false, required: ["placeId", "question"], properties: { placeId: pid, question: str(200) } } },
        swapped: { type: "object", maxProperties: 18, additionalProperties: pid },
      },
    },
    judgments: {
      type: "object",
      maxProperties: 18,
      additionalProperties: {
        type: "object",
        additionalProperties: false,
        required: ["verdict", "reasons"],
        properties: { verdict: { enum: ["적합", "주의", "확인 필요", "부적합"] }, reasons: strList(300, 3) },
      },
    },
  },
};

const validate = new Ajv2020({ allErrors: false, strict: false }).compile<ShareDoc>(SCHEMA);

/** 저장해도 되는 값인지(문제가 있으면 이유, 없으면 null). knownIds = 관광지 데이터의 id */
export function checkShareDoc(doc: unknown, knownIds: ReadonlySet<string>): string | null {
  if (JSON.stringify(doc ?? null).length > SHARE_MAX_BYTES) return "공유할 일정이 너무 커요";
  if (!validate(doc)) return "공유할 일정 형식이 맞지 않아요";
  const ids = doc.option.draft.days.flatMap((d) => d.stops.map((s) => s.placeId));
  const all = [...ids, ...doc.option.cautions.map((c) => c.placeId), ...doc.option.checkBeforeGo.map((q) => q.placeId), ...Object.keys(doc.judgments), ...Object.values(doc.option.swapped ?? {})];
  if (all.some((id) => !knownIds.has(id))) return "모르는 장소가 있어요";
  if (new Set(ids).size !== ids.length) return "같은 장소가 두 번 있어요";
  if (ids.some((id) => !doc.judgments[id])) return "장소 판단이 빠졌어요";
  if (doc.frames.length !== doc.option.draft.days.length) return "날짜 수가 맞지 않아요";
  return null;
}

/** 사라지는 시각: 여행 마지막 날 + 7일이 끝나는 때(한국 시각 자정), 만든 때부터 30일을 넘지 않게 */
export function expiresAt(endDate: string, now = new Date()): Date {
  const afterTrip = new Date(`${endDate}T00:00:00+09:00`);
  afterTrip.setUTCDate(afterTrip.getUTCDate() + SHARE_DAYS_AFTER_TRIP + 1);
  const cap = new Date(now.getTime() + SHARE_MAX_DAYS * 86_400_000);
  return afterTrip < cap ? afterTrip : cap;
}

const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/** 추측하기 어려운 공유 주소 id(62^10) */
export function newShareId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join("");
}
