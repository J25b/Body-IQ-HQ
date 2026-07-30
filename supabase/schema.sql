-- BodyIQ HQ — Phase Two schema.
-- Run this once in the Supabase SQL editor for your project.
-- This is a reference/setup script, not something the app runs itself.

-- ============================================================
-- admins: exactly one row, ever. Enforced by the RLS policy
-- below (database-level), not just by hiding the setup page.
-- ============================================================

create table if not exists admins (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  created_at timestamptz not null default now()
);

alter table admins enable row level security;

-- Only ever allow an insert while the table is empty, and only for a row
-- matching the currently-authenticated user. This is what actually
-- prevents a second administrator account from being created — even if
-- someone bypassed the UI and called the insert directly.
create policy "single admin insert"
  on admins for insert
  with check (
    (select count(*) from admins) = 0
    and auth.uid() = id
  );

-- An admin may read (and later, in Phase Seven, update) only their own row.
create policy "admin reads self"
  on admins for select
  using (auth.uid() = id);

create policy "admin updates self"
  on admins for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ============================================================
-- has_admin(): the only way the frontend checks admin existence.
-- SECURITY DEFINER means it runs with the privileges needed to see
-- into the admins table, but it only ever returns a boolean —
-- never row data — so it's safe to grant to the anon role.
-- ============================================================

create or replace function has_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists(select 1 from admins);
$$;

grant execute on function has_admin() to anon;
grant execute on function has_admin() to authenticated;

-- ============================================================
-- Manual step required in the Supabase dashboard (cannot be done
-- from the frontend, and intentionally so — it requires
-- project-owner access, not just an anon key):
--
--   After you have created your one administrator account through
--   the Setup page, go to:
--     Authentication -> Providers -> Email -> toggle OFF "Enable Sign Up"
--
--   This closes the door at the Supabase project level too, so even
--   direct calls to supabase.auth.signUp() from outside this app will
--   be rejected, not just insert attempts into the admins table.
-- ============================================================

-- ============================================================
-- Phase Four: anonymous analytics events + aggregation views.
--
-- No user-identifying columns exist in this table by design, not just by
-- convention: session_id is a random UUID generated and stored client-side
-- (see the proposed public-site snippet — not yet wired in, pending
-- approval), never tied to an email, IP address, or account. bmi_category
-- stores only the four category labels (Underweight/Normal/Overweight/
-- Obese), never an exact BMI figure, weight, or height.
-- ============================================================

create table if not exists events (
  id bigint generated always as identity primary key,
  event_type text not null check (event_type in (
    'session_start', 'session_end', 'bmi_calculated', 'report_downloaded'
  )),
  session_id uuid not null,
  is_returning boolean,
  device_type text check (device_type in ('mobile', 'tablet', 'desktop')),
  browser text,
  os text,
  theme text check (theme in ('light', 'dark')),
  bmi_category text check (bmi_category in ('Underweight', 'Normal weight', 'Overweight', 'Obese')),
  wellness_goal text check (wellness_goal in ('lose', 'gain', 'maintain', 'improve')),
  duration_seconds integer,
  created_at timestamptz not null default now()
);

create index if not exists events_type_created_idx on events (event_type, created_at);
create index if not exists events_session_idx on events (session_id);

alter table events enable row level security;

-- The public Body IQ site (anon key) may only ever write events, never
-- read them back — this is a write-only firehose from the anon role's
-- point of view.
create policy "anon can insert events"
  on events for insert
  to anon
  with check (true);

-- Only the signed-in administrator can read raw event rows.
create policy "authenticated can read events"
  on events for select
  to authenticated
  using (true);

-- ---- Aggregation views the Analytics page reads from ----
-- Policy note: as of this schema, the public Body IQ site only ever sends
-- session_start / bmi_calculated / report_downloaded events with no
-- device, browser, OS, theme, or duration data attached (see analytics.js
-- on the public site). The views below for those dimensions are kept for
-- forward compatibility if that scope is ever widened, but the HQ
-- Analytics page currently only queries analytics_summary and
-- analytics_growth_daily — the rest will simply return no rows.
-- These are already fully aggregated (no per-row filtering needed), so
-- access control here is simply: only `authenticated` is GRANTed SELECT
-- on the views at all. `anon` has no grant on them, so those queries are
-- rejected outright regardless of view execution semantics.

