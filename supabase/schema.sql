create extension if not exists pgcrypto;

create table if not exists public.growth_events (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique,
  event_name text not null check (event_name in (
    'page_view',
    'funnel_step_view',
    'funnel_step_completed',
    'button_click',
    'activity_selected',
    'participation_completed',
    'purchase_cta_clicked',
    'checkout_started',
    'purchase_completed'
  )),
  session_id text not null check (length(session_id) between 1 and 80),
  funnel_step text,
  button_id text,
  page_path text not null,
  referrer_host text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists growth_events_name_created_idx
  on public.growth_events (event_name, created_at desc);
create index if not exists growth_events_session_created_idx
  on public.growth_events (session_id, created_at);
create index if not exists growth_events_button_created_idx
  on public.growth_events (button_id, created_at desc)
  where event_name = 'button_click';

alter table public.growth_events enable row level security;

drop policy if exists "Allow anonymous growth event inserts" on public.growth_events;
create policy "Allow anonymous growth event inserts"
  on public.growth_events
  for insert
  to anon, authenticated
  with check (event_name <> 'purchase_completed');

comment on table public.growth_events is
  'Anonymous product analytics events. Never store free-form user notes or secrets here.';

-- Run these queries in the Supabase SQL editor to inspect campaign performance.
-- Button clicks:
-- select button_id, count(*) as clicks
-- from public.growth_events
-- where event_name = 'button_click'
--   and created_at >= now() - interval '30 days'
-- group by button_id
-- order by clicks desc;
--
-- Funnel reach and drop-off:
-- with stages as (
--   select 1 as stage_order, 'landing' as stage, count(distinct session_id) as visitors
--   from public.growth_events where event_name = 'page_view'
--   union all
--   select 2, 'activity_selected', count(distinct session_id)
--   from public.growth_events where event_name = 'funnel_step_completed' and funnel_step = 'activity'
--   union all
--   select 3, 'participation_completed', count(distinct session_id)
--   from public.growth_events where event_name = 'participation_completed'
-- )
-- select stage, visitors,
--   round(100.0 * (1 - visitors::numeric / nullif(lag(visitors) over (order by stage_order), 0)), 1) as dropoff_percent
-- from stages order by stage_order;
--
-- Purchase conversion (purchase_completed must be inserted by a trusted payment webhook):
-- select
--   count(distinct session_id) filter (where event_name = 'checkout_started') as checkout_sessions,
--   count(distinct session_id) filter (where event_name = 'purchase_completed') as purchaser_sessions,
--   round(100.0 * count(distinct session_id) filter (where event_name = 'purchase_completed') /
--     nullif(count(distinct session_id) filter (where event_name = 'checkout_started'), 0), 1) as conversion_percent
-- from public.growth_events;