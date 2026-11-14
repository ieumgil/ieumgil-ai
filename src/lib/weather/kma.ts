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

/** 오류 코드로 쓸 수 있는 모양(짧은 영숫자). 외부 응답의 긴 글·공백이 든 값은 그대로 옮기지 않는다 */
const SAFE_CODE = /^[A-Za-z0-9_]{1,12}$/;
const safeCode = (v: unknown): string => (typeof v === "string" || typeof v === "number" ? (SAFE_CODE.test(String(v)) ? String(v) : "ENVELOPE") : "ENVELOPE");

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * 기상청 응답 봉투 읽기. 모양이 세 가지다(HTTP 상태만 보면 안 된다):
 *  (a) 정상 response.header.resultCode "00" + body.items.item[]  (b) 포털 게이트웨이 오류 OpenAPI_ServiceResponse.cmmMsgHeader  (c) API허브 오류 result.status
 * 정상이면 항목을, 그 밖은 KmaError(코드)를 던진다. 데이터 없음(03·item 없음)은 코드 "03".
 */
export function readEnvelope(json: unknown): { items: Record<string, unknown>[]; totalCount: number } {
  if (!isRecord(json)) throw new KmaError("ENVELOPE");

  const portal = json.OpenAPI_ServiceResponse;
  if (isRecord(portal)) {
    const header = portal.cmmMsgHeader;
    throw new KmaError(isRecord(header) ? safeCode(header.returnReasonCode) : "ENVELOPE");
  }

  const result = json.result;
  if (isRecord(result) && typeof result.status === "number") throw new KmaError(safeCode(`HTTP${result.status}`));

  const response = json.response;
  const header = isRecord(response) ? response.header : undefined;
  if (!isRecord(header)) throw new KmaError("ENVELOPE");
  if (String(header.resultCode) !== "00") throw new KmaError(safeCode(header.resultCode));

  const body = isRecord(response) ? response.body : undefined;
  if (!isRecord(body)) throw new KmaError("ENVELOPE");
  const rawItems = isRecord(body.items) ? body.items.item : undefined;
  const list = Array.isArray(rawItems) ? rawItems : isRecord(rawItems) ? [rawItems] : [];
  const items = list.filter(isRecord);
  if (items.length === 0) throw new KmaError("03");
  return { items, totalCount: typeof body.totalCount === "number" ? body.totalCount : items.length };
}

/** 기상청 호출 한 번. URLSearchParams가 키를 한 번만 인코딩한다(손으로 이어 붙이지 않는다). 실패는 모두 KmaError(코드만) */
export async function kmaGet(op: KmaOperation, params: Record<string, string>): Promise<{ status: number; json: unknown }> {
  const url = new URL(GATEWAY_BASE + op);
  url.searchParams.set(KEY_PARAM, readKey());
  url.searchParams.set("dataType", "JSON");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    // 시간 초과·네트워크 오류: 원래 오류 글에 URL(키)이 들어 있을 수 있어 버린다
    throw new KmaError("NETWORK");
  }
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new KmaError(res.ok ? "PARSE" : `HTTP${res.status}`);
  }
  // 비정상 HTTP여도 JSON 오류 봉투면 그 코드를 살린다(예: 403 + 포털 30)
  if (!res.ok) {
    readEnvelope(json);
    throw new KmaError(`HTTP${res.status}`);
  }
  return { status: res.status, json };
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