create or replace view analytics_summary as
select
  count(distinct session_id) filter (where event_type = 'session_start') as total_visitors,
  count(distinct session_id) filter (where event_type = 'session_start' and is_returning) as returning_visitors,
  count(*) filter (where event_type = 'bmi_calculated') as total_bmi_calculations,
  count(*) filter (where event_type = 'report_downloaded') as total_reports_generated,
  round(avg(duration_seconds) filter (where event_type = 'session_end'))::int as avg_session_seconds
from events;

create or replace view analytics_device_breakdown as
select device_type, count(distinct session_id) as sessions
from events
where event_type = 'session_start' and device_type is not null
group by device_type;

create or replace view analytics_browser_breakdown as
select browser, count(distinct session_id) as sessions
from events
where event_type = 'session_start' and browser is not null
group by browser
order by sessions desc
limit 8;

create or replace view analytics_os_breakdown as
select os, count(distinct session_id) as sessions
from events
where event_type = 'session_start' and os is not null
group by os
order by sessions desc
limit 8;

create or replace view analytics_theme_breakdown as
select theme, count(distinct session_id) as sessions
from events
where event_type = 'session_start' and theme is not null
group by theme;

create or replace view analytics_growth_daily as
select
  date_trunc('day', created_at)::date as day,
  count(distinct session_id) as visitors
from events
where event_type = 'session_start'
  and created_at > now() - interval '30 days'
group by day
order by day;

grant select on analytics_summary, analytics_device_breakdown,
  analytics_browser_breakdown, analytics_os_breakdown,
  analytics_theme_breakdown, analytics_growth_daily to authenticated;

-- ============================================================
-- Phase Five: content management.
--
-- One generic table with a `type` column rather than five separate
-- tables — this is what makes "future dynamic content" (mentioned in the
-- spec) just a new `type` value instead of a schema migration. RLS is
-- what actually enforces "draft/disabled stays invisible to the public
-- site" — the public site never needs its own filtering logic to get
-- this right, because it structurally cannot see unpublished rows.
-- ============================================================

create extension if not exists pgcrypto;

create table if not exists content_items (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in (
    'wellness_tip', 'reflection_template', 'insight', 'announcement', 'pdf_footer'
  )),
  title text,
  body text not null,
  status text not null default 'draft' check (status in ('draft', 'published', 'disabled')),
  display_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists content_items_type_status_idx on content_items (type, status);

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists content_items_updated_at on content_items;
create trigger content_items_updated_at
  before update on content_items
  for each row execute function set_updated_at();

alter table content_items enable row level security;

-- The admin (authenticated) can do everything.
create policy "authenticated full access to content"
  on content_items for all
  to authenticated
  using (true)
  with check (true);

-- The public site (anon) can only ever see published rows — this is the
-- entire enforcement mechanism for "draft/disabled never reaches users."
create policy "anon reads published content only"
  on content_items for select
  to anon
  using (status = 'published');

-- ============================================================
-- Phase Six: Insights.
--
-- Adds one new event type, assessment_completed, carrying only the
-- selected wellness goal and the computed wellness score (0-100) — both
-- bucketed/summary values, same philosophy as bmi_category on
-- bmi_calculated. No raw assessment answers (activity level, eating
-- habits, exercise frequency, sleep) are ever sent; those stay local to
-- the user's own results view.
--
-- Theme usage is deliberately NOT tracked here, per the earlier decision
-- to keep Body IQ's analytics footprint narrow — the Insights page says
-- so honestly rather than showing empty/fake data for it.
-- ============================================================

alter table events drop constraint if exists events_event_type_check;
alter table events add constraint events_event_type_check check (event_type in (
  'session_start', 'session_end', 'bmi_calculated', 'report_downloaded', 'assessment_completed'
));

alter table events add column if not exists wellness_score integer;

create or replace view insights_summary as
select
  round(avg(wellness_score) filter (where event_type = 'assessment_completed'))::int as avg_wellness_score,
  count(*) filter (where event_type = 'assessment_completed') as total_assessments_completed,
  count(*) filter (where event_type = 'bmi_calculated') as total_bmi_calculations
from events;

create or replace view insights_bmi_category_breakdown as
select bmi_category, count(*) as calculations
from events
where event_type = 'bmi_calculated' and bmi_category is not null
group by bmi_category
order by calculations desc;

