-- Task Capture: database setup
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- Safe to run once on a fresh project.

-- 1. The tasks table
create table public.tasks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title       text not null check (char_length(trim(title)) > 0),
  priority    text not null check (priority in ('A', 'B', 'C', 'D', 'W')),
  area        text not null check (char_length(area) > 0),
  kind        text not null check (kind in ('quick', 'message', 'call', 'deep')),
  deadline    date,
  done        boolean not null default false,
  done_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index tasks_user_id_idx on public.tasks (user_id);

-- 2. Security: each signed-in user can only see and change their own tasks.
--    Nobody who is signed out can touch the table at all.
alter table public.tasks enable row level security;

revoke all on public.tasks from anon;
grant select, insert, update, delete on public.tasks to authenticated;

create policy "Users can read their own tasks"
  on public.tasks for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can add their own tasks"
  on public.tasks for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own tasks"
  on public.tasks for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own tasks"
  on public.tasks for delete to authenticated
  using ((select auth.uid()) = user_id);

-- 3. Live sync: tell the app instantly when a task changes on another device.
alter publication supabase_realtime add table public.tasks;
