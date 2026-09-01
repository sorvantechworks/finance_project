-- ClearPath V2 Supabase schema
-- Run this whole file in Supabase SQL Editor.
-- IMPORTANT: never put the service_role key in the website.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default 'Friend',
  email text,
  currency text not null default '$',
  created_at timestamptz not null default now()
);

create table if not exists public.monthly_finance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  month text not null,
  income numeric not null default 0,
  note text not null default '',
  expenses jsonb not null default '{"rent":0,"food":0,"travel":0,"phone":0,"misc":0,"other":0}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, month)
);

create table if not exists public.loans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  balance numeric not null default 0,
  emi numeric not null default 0,
  rate numeric not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.chits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  monthly numeric not null default 0,
  note text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.temporary_debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  balance numeric not null default 0,
  note text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  description text not null,
  amount numeric not null default 0,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.monthly_finance enable row level security;
alter table public.loans enable row level security;
alter table public.chits enable row level security;
alter table public.temporary_debts enable row level security;
alter table public.activity enable row level security;

drop policy if exists "profiles own data" on public.profiles;
create policy "profiles own data" on public.profiles for all using (auth.uid()=id) with check (auth.uid()=id);

drop policy if exists "monthly own data" on public.monthly_finance;
create policy "monthly own data" on public.monthly_finance for all using (auth.uid()=user_id) with check (auth.uid()=user_id);

drop policy if exists "loans own data" on public.loans;
create policy "loans own data" on public.loans for all using (auth.uid()=user_id) with check (auth.uid()=user_id);

drop policy if exists "chits own data" on public.chits;
create policy "chits own data" on public.chits for all using (auth.uid()=user_id) with check (auth.uid()=user_id);

drop policy if exists "debts own data" on public.temporary_debts;
create policy "debts own data" on public.temporary_debts for all using (auth.uid()=user_id) with check (auth.uid()=user_id);

drop policy if exists "activity own data" on public.activity;
create policy "activity own data" on public.activity for all using (auth.uid()=user_id) with check (auth.uid()=user_id);

-- Optional: create a profile automatically whenever a new auth user is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id,name,email)
  values (new.id, coalesce(new.raw_user_meta_data->>'name','Friend'), new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();
