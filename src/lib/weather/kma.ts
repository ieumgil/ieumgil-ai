// 기상청 OpenAPI 호출(서버 전용). 브라우저에서 import 금지 — 키는 여기서만 읽는다(원칙 4).
// 공공데이터포털 게이트웨이(apis.data.go.kr)에 serviceKey로 부른다(D-14). 호스트·경로는 아래 상수와 KmaOperation 유니언만 쓰고,
// 격자·지역코드는 regions.ts 상수만 받는다 → 사용자 입력이 URL에 들어가지 않는다.
// 키·요청 URL은 오류 메시지·로그에 넣지 않는다(KmaError는 코드만 담는다).

import type { ShortItem } from "./types";

const GATEWAY_BASE = "https://apis.data.go.kr/1360000/";
const KEY_PARAM = "serviceKey";
const TIMEOUT_MS = 5000;

export type KmaOperation =
  | "VilageFcstInfoService_2.0/getVilageFcst"
  | "MidFcstInfoService/getMidLandFcst"
  | "MidFcstInfoService/getMidTa";

/** 기상청 응답 오류. 메시지에는 코드만 — URL·키·쿼리를 넣지 않는다 */
export class KmaError extends Error {
  code: string;
  constructor(code: string) {
    super(`기상청 응답 오류(${code})`);
    this.name = "KmaError";
    this.code = code;
  }
}

function readKey(): string {
  return (process.env.KMA_API_KEY ?? "").trim();
}

export function hasKmaKey(): boolean {
  return readKey() !== "";
}

/** 기상청 호출 한 번. URLSearchParams가 키를 한 번만 인코딩한다(손으로 이어 붙이지 않는다) */
export async function kmaGet(op: KmaOperation, params: Record<string, string>): Promise<{ status: number; json: unknown }> {
  const url = new URL(GATEWAY_BASE + op);
  url.searchParams.set(KEY_PARAM, readKey());
  url.searchParams.set("dataType", "JSON");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new KmaError("PARSE");
  }
  return { status: res.status, json };
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** 정상 봉투(response.header.resultCode "00" + body.items.item)에서 항목을 꺼낸다. 그 밖은 KmaError */
export function readEnvelope(json: unknown): { items: Record<string, unknown>[]; totalCount: number } {
  const response = isRecord(json) ? json.response : undefined;
  const header = isRecord(response) ? response.header : undefined;
  const body = isRecord(response) ? response.body : undefined;
  if (!isRecord(header) || header.resultCode !== "00" || !isRecord(body)) throw new KmaError("ENVELOPE");
  const rawItems = isRecord(body.items) ? body.items.item : undefined;
  const list = Array.isArray(rawItems) ? rawItems : isRecord(rawItems) ? [rawItems] : null;
  if (!list) throw new KmaError("ENVELOPE");
  const items = list.filter(isRecord);
  const total = typeof body.totalCount === "number" ? body.totalCount : items.length;
  return { items, totalCount: total };
}

/** 단기예보 한 격자·한 발표의 항목(문자열 필드 네 개가 다 있는 것만) */
export async function fetchShort(nx: number, ny: number, base: { baseDate: string; baseTime: string }): Promise<ShortItem[]> {
  const { json } = await kmaGet("VilageFcstInfoService_2.0/getVilageFcst", {
    numOfRows: "1000",
    pageNo: "1",
    base_date: base.baseDate,
    base_time: base.baseTime,
    nx: String(nx),
    ny: String(ny),
  });
  const { items } = readEnvelope(json);
  const out: ShortItem[] = [];
  for (const it of items) {
    const { category, fcstDate, fcstTime, fcstValue } = it;
    if (typeof category === "string" && typeof fcstDate === "string" && typeof fcstTime === "string" && typeof fcstValue === "string") {
      out.push({ category, fcstDate, fcstTime, fcstValue });
    }
  }
  return out;
}
