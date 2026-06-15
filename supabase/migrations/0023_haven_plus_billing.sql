-- Haven-level Plus billing: one subscription/trial per Pair (max 2 members).

alter table public.havens
  add column if not exists plus_billing_user_id uuid references auth.users (id) on delete set null,
  add column if not exists plus_trial_start timestamptz,
  add column if not exists plus_trial_end timestamptz;

create index if not exists havens_plus_billing_user_idx
  on public.havens (plus_billing_user_id)
  where plus_billing_user_id is not null;

create index if not exists havens_plus_trial_end_idx
  on public.havens (plus_trial_end)
  where plus_trial_end is not null;

comment on column public.havens.plus_billing_user_id is
  'Haven Plus payer account; paid subscription is read from this user''s user_entitlements.';
comment on column public.havens.plus_trial_end is
  'One 30-day Haven Plus trial per Haven (not per member).';
