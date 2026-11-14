// 기상청 OpenAPI 호출(서버 전용). 브라우저에서 import 금지 — 키는 여기서만 읽는다(원칙 4).
// 기본은 공공데이터포털 게이트웨이(apis.data.go.kr)에 serviceKey로 부른다(D-14). 호스트·경로는 아래 상수와 KmaOperation 유니언만 쓰고,
// 격자·지역코드는 regions.ts 상수만 받는다 → 사용자 입력이 URL에 들어가지 않는다.
// 게이트웨이는 KMA_GATEWAYS 두 항목뿐이고 환경변수 KMA_GATEWAY가 정확히 "apihub"일 때만 API허브로 간다(임의 주소를 받지 않는다 — T-02-08).
// 키·요청 URL은 오류 메시지·로그에 넣지 않는다(KmaError는 코드만 담는다).

import type { ShortItem } from "./types";

const TIMEOUT_MS = 5000;
const NUM_OF_ROWS = 1000;
/** 하루치가 1000행을 넘을 때 이어 받는 쪽 수의 상한(T-02-09) */
const MAX_PAGES = 5;

/**
 * 닫힌 두 게이트웨이. 기본은 포털(D-14).
 * apihub의 경로(/api/typ02/openApi/…)가 단기·중기 모두 같은 모양인지는 [ASSUMED](연구 Open Q2) — 02-06 프로브가 판정한다.
 */
export const KMA_GATEWAYS = {
  portal: { base: "https://apis.data.go.kr/1360000/", keyParam: "serviceKey" },
  apihub: { base: "https://apihub.kma.go.kr/api/typ02/openApi/", keyParam: "authKey" },
} as const;
export type KmaGatewayName = keyof typeof KMA_GATEWAYS;

/** 이름이 정확히 "apihub"일 때만 API허브, 그 밖(없음·오타·주소)은 모두 포털. 환경변수 값을 URL에 넣지 않는다 */
export function kmaGateway(name: string | undefined = process.env.KMA_GATEWAY): (typeof KMA_GATEWAYS)[KmaGatewayName] {
  return name === "apihub" ? KMA_GATEWAYS.apihub : KMA_GATEWAYS.portal;
}

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

/**
 * 포털 키는 Encoding(%2B·%3D) 또는 Decoding(+·=) 모양으로 발급된다. 어느 쪽을 넣어도 같은 값(Decoding)으로 맞춘다 —
 * URLSearchParams가 한 번만 인코딩하므로, 이미 인코딩된 키를 그대로 넣으면 %252B가 되어 30 오류(이중 인코딩)가 난다(연구 Pitfall 7).
 */
export function normalizeKey(raw: string): string {
  const trimmed = raw.trim();
  if (!/%[0-9A-Fa-f]{2}/.test(trimmed)) return trimmed;
  try {
    return decodeURIComponent(trimmed);
  } catch {
    return trimmed; // 잘못된 % 순서
  }
}

/** 글 안의 키를 모두 ***로 바꾼다(원래 키·정규화한 키·encodeURIComponent 형태·URLSearchParams 형태). 저장·출력 전에 쓴다 */
export function maskKey(text: string, key: string): string {
  if (key.trim() === "") return text;
  const normalized = normalizeKey(key);
  const forms = new Set<string>();
  for (const k of [key.trim(), normalized]) {
    if (k === "") continue;
    forms.add(k);
    forms.add(encodeURIComponent(k));
    forms.add(new URLSearchParams({ k }).toString().slice(2));
  }
  let out = text;
  for (const form of [...forms].sort((a, b) => b.length - a.length)) out = out.split(form).join("***");
  return out;
}

function readKey(): string {
  return normalizeKey(process.env.KMA_API_KEY ?? "");
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

/**
 * 기상청 호출 한 번. 키는 normalizeKey로 한 번 정리한 뒤 URLSearchParams가 한 번만 인코딩한다(손으로 이어 붙이지 않는다). 실패는 모두 KmaError(코드만).
 * opts로 게이트웨이·키를 덮어쓸 수 있다(02-05 프로브용). 안 주면 환경변수. gateway도 kmaGateway를 거쳐 닫힌 두 값 밖은 포털로 간다.
 */
export async function kmaGet(
  op: KmaOperation,
  params: Record<string, string>,
  opts?: { gateway?: KmaGatewayName; key?: string },
): Promise<{ status: number; json: unknown }> {
  const gateway = kmaGateway(opts?.gateway ?? process.env.KMA_GATEWAY);
  const key = opts?.key !== undefined ? normalizeKey(opts.key) : readKey();
  const url = new URL(gateway.base + op);
  url.searchParams.set(gateway.keyParam, key);
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

/**
 * 단기예보 한 격자·한 발표의 항목(문자열 필드 네 개가 다 있는 것만). 하루치가 1000행을 넘으면 쪽을 이어 받는다.
 * 멈춤: 모은 행 수가 totalCount 이상 / 2쪽부터 쪽이 비어 있음(03) / MAX_PAGES. 쪽 사이 오류는 그대로 던진다(부분 결과로 굳히지 않음).
 */
export async function fetchShort(nx: number, ny: number, base: { baseDate: string; baseTime: string }): Promise<ShortItem[]> {
  const out: ShortItem[] = [];
  let received = 0;
  for (let pageNo = 1; pageNo <= MAX_PAGES; pageNo++) {
    const { json } = await kmaGet("VilageFcstInfoService_2.0/getVilageFcst", {
      numOfRows: String(NUM_OF_ROWS),
      pageNo: String(pageNo),
      base_date: base.baseDate,
      base_time: base.baseTime,
      nx: String(nx),
      ny: String(ny),
    });
    let envelope: ReturnType<typeof readEnvelope>;
    try {
      envelope = readEnvelope(json);
    } catch (e) {
      if (pageNo > 1 && e instanceof KmaError && e.code === "03") break; // 이어 받다가 빈 쪽이면 거기까지
      throw e;
    }
    received += envelope.items.length;
    for (const it of envelope.items) {
      const { category, fcstDate, fcstTime, fcstValue } = it;
      if (typeof category === "string" && typeof fcstDate === "string" && typeof fcstTime === "string" && typeof fcstValue === "string") {
        out.push({ category, fcstDate, fcstTime, fcstValue });
      }
    }
    if (received >= envelope.totalCount) break;
  }
  return out;
}
