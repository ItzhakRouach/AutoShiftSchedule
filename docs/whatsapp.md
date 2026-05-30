# WhatsApp Integration

Two free capabilities: **invitations** and **schedule publishing**. No paid WhatsApp Business API.

## Invitations (free)
Manager generates a workplace join **code** and a `wa.me?text=…` share link, shared from the manager's own
WhatsApp. The employee opens it, signs up / links their account, and is attached to the workplace
(`employees.user_id` set, status → active). Codes have an expiry (`invites.expires_at`).

## Publishing (Phase 7)
On the configured **publish day** (Vercel Cron), the system:
1. Renders the week's schedule as an RTL table **PNG** via `@vercel/og` (`/api/schedule-image/[periodId]`),
   cached in Supabase Storage per period.
2. **Manual share (default):** notifies the manager + a "שתף לקבוצה" button using the Web Share API
   (`navigator.share({ files: [png] })`) to post into the WhatsApp group in one tap.
3. **GreenAPI (optional, free):** if configured (instance_id/token/group), auto-sends the image to the group
   (`sendFileByUrl` → `<groupId>@g.us`). Note: unofficial service, requires linking a WhatsApp number (QR),
   has free-tier rate limits; always falls back to manual share if disabled/unavailable.

Secrets (GreenAPI token) stored encrypted in `workplace_settings`, never exposed client-side.
