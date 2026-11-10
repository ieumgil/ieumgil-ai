// 한국관광공사 무장애 여행정보 API(KorWithService2) 호출. 데이터 정리 스크립트 전용(서비스에서는 호출하지 않음).
// 명세: 한국관광공사_개방데이터_활용매뉴얼(무장애여행) v4.3. 개발계정은 오퍼레이션마다 하루 1,000건.
// 인증키는 .env.local의 TOUR_API_KEY. 키는 로그·파일에 남기지 않는다.

const BASE = "https://apis.data.go.kr/B551011/KorWithService2";

let envNote = "";
function loadEnv() {
  if (envNote) return;
  try {
    process.loadEnvFile(".env.local");
    envNote = "loaded";
  } catch (err) {
    // .env.local이 없으면 이미 설정된 환경변수를 쓴다
    envNote = `.env.local을 읽지 못함(${(err as NodeJS.ErrnoException).code ?? (err as Error).message})`;
  }
}

function serviceKey(): string {
  loadEnv();
  const raw = process.env.TOUR_API_KEY?.trim().replace(/^["']|["']$/g, "");
  if (!raw) {
    const hint = envNote === "loaded" ? ".env.local은 읽었지만 TOUR_API_KEY 값이 비어 있어요(파일을 저장했는지 확인)" : envNote;
    throw new Error(`TOUR_API_KEY가 없어요. ${hint}`);
  }
  // 포털의 'Encoding' 키를 넣었으면 한 번 풀어서 이중 인코딩을 막는다
  return raw.includes("%") ? decodeURIComponent(raw) : raw;
}

let calls = 0;
export const callCount = () => calls;

export type TourItem = Record<string, string | number>;

/** 오퍼레이션 1회 호출 → items 배열. 오류면 키를 뺀 메시지로 던진다. */
export async function tour(op: string, params: Record<string, string | number> = {}): Promise<{ items: TourItem[]; totalCount: number }> {
  const url = new URL(`${BASE}/${op}`);
  url.search = new URLSearchParams({
    serviceKey: serviceKey(),
    MobileOS: "ETC",
    MobileApp: "ieumgil",
    _type: "json",
    numOfRows: "100",
    pageNo: "1",
    ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
  }).toString();

  calls++;
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    // 키 오류 등은 XML로 온다
    const reason = text.match(/<returnAuthMsg>([^<]+)/)?.[1] ?? text.match(/<resultMsg>([^<]+)/)?.[1] ?? text.slice(0, 200);
    throw new Error(`${op} 실패 (HTTP ${res.status}): ${reason}`);
  }
  const body = (json as { response?: { header?: { resultCode?: string; resultMsg?: string }; body?: unknown } }).response;
  if (!body || body.header?.resultCode !== "0000") {
    throw new Error(`${op} 실패: ${body?.header?.resultCode} ${body?.header?.resultMsg ?? JSON.stringify(json).slice(0, 200)}`);
  }
  const b = body.body as { items?: { item?: TourItem | TourItem[] } | ""; totalCount?: number };
  const item = b.items && typeof b.items === "object" ? b.items.item : undefined;
  return { items: item ? (Array.isArray(item) ? item : [item]) : [], totalCount: Number(b.totalCount ?? 0) };
}

/** 전체 페이지를 모아서 돌려준다 */
export async function tourAll(op: string, params: Record<string, string | number> = {}, pageSize = 200): Promise<TourItem[]> {
  const out: TourItem[] = [];
  for (let page = 1; ; page++) {
    const { items, totalCount } = await tour(op, { ...params, numOfRows: pageSize, pageNo: page });
    out.push(...items);
    if (out.length >= totalCount || items.length === 0) return out;
  }
}
