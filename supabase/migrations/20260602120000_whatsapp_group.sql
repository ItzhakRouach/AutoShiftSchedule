-- Replace GreenAPI integration with self-hosted Evolution API.
-- The Evolution connection (URL / apikey / instance) lives in env, app-wide.
-- Per-workplace we only store the target WhatsApp group JID.

alter table workplace_settings
  add column if not exists whatsapp_group_jid text;

alter table workplace_settings
  drop column if exists greenapi_instance,
  drop column if exists greenapi_token,
  drop column if exists greenapi_group;
