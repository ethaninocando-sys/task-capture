-- Task Capture: notes on tasks and on daily checklist items
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- Run it once, after schema.sql, daily-checklist.sql and areas.sql.

-- 1. Tasks get an optional note (extra details, thoughts, links).
alter table public.tasks
  add column notes text check (notes is null or char_length(notes) <= 20000);

-- 2. Daily checklist notes: one note per item per day (e.g. your "End of day review"
--    thoughts for today). Each day starts blank; past days are kept as history.
create table public.daily_notes (
  item_id     uuid not null references public.daily_items (id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day         date not null,
  note        text not null default '' check (char_length(note) <= 20000),
  updated_at  timestamptz not null default now(),
  primary key (item_id, day)
);

create index daily_notes_user_day_idx on public.daily_notes (user_id, day);

-- 3. Security: each person only sees and changes their own notes.
alter table public.daily_notes enable row level security;

revoke all on public.daily_notes from anon;
grant select, insert, update, delete on public.daily_notes to authenticated;

create policy "Users can read their own daily notes"
  on public.daily_notes for select to authenticated
  using ((select auth.uid()) = user_id);

-- You can only write notes on daily items that belong to you.
create policy "Users can add notes to their own daily items"
  on public.daily_notes for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.daily_items i
      where i.id = item_id and i.user_id = (select auth.uid())
    )
  );

create policy "Users can update their own daily notes"
  on public.daily_notes for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.daily_items i
      where i.id = item_id and i.user_id = (select auth.uid())
    )
  );

create policy "Users can delete their own daily notes"
  on public.daily_notes for delete to authenticated
  using ((select auth.uid()) = user_id);

-- 4. Live sync between your devices.
alter publication supabase_realtime add table public.daily_notes;
