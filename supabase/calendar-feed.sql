-- Task Capture: Apple Calendar subscription
-- Run once, after schema.sql.

-- Each person gets one secret calendar link. The token is the secret part of the link.
-- To "reset" a link, the app deletes the row and makes a new one (new random token).
create table public.calendar_feeds (
  user_id     uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  token       text not null unique
              default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  created_at  timestamptz not null default now()
);

alter table public.calendar_feeds enable row level security;

revoke all on public.calendar_feeds from anon;
grant select, insert, delete on public.calendar_feeds to authenticated;

create policy "Users can read their own calendar link"
  on public.calendar_feeds for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own calendar link"
  on public.calendar_feeds for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own calendar link"
  on public.calendar_feeds for delete to authenticated
  using ((select auth.uid()) = user_id);

-- The calendar service (supabase/functions/calendar) looks up the token with the
-- server-only secret key, so Apple Calendar never needs to log in.
