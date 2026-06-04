# WhatsApp Integration

Two free capabilities: **invitations** and **schedule publishing**. Both use
`wa.me` share links only — no gateway, no API keys, no per-message cost. The
manager taps a pre-filled link and sends from their own WhatsApp.

## Invitations (free)

The manager generates a workplace **join code** (`invites` table; 90-day TTL,
reusable across employees). Two share surfaces:

1. **Per-employee** — on the team list, every "טרם הצטרף" employee shows a
   "שלח בוואטסאפ" button. Clicking it calls
   `getInviteShareLinkForEmployee(employeeId)`, which:
   - resolves (or creates) the workplace's active invite code,
   - builds a `wa.me/<phone>?text=…` URL with a Hebrew invite message
     containing `/join/<code>`,
   - and opens it in a new tab so the manager confirms in WhatsApp's UI.
2. **Workplace-wide** — the `InvitePanel` on `/team` still surfaces the bare
   code + a `wa.me?text=…` share link (no phone scoped) for ad-hoc sharing.

The employee opens the link, signs up or links their existing account, and is
attached to the workplace (`employees.user_id` set, `status='active'`).

## Schedule publishing (Phase 7)

On the configured **publish day** (Vercel Cron) the system:

1. Renders the week's schedule as an RTL table **PNG** via `next/og`
   (`/api/schedule-image/[periodId]`), uploaded to the **private**
   `schedule-images` bucket and namespaced by workplace
   (`${workplaceId}/${periodId}.png`).
2. Generates a **7-day signed URL** for that image and surfaces it on
   `/schedule` once the period is published.
3. The manager taps the "שתף בוואטסאפ" link → opens a pre-filled `wa.me`
   message with the signed URL, and sends to the team's WhatsApp group from
   their own phone.

The signed URL fits inside WhatsApp's link preview so the team sees the
image without leaving the chat.

## What we deliberately do NOT do

- No GreenAPI / Evolution API / Twilio integration. Past iterations tried
  these (see migrations `20260602120000_whatsapp_group.sql` and
  `20260602130000_drop_whatsapp_group.sql`); the conclusion was that a
  free, manager-confirmed `wa.me` share is simpler, costs nothing, and
  avoids per-workplace WhatsApp-number provisioning.
- No background "send" — the manager always taps to confirm. This is also
  a privacy win: employees never receive unexpected automated WhatsApp
  messages from an unfamiliar number.
