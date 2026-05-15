-- Direct shop orders (PayPal checkout + manual fulfillment).

create table if not exists public.shop_orders (
  id uuid primary key default gen_random_uuid(),
  order_ref text not null unique,
  style text not null,
  ring_size text not null,
  quantity integer not null check (quantity >= 1 and quantity <= 10),
  email text not null,
  customer_message text,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'USD',
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'cancelled', 'failed')),
  paypal_order_id text,
  paypal_capture_id text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists shop_orders_email_idx on public.shop_orders (email);
create index if not exists shop_orders_status_created_idx on public.shop_orders (status, created_at desc);
create index if not exists shop_orders_paypal_order_idx on public.shop_orders (paypal_order_id);

alter table public.shop_orders enable row level security;

revoke all on table public.shop_orders from anon, authenticated;
grant all on table public.shop_orders to service_role;
