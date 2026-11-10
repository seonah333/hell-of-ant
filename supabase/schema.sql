-- =====================================================================
--  HELL OF ANT 행사 캘린더 · Supabase 스키마
--  Supabase 대시보드 > SQL Editor 에 이 파일 전체를 붙여넣고 Run 하세요.
--  여러 번 실행해도 안전하도록 작성했어요.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. 운영진 목록
-- ---------------------------------------------------------------------
create table if not exists public.admins (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 30),
  created_at   timestamptz not null default now()
);
alter table public.admins enable row level security;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
grant execute on function public.is_admin() to anon, authenticated;

drop policy if exists "admins read own row" on public.admins;
create policy "admins read own row" on public.admins
  for select to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- 2. 일정 (공개 정보만. 제보자 연락처는 3번 테이블에 따로 보관)
-- ---------------------------------------------------------------------
create table if not exists public.events (
  id             uuid primary key default gen_random_uuid(),
  status         text not null default 'pending' check (status in ('pending','approved','rejected')),
  title          text not null check (char_length(title) between 1 and 90),
  start_date     date not null,
  end_date       date check (end_date is null or end_date >= start_date),
  start_time     text check (start_time is null or start_time ~ '^[0-2][0-9]:[0-5][0-9]$'),
  venue          text check (venue is null or char_length(venue) <= 60),
  genres         text[] not null default '{}',
  url            text check (url is null or (url ~* '^https?://' and char_length(url) <= 300)),
  memo           text check (memo is null or char_length(memo) <= 600),
  flyer_path     text check (flyer_path is null or char_length(flyer_path) <= 200),
  credit         text check (credit is null or char_length(credit) <= 40),  -- 표시 동의한 제보자 인스타 아이디
  posted_by_name text check (posted_by_name is null or char_length(posted_by_name) <= 30),
  created_at     timestamptz not null default now(),
  reviewed_at    timestamptz,
  reviewed_by    uuid references auth.users(id) on delete set null
);
create index if not exists events_status_start_idx on public.events (status, start_date);
alter table public.events enable row level security;

drop policy if exists "read approved or admin" on public.events;
create policy "read approved or admin" on public.events
  for select to anon, authenticated using (status = 'approved' or public.is_admin());

drop policy if exists "admin insert" on public.events;
create policy "admin insert" on public.events
  for insert to authenticated with check (public.is_admin());

drop policy if exists "admin update" on public.events;
create policy "admin update" on public.events
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin delete" on public.events;
create policy "admin delete" on public.events
  for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------
-- 3. 제보자 정보 (운영진만 볼 수 있음)
-- ---------------------------------------------------------------------
create table if not exists public.event_contacts (
  event_id   uuid primary key references public.events(id) on delete cascade,
  instagram  text not null check (char_length(instagram) between 1 and 40),
  note       text check (note is null or char_length(note) <= 300),
  created_at timestamptz not null default now()
);
alter table public.event_contacts enable row level security;

drop policy if exists "admin read contacts" on public.event_contacts;
create policy "admin read contacts" on public.event_contacts
  for select to authenticated using (public.is_admin());

drop policy if exists "admin delete contacts" on public.event_contacts;
create policy "admin delete contacts" on public.event_contacts
  for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------
-- 4. 제보 속도 제한용 기록 (아무도 직접 읽을 수 없음)
-- ---------------------------------------------------------------------
create table if not exists public.submission_log (
  id         bigserial primary key,
  ip_hash    text not null,
  created_at timestamptz not null default now()
);
create index if not exists submission_log_ip_idx on public.submission_log (ip_hash, created_at);
alter table public.submission_log enable row level security;

