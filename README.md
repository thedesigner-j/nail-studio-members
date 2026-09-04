# Nail Studio Members

Members-area web app for the nail business: a dollar-credit loyalty program, appointment booking with Google Calendar sync, and appointment/history views. Built with Next.js (App Router) and Supabase (Postgres, Auth, Storage). Designed to be embedded in the existing Webflow site via `<iframe>`.

## Features

- Email/password auth (sign up, sign in, email confirmation)
- Profile with photo upload
- Book an appointment (service + live availability + buffer times + confirm), with account credit applicable at checkout
- Upcoming appointments, appointment history (with cancel), and payment history — all as tabs on one page
- Google Calendar sync (connect account, appointments create/delete calendar events)
- Hourly reminder webhook, ~24h before each appointment
- **Loyalty**: a dollar-credit ledger (not points) — members earn credit for creating an account, completing a paid visit, referring a friend, sharing an admin-flagged promo, or leaving a review (the last two require admin approval). Referring a friend generates a link + a ready-to-paste message the member copies and sends themselves (no SMS provider/cost involved). Credit is spent in whole or in part at checkout and expires a year after it's earned. Full admin controls at `/admin/loyalty` (earn rates, shareable posts, review platforms, approval queue, ledger + manual adjustments) and `/admin/appointments` (mark a visit paid & completed, which is what triggers session credit and referral confirmation).
- Messages: a single thread per member with the studio, live via Supabase Realtime
- Look Book: members attach up to 3 photos to a past appointment; all members' photos appear in a shared Pinterest-style masonry grid where anyone can like a photo or save it into a personal collection
- Early Access: admin-posted sales/product/event announcements, members-only, with an unread indicator in the nav
- Admin section (`/admin`, linked from the nav for accounts with `profiles.is_admin = true`): working hours, services & rates, early access posts, appointments, and loyalty

## Known limitations

- **Message replies**: there's no admin reply UI yet — insert a row into `messages` with `sender = 'business'` for the relevant `user_id` directly in the Supabase Table Editor.
- **Marking a no-show**: `/admin/appointments` only offers "paid & completed" — a no-show still needs `appointments.status` updated directly in the Table Editor.

## Setup

### 1. Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL editor, run the migrations in `supabase/migrations/` in numeric order, skipping 0004 for now — it needs values filled in first, see "Reminder webhook" below.
3. Copy the Project URL, `anon` key, and `service_role` key from Project Settings → API.

### 2. Google Calendar OAuth

1. In [Google Cloud Console](https://console.cloud.google.com), create a project (or use an existing one) and enable the **Google Calendar API**.
2. Configure the OAuth consent screen (External, or Internal if using Google Workspace).
3. Create an OAuth Client ID (Web application). Add an authorized redirect URI: `{NEXT_PUBLIC_SITE_URL}/api/calendar/callback` (e.g. `http://localhost:3000/api/calendar/callback` for local dev, and your production URL once deployed).
4. Copy the client ID and secret.

### 3. Environment variables

Copy `.env.local.example` to `.env.local` and fill in the Supabase and Google values.

### 4. Run it

```bash
npm install
npm run dev
```

Visit `http://localhost:3000`, sign up, and you'll land on the members dashboard.

### 5. Reminder webhook (optional, for appointment reminders)

The edge function in `supabase/functions/send-appointment-reminders` checks hourly for appointments starting in ~24 hours and POSTs a JSON payload to `REMINDER_WEBHOOK_URL` — point that at Zapier, Make, Twilio, or a SendGrid-backed endpoint to actually send the SMS/email.

1. Deploy the function: `supabase functions deploy send-appointment-reminders`
2. Set its secrets: `supabase secrets set REMINDER_WEBHOOK_URL=... CRON_SECRET=...`
3. Edit `supabase/migrations/0004_reminder_schedule.sql`, replacing `<project-ref>` and `<CRON_SECRET>`, then run it in the SQL editor.

### 6. Expiring credit daily (optional, for the loyalty program)

`expire_credits()` (defined in `0011_reward_credits.sql`) sweeps confirmed credit lines past their `expires_at` to `expired`. It's a plain SQL function with no external dependency, so — unlike the reminder webhook — it can be scheduled directly with `pg_cron`, no edge function needed:

```sql
select cron.schedule('expire-reward-credits-daily', '0 3 * * *', $$select public.expire_credits();$$);
```

Run that once in the SQL editor (requires the `pg_cron` extension, already enabled if you set up the reminder webhook above; otherwise run `create extension if not exists pg_cron with schema extensions;` first).

## Embedding in Webflow

Deploy this app (e.g. to Vercel) and set `WEBFLOW_SITE_ORIGIN` to your Webflow site's origin (e.g. `https://yourbusiness.webflow.io`, or your custom domain) — this is what's allowed to iframe-embed the app via the `Content-Security-Policy: frame-ancestors` header in `next.config.ts`.

**Embed only `/login`, not `/dashboard`.** The full app (multi-page nav, tables, the Look Book grid, etc.) isn't designed to live inside a small embedded iframe — trying to cram it in there is what causes clipped/cut-off content. Instead, the embed shows just the compact login screen; on successful sign-in (or if the visitor's already logged in), the app breaks the whole browser tab out to the full app on its own page. This also sidesteps a browser-cookie quirk: third-party iframes get treated as "cross-site" for cookie purposes, so an already-logged-in session doesn't always carry into an embedded page reliably in every browser.

In Webflow, add an Embed element on the members page with:

```html
<iframe id="members-app" src="https://members.yourbusiness.com/login"
  style="width:100%; border:0; min-height:480px" scrolling="no"></iframe>
<script>
  window.addEventListener("message", (event) => {
    if (event.data?.type === "nail-members:resize") {
      document.getElementById("members-app").style.height = event.data.height + "px";
    }
  });
</script>
```

The app posts its content height to the parent window on load and on resize, so the script above auto-sizes the iframe to fit just the login form (no internal scrollbar). Once someone signs in, they land on the full app as a normal, un-embedded page.

## Editing the service menu / business hours

`supabase/migrations/0002_seed.sql` seeds starter services and hours — edit rows directly in the Supabase Table Editor (`services`, `business_hours` tables) for the real menu and schedule; no code changes needed.
