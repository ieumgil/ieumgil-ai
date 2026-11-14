-- 공유 링크(확정 일정 읽기 전용) 저장 테이블. Supabase 대시보드 SQL Editor에 그대로 붙여 넣어 한 번 실행한다.
-- 저장: 고른 안의 장소·순서·체류·이유·주의·확인 질문과 날짜·유형·하루 틀(doc). 카카오 이동시간·경로, 이름·연락처·IP는 저장하지 않는다.
-- 접근: RLS를 켜고 정책을 만들지 않는다 → 브라우저용 anon 키로는 읽기·쓰기 모두 불가. 서버(서비스 키)만 읽고 쓴다.

create table if not exists public.trips (
  id          text primary key check (id ~ '^[0-9A-Za-z]{10}$'),
  doc         jsonb not null check (octet_length(doc::text) <= 60000),
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);

alter table public.trips enable row level security;

-- 브라우저 키(anon·authenticated)에는 권한 자체를 주지 않는다(정책이 없어 막히지만 한 번 더)
revoke all on table public.trips from anon, authenticated;

create index if not exists trips_expires_at_idx on public.trips (expires_at);

-- 기간이 지난 공유 링크를 매일 새벽 3시(한국 시각, UTC 18시)에 지운다.
-- pg_cron 확장이 필요하다: 대시보드 Database → Extensions에서 pg_cron을 켠 뒤 아래를 실행한다.
create extension if not exists pg_cron;
select cron.schedule(
  'ieumgil-delete-expired-trips',
  '0 18 * * *',
  $$delete from public.trips where expires_at < now()$$
);
