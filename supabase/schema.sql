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

-- Tracks every /api/parse request (cache hit or miss) per hashed IP, used
-- for rate limiting. Previously rate limiting counted rows in `downloads`,
-- but that table is only written to on a cache MISS — so a burst of
-- requests for an already-cached URL never counted against the limit.
-- This ledger is written to on every request regardless of cache outcome.
create table if not exists parse_rate_limit_hits (
  id uuid primary key default gen_random_uuid(),
  ip_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_parse_rate_limit_hits_ip_hash
  on parse_rate_limit_hits (ip_hash, created_at desc);

-- Auto-delete rows older than 1 day; the rate-limit window only looks
-- back 1 minute, so nothing older than that is ever needed.
select cron.schedule(
  'yuksave-cleanup-parse-rate-limit-hits',
  '0 6 * * *', -- daily at 06:00 UTC
  $$ delete from parse_rate_limit_hits where created_at < now() - interval '1 day' $$
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

-- Defense-in-depth: enable RLS with zero policies on every table here.
-- The app only ever talks to Supabase through the service_role key
-- (see lib/supabase.ts), which bypasses RLS entirely, so this changes
-- nothing about how the app behaves today. What it does do is make sure
-- these tables (cache results, hashed IPs, admin login attempts) stay
-- locked down by default — not world-readable/writable — if an anon/public
-- Supabase key is ever introduced later, e.g. for a client-side feature.
alter table downloads enable row level security;
alter table parse_rate_limit_hits enable row level security;
alter table download_proxy_hits enable row level security;
alter table admin_login_attempts enable row level security;