-- ---------------------------------------------------------------------
-- 5. 제보 함수 — 로그인 없는 방문자는 이 함수로만 일정을 보낼 수 있어요
-- ---------------------------------------------------------------------
create or replace function public.submit_event(
  p_title text, p_start date, p_end date, p_time text, p_venue text,
  p_genres text[], p_url text, p_memo text, p_flyer text,
  p_instagram text, p_note text, p_credit boolean
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_ip      text;
  v_hash    text;
  v_recent  int;
  v_pending int;
  v_id      uuid;
  v_insta   text := lower(regexp_replace(coalesce(p_instagram, ''), '^@+', ''));
  allowed   text[] := array['TECHNO','HOUSE','TECH HOUSE','TRANCE','HARD DANCE','DNB','DUBSTEP','BASS','EDM','POP','ROCK','LIVE','ETC'];
begin
  -- 입력 검증
  if v_insta !~ '^[a-z0-9._]{1,30}$' then raise exception 'invalid_instagram'; end if;
  if p_genres is not null and not (p_genres <@ allowed) then raise exception 'invalid_genre'; end if;
  if p_flyer is not null and p_flyer !~ '^submissions/[A-Za-z0-9._-]+$' then raise exception 'invalid_flyer'; end if;
  if p_start < current_date - 1 then raise exception 'past_date'; end if;

  -- 같은 접속지에서 1시간에 5건까지
  begin
    v_ip := split_part(coalesce((current_setting('request.headers', true))::json->>'x-forwarded-for', 'unknown'), ',', 1);
  exception when others then v_ip := 'unknown';
  end;
  v_hash := md5(v_ip || ':hoa');
  select count(*) into v_recent from submission_log where ip_hash = v_hash and created_at > now() - interval '1 hour';
  if v_recent >= 5 then raise exception 'too_many_submissions'; end if;

  -- 승인 대기가 너무 쌓이면 잠시 받지 않기
  select count(*) into v_pending from events where status = 'pending';
  if v_pending >= 300 then raise exception 'queue_full'; end if;

  insert into events (status, title, start_date, end_date, start_time, venue, genres, url, memo, flyer_path, credit)
  values ('pending', trim(p_title), p_start, nullif(p_end, p_start),
          nullif(p_time, ''), nullif(trim(coalesce(p_venue, '')), ''), coalesce(p_genres, '{}'),
          nullif(trim(coalesce(p_url, '')), ''), nullif(trim(coalesce(p_memo, '')), ''), p_flyer,
          case when p_credit then v_insta end)
  returning id into v_id;

  insert into event_contacts (event_id, instagram, note) values (v_id, v_insta, nullif(trim(coalesce(p_note, '')), ''));
  insert into submission_log (ip_hash) values (v_hash);
  delete from submission_log where created_at < now() - interval '2 days';
  return v_id;
end $$;
revoke all on function public.submit_event(text,date,date,text,text,text[],text,text,text,text,text,boolean) from public;
grant execute on function public.submit_event(text,date,date,text,text,text[],text,text,text,text,text,boolean) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 6. 접근 권한 (Data API 의 'Automatically expose new tables' 를 꺼도 동작하도록 명시)
--    실제로 무엇을 볼 수 있는지는 위의 RLS 정책이 한 번 더 걸러요.
-- ---------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select on public.events to anon, authenticated;
grant insert, update, delete on public.events to authenticated;
grant select, delete on public.event_contacts to authenticated;
grant select on public.admins to authenticated;
revoke all on public.submission_log from anon, authenticated;
revoke insert, update, delete on public.events from anon;
revoke insert, update on public.event_contacts from anon, authenticated;
revoke insert, update, delete on public.admins from anon, authenticated;

-- ---------------------------------------------------------------------
-- 7. 플라이어 이미지 저장소 (공개 읽기, 5MB 이하 이미지만)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('flyers', 'flyers', true, 5242880, array['image/png','image/jpeg','image/webp','image/gif'])
on conflict (id) do update set public = true, file_size_limit = 5242880,
  allowed_mime_types = array['image/png','image/jpeg','image/webp','image/gif'];

drop policy if exists "flyers public read" on storage.objects;
create policy "flyers public read" on storage.objects
  for select to anon, authenticated using (bucket_id = 'flyers');

drop policy if exists "flyers submit upload" on storage.objects;
create policy "flyers submit upload" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'flyers' and ((storage.foldername(name))[1] = 'submissions' or public.is_admin()));

drop policy if exists "flyers admin delete" on storage.objects;
create policy "flyers admin delete" on storage.objects
  for delete to authenticated using (bucket_id = 'flyers' and public.is_admin());

-- =====================================================================
--  운영진 추가 방법 (README 4단계 참고)
--  Authentication > Users 에서 운영진을 초대한 뒤, 아래처럼 실행하세요.
--
--  insert into public.admins (user_id, display_name)
--  select id, '서나' from auth.users where email = '운영진이메일@example.com';
-- =====================================================================
