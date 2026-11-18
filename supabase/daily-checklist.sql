-- Task Capture: daily checklist
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- Run it once, after schema.sql.

-- 1. Your daily list items (e.g. "Workout"), and which weekdays each one shows.
--    days uses 0 = Sunday, 1 = Monday ... 6 = Saturday.
create table public.daily_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title       text not null check (char_length(trim(title)) > 0),
  days        smallint[] not null default '{0,1,2,3,4,5,6}'
              check (cardinality(days) > 0 and days <@ '{0,1,2,3,4,5,6}'::smallint[]),
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);

create index daily_items_user_id_idx on public.daily_items (user_id);

-- 2. One row per item per day you checked it off. This is what makes the list
--    "reset" each day and what streaks are counted from.
create table public.daily_checks (
  item_id     uuid not null references public.daily_items (id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day         date not null,
  created_at  timestamptz not null default now(),
  primary key (item_id, day)
);

create index daily_checks_user_day_idx on public.daily_checks (user_id, day);

-- 3. Security: each person only sees and changes their own list.
alter table public.daily_items enable row level security;
alter table public.daily_checks enable row level security;

revoke all on public.daily_items from anon;
revoke all on public.daily_checks from anon;
grant select, insert, update, delete on public.daily_items to authenticated;
grant select, insert, delete on public.daily_checks to authenticated;

create policy "Users can read their own daily items"
  on public.daily_items for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can add their own daily items"
  on public.daily_items for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own daily items"
  on public.daily_items for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own daily items"
  on public.daily_items for delete to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can read their own daily checks"
  on public.daily_checks for select to authenticated
  using ((select auth.uid()) = user_id);

-- You can only check off items that belong to you.
create policy "Users can check their own daily items"
  on public.daily_checks for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.daily_items i
      where i.id = item_id and i.user_id = (select auth.uid())
    )
  );

create policy "Users can uncheck their own daily items"
  on public.daily_checks for delete to authenticated
  using ((select auth.uid()) = user_id);

-- 4. Live sync between your devices.
alter publication supabase_realtime add table public.daily_items;
alter publication supabase_realtime add table public.daily_checks;
