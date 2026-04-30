# First-run & Ring Write Dashboard SQL

Use these queries in Supabase SQL Editor to monitor commercial FTUX quality.

## 1) Event volume by hour (last 24h)

```sql
select
  date_trunc('hour', created_at) as hour_bucket,
  event_name,
  count(*) as events
from public.first_run_events
where created_at >= now() - interval '24 hours'
group by 1,2
order by hour_bucket desc, event_name;
```

## 2) Funnel: onboarding -> first memory (last 7d)

```sql
with base as (
  select
    event_name,
    created_at,
    user_id
  from public.first_run_events
  where created_at >= now() - interval '7 days'
),
counts as (
  select 'onboarding_opened' as step, count(*)::numeric as n from base where event_name = 'onboarding_opened'
  union all
  select 'onboarding_completed', count(*)::numeric from base where event_name = 'onboarding_completed'
  union all
  select 'first_memory_cta_clicked', count(*)::numeric from base where event_name = 'first_memory_cta_clicked'
  union all
  select 'first_memory_saved', count(*)::numeric from base where event_name = 'first_memory_saved'
)
select
  step,
  n as events,
  round((n / nullif((select n from counts where step = 'onboarding_opened'), 0)) * 100, 2) as pct_from_opened
from counts
order by case step
  when 'onboarding_opened' then 1
  when 'onboarding_completed' then 2
  when 'first_memory_cta_clicked' then 3
  when 'first_memory_saved' then 4
  else 99
end;
```

## 3) Ring start-link write success rate (last 7d)

```sql
with w as (
  select
    date_trunc('day', created_at) as day_bucket,
    event_name
  from public.first_run_events
  where created_at >= now() - interval '7 days'
    and event_name in (
      'ring_start_link_written_success',
      'ring_start_link_written_failed',
      'ring_start_link_manual_required'
    )
)
select
  day_bucket,
  count(*) filter (where event_name = 'ring_start_link_written_success') as write_success,
  count(*) filter (where event_name = 'ring_start_link_written_failed') as write_failed,
  count(*) filter (where event_name = 'ring_start_link_manual_required') as manual_required,
  round(
    (
      count(*) filter (where event_name = 'ring_start_link_written_success')::numeric
      / nullif(
          (count(*) filter (where event_name in ('ring_start_link_written_success','ring_start_link_written_failed'))),
          0
        )
    ) * 100,
    2
  ) as write_success_rate_pct
from w
group by 1
order by day_bucket desc;
```

