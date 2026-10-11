-- LaptopFactory inventory table. Run this in the SQL Editor of a dedicated Supabase project.
create table if not exists public.inventory (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  category text not null check (category in ('laptop', 'desktop', 'cpu')),
  brand text not null default '' check (char_length(brand) <= 80),
  model text not null default '' check (char_length(model) <= 120),
  specifications text not null default '' check (char_length(specifications) <= 700),
  condition text not null default 'Refurbished' check (char_length(condition) <= 60),
  price_inr integer not null default 0 check (price_inr between 0 and 100000000),
  stock_quantity integer not null default 0 check (stock_quantity between 0 and 100000),
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_image_url_https check (image_url is null or image_url like 'https://%')
);

create index if not exists inventory_public_stock_idx
  on public.inventory (created_at desc)
  where is_active = true and stock_quantity > 0;

create or replace function public.set_inventory_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

drop trigger if exists inventory_set_updated_at on public.inventory;
create trigger inventory_set_updated_at
before update on public.inventory
for each row execute function public.set_inventory_updated_at();

alter table public.inventory enable row level security;
revoke all on table public.inventory from anon, authenticated;
grant select on table public.inventory to anon, authenticated;
grant select, insert, update, delete on table public.inventory to service_role;

drop policy if exists "Anyone can read active in-stock inventory" on public.inventory;
create policy "Anyone can read active in-stock inventory"
  on public.inventory
  for select
  to anon, authenticated
  using (is_active = true and stock_quantity > 0);

revoke all on function public.set_inventory_updated_at() from public, anon, authenticated;
