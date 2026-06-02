-- Drop Evolution API integration. WhatsApp delivery is now a simple share link
-- (wa.me + public schedule image URL) generated client-side — no per-workplace
-- config and no app-level instance needed.

alter table workplace_settings
  drop column if exists whatsapp_group_jid;
