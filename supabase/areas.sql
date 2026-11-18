-- Task Capture: per-person areas
-- Run once, after schema.sql. Safe for existing data:
--   * everyone who already has an account keeps the original 9 areas
--   * existing tasks get linked to the matching area
--   * new accounts start with a simple starter set they can change

-- 1. Each person's own list of areas.
create table public.areas (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(trim(name)) between 1 and 40),
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  unique (user_id, name)
);

create index areas_user_id_idx on public.areas (user_id);

alter table public.areas enable row level security;

revoke all on public.areas from anon;
grant select, insert, update, delete on public.areas to authenticated;

create policy "Users can read their own areas"
  on public.areas for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can add their own areas"
  on public.areas for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own areas"
  on public.areas for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own areas"
  on public.areas for delete to authenticated
  using ((select auth.uid()) = user_id);

alter publication supabase_realtime add table public.areas;

-- 2. Tasks point at an area. Deleting an area leaves its tasks with "No area".
alter table public.tasks
  add column area_id uuid references public.areas (id) on delete set null;

create index tasks_area_id_idx on public.tasks (area_id);

-- The old text column stays for now (older app versions still write to it) but is no longer required.
alter table public.tasks alter column area drop not null;

-- Tasks can only use your own areas.
drop policy "Users can add their own tasks" on public.tasks;
drop policy "Users can update their own tasks" on public.tasks;

create policy "Users can add their own tasks"
  on public.tasks for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and (area_id is null or exists (
      select 1 from public.areas a where a.id = area_id and a.user_id = (select auth.uid())
    ))
  );

create policy "Users can update their own tasks"
  on public.tasks for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and (area_id is null or exists (
      select 1 from public.areas a where a.id = area_id and a.user_id = (select auth.uid())
    ))
  );

-- 3. Existing accounts keep the original 9 areas, and their tasks get linked up.
with defaults (slug, name, position) as (
  values
    ('family', 'Family', 0),
    ('relationship', 'Relationship', 1),
    ('health', 'Health', 2),
    ('events', 'Events', 3),
    ('war-room', 'War Room', 4),
    ('real-world', 'Real World', 5),
    ('ei-conversion', 'EI-Conversion', 6),
    ('finance', 'Finance', 7),
    ('systems', 'Systems', 8)
)
insert into public.areas (user_id, name, position)
select u.id, d.name, d.position
from auth.users u
cross join defaults d
on conflict (user_id, name) do nothing;

-- Helper (not reachable from the app): turns "War Room" into "war-room" to match old task values.
create schema if not exists private;

create or replace function private.area_slug(name text)
returns text
language sql
immutable
set search_path = ''
as $$ select lower(regexp_replace(trim(name), '\s+', '-', 'g')) $$;

update public.tasks t
set area_id = a.id
from public.areas a
where a.user_id = t.user_id
  and t.area_id is null
  and t.area = private.area_slug(a.name);

-- 4. Until everyone's app is updated, an older app saving "war-room" still gets linked to the right area.
create or replace function private.link_task_area()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.area_id is null and new.area is not null then
    select a.id into new.area_id
    from public.areas a
    where a.user_id = new.user_id
      and (a.name = new.area or private.area_slug(a.name) = new.area)
    limit 1;
  end if;
  return new;
end;
$$;

grant usage on schema private to authenticated;
grant execute on function private.area_slug(text) to authenticated;
grant execute on function private.link_task_area() to authenticated;

create trigger tasks_link_area
  before insert or update of area on public.tasks
  for each row execute function private.link_task_area();

-- 5. New accounts start with a simple starter set.
create or replace function private.create_starter_areas()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.areas (user_id, name, position)
  values
    (new.id, 'Personal', 0),
    (new.id, 'Work', 1),
    (new.id, 'Health', 2),
    (new.id, 'Family', 3),
    (new.id, 'Finance', 4)
  on conflict (user_id, name) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created_add_areas
  after insert on auth.users
  for each row execute function private.create_starter_areas();
