-- Web Push subscriptions (PWA). One row per browser/device endpoint, owned by
-- the authenticated user. Used to send deadline reminders + "schedule published"
-- notifications. Self-scoped via RLS; the cron/publish paths read via the
-- service-role (admin) client which bypasses RLS.

create table if not exists push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx on push_subscriptions(user_id);

alter table push_subscriptions enable row level security;

-- A user fully controls their own subscription rows; nobody else can read them.
create policy push_subscriptions_self on push_subscriptions
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
