-- 20260531000002_one_org_per_user.sql — enforce the core invariant:
-- one organization per user (manager). Also add name length guards.

-- ── Dedupe existing data (dev/test only) ─────────────────────────────────────
-- Keep the earliest org per owner; extra orgs (and their workplaces) cascade.
delete from organizations a using organizations b
where a.owner_user_id = b.owner_user_id and a.created_at > b.created_at;

-- ── One org per owner ────────────────────────────────────────────────────────
alter table organizations add constraint organizations_owner_unique unique (owner_user_id);

-- ── Name length guards ───────────────────────────────────────────────────────
alter table organizations add constraint organizations_name_len
  check (char_length(name) between 2 and 120);
alter table workplaces add constraint workplaces_name_len
  check (char_length(name) between 2 and 120);
