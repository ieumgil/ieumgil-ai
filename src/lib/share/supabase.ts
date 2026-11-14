// 공유 링크 저장소(서버 전용, 원칙 4). Supabase REST(PostgREST)를 fetch로 부른다 — 서버 키(secret 또는 예전 service_role)는 서버 환경변수에만.
// 테이블은 RLS로 외부(anon) 접근을 모두 막고(정책 없음) 서버만 읽고 쓴다: supabase/migrations/ 참고.
// 행: id · doc(공유할 안 JSON) · expires_at · created_at. 이름·연락처·IP 칸은 없다.

import type { ShareDoc } from "./doc";

function config(): { url: string; key: string } | null {
  const url = process.env.SUPABASE_URL?.replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url, key } : null;
}

export const shareReady = () => config() !== null;

// 새 Supabase 키(sb_secret_…)는 apikey 헤더에만, 예전 service_role 키(JWT, eyJ…)는 Authorization에도 넣는다
const headers = (key: string): Record<string, string> => ({
  apikey: key,
  ...(key.startsWith("eyJ") ? { Authorization: `Bearer ${key}` } : {}),
  "Content-Type": "application/json",
});

/** 저장. 성공하면 true */
export async function saveShare(id: string, doc: ShareDoc, expires: Date): Promise<boolean> {
  const c = config();
  if (!c) return false;
  const res = await fetch(`${c.url}/rest/v1/trips`, {
    method: "POST",
    headers: { ...headers(c.key), Prefer: "return=minimal" },
    body: JSON.stringify({ id, doc, expires_at: expires.toISOString() }),
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  }).catch(() => null);
  return !!res?.ok;
}

/** 깨워 두기: 행 1개의 id만 읽는다(쓰기 없음). 무료 프로젝트가 7일 동안 요청이 없으면 멈추는 것을 막는다 */
export async function pingShare(): Promise<boolean> {
  const c = config();
  if (!c) return false;
  const res = await fetch(`${c.url}/rest/v1/trips?select=id&limit=1`, {
    headers: headers(c.key),
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  }).catch(() => null);
  return !!res?.ok;
}

export type LoadResult ={ ok: true; doc: ShareDoc; expiresAt: string } | { ok: false; reason: "없음" | "만료" | "오류" };

/** 읽기. 기간이 지난 것은 지워지기 전이라도 '만료' */
export async function loadShare(id: string, now = new Date()): Promise<LoadResult> {
  const c = config();
  if (!c || !/^[0-9A-Za-z]{10}$/.test(id)) return { ok: false, reason: c ? "없음" : "오류" };
  const res = await fetch(`${c.url}/rest/v1/trips?id=eq.${id}&select=doc,expires_at`, {
    headers: headers(c.key),
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  }).catch(() => null);
  if (!res?.ok) return { ok: false, reason: "오류" };
  const rows = (await res.json().catch(() => [])) as { doc: ShareDoc; expires_at: string }[];
  const row = rows[0];
  if (!row) return { ok: false, reason: "없음" };
  if (Date.parse(row.expires_at) <= now.getTime()) return { ok: false, reason: "만료" };
  return { ok: true, doc: row.doc, expiresAt: row.expires_at };
}