create or replace view insights_goal_breakdown as
select wellness_goal, count(*) as selections
from events
where event_type = 'assessment_completed' and wellness_goal is not null
group by wellness_goal
order by selections desc;

grant select on insights_summary, insights_bmi_category_breakdown, insights_goal_breakdown to authenticated;

-- ============================================================
-- Phase Seven: application settings (maintenance mode, app version,
-- feature flags) as a simple key/value store — flexible enough that
-- adding a new setting later never requires a schema migration.
-- ============================================================

create table if not exists app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

drop trigger if exists app_settings_updated_at on app_settings;
create trigger app_settings_updated_at
  before update on app_settings
  for each row execute function set_updated_at();

alter table app_settings enable row level security;

create policy "authenticated full access to settings"
  on app_settings for all
  to authenticated
  using (true)
  with check (true);

-- Only maintenance_mode and app_version are readable by the public site.
-- Feature flags stay admin-only until a specific flag has an actual,
-- reviewed public-site integration built for it.
create policy "anon reads public settings only"
  on app_settings for select
  to anon
  using (key in ('maintenance_mode', 'app_version'));

insert into app_settings (key, value) values
  ('maintenance_mode', 'false'::jsonb),
  ('app_version', '"1.5.0"'::jsonb),
  ('feature_flags', '{}'::jsonb)
on conflict (key) do nothing;

-- ============================================================
-- Phase Eight: security — failed login protection, login activity log.
--
-- Both the lockout check and the attempt recording go through
-- SECURITY DEFINER functions rather than direct table access from anon,
-- same pattern as has_admin(). This means the anon role never gets a
-- SELECT or INSERT grant on login_attempts directly — it can only ever
-- call these two narrow functions, and can never read raw rows (which
-- would otherwise leak login timing/activity to anyone on the login page,
-- authenticated or not).
-- ============================================================

create table if not exists login_attempts (
  id bigint generated always as identity primary key,
  email text not null,
  success boolean not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists login_attempts_email_created_idx on login_attempts (email, created_at);

alter table login_attempts enable row level security;

-- No direct anon or authenticated grants for insert/select here on
-- purpose — access is only through the two functions below. The admin
-- can still read their own activity log through record_login_attempt's
-- sibling read path (see get_login_activity below), not raw table access.

create or replace function check_login_lockout(p_email text)
returns table(is_locked boolean, attempts_remaining int, retry_after_seconds int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window interval := interval '15 minutes';
  v_max_attempts int := 5;
  v_recent_failures int;
  v_oldest_failure timestamptz;
begin
  select count(*), min(created_at)
    into v_recent_failures, v_oldest_failure
  from login_attempts
  where email = p_email
    and success = false
    and created_at > now() - v_window;

  if v_recent_failures >= v_max_attempts then
    return query select true, 0,
      greatest(0, extract(epoch from (v_oldest_failure + v_window - now()))::int);
  else
    return query select false, (v_max_attempts - v_recent_failures)::int, 0;
  end if;
end;
$$;

grant execute on function check_login_lockout(text) to anon, authenticated;

create or replace function record_login_attempt(p_email text, p_success boolean, p_user_agent text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into login_attempts (email, success, user_agent)
  values (p_email, p_success, p_user_agent);
end;
$$;

grant execute on function record_login_attempt(text, boolean, text) to anon, authenticated;

-- The signed-in admin can review their own login history through this
-- function (still never raw table grants) rather than a general SELECT
-- policy, keeping the access path explicit and auditable in one place.
create or replace function get_login_activity(p_limit int default 25)
returns table(email text, success boolean, user_agent text, created_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select email, success, user_agent, created_at
  from login_attempts
  order by created_at desc
  limit p_limit;
$$;

grant execute on function get_login_activity(int) to authenticated;

-- ============================================================
-- Phase Nine: application health.
-- One small addition: an efficient count function for login_attempts,
-- since that table has no direct SELECT grant (see Phase Eight) — the
-- Health page needs a row count without fetching rows themselves.
-- ============================================================

create or replace function get_login_attempts_count()
returns bigint
language sql
security definer
set search_path = public
as $$
  select count(*) from login_attempts;
$$;

grant execute on function get_login_attempts_count() to authenticated;
