-- Run this in the Supabase SQL editor for your YukSave project.

create table if not exists downloads (
  id uuid primary key default gen_random_uuid(),
  source_url text not null,
  ip_hash text not null,
  result jsonb,
  created_at timestamptz not null default now()
);

-- Speeds up cache lookups by URL and rate-limit lookups by IP hash.
create index if not exists idx_downloads_source_url on downloads (source_url, created_at desc);
create index if not exists idx_downloads_ip_hash on downloads (ip_hash, created_at desc);

-- Auto-delete rows older than 7 days to keep the table small.
-- Requires the pg_cron extension: Supabase Dashboard → Database →
-- Extensions → enable "pg_cron", then run this block once.
select cron.schedule(
  'yuksave-cleanup-downloads',
  '0 3 * * *', -- daily at 03:00 UTC
  $$ delete from downloads where created_at < now() - interval '7 days' $$
);

-- Tracks hits on /api/download (the bandwidth-proxying route) per hashed
-- IP, so it can be rate-limited independently of /api/parse. Without this,
-- a previously-seen CDN URL could be replayed against /api/download
-- directly, unlimited times, without ever going through /api/parse's
-- own rate limit + Turnstile check.
create table if not exists download_proxy_hits (
  id uuid primary key default gen_random_uuid(),
  ip_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_download_proxy_hits_ip_hash
  on download_proxy_hits (ip_hash, created_at desc);

-- Auto-delete rows older than 1 day; the rate-limit window only looks
-- back 1 minute, so nothing older than that is ever needed.
select cron.schedule(
  'yuksave-cleanup-download-proxy-hits',
  '0 5 * * *', -- daily at 05:00 UTC
  $$ delete from download_proxy_hits where created_at < now() - interval '1 day' $$
);

-- Tracks admin login attempts (success/fail) per hashed IP, used to
-- rate-limit / lock out repeated failed logins against /api/admin/auth.
create table if not exists admin_login_attempts (
  id uuid primary key default gen_random_uuid(),
  ip_hash text not null,
  success boolean not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_login_attempts_ip_hash
  on admin_login_attempts (ip_hash, created_at desc);

-- Auto-delete rows older than 1 day; the lockout window only looks back
-- 15 minutes, so nothing older than that is ever needed. Same pg_cron
-- extension as above.
select cron.schedule(
  'yuksave-cleanup-admin-attempts',
  '0 4 * * *', -- daily at 04:00 UTC
  $$ delete from admin_login_attempts where created_at < now() - interval '1 day' $$
);
