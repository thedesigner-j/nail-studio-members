# Nail Studio Members

Members-area web app for the nail business: a dollar-credit loyalty program, appointment booking with Google Calendar sync, and appointment/history views. Built with Next.js (App Router) and Supabase (Postgres, Auth, Storage). Designed to be embedded in the existing Webflow site via `<iframe>`.

## Features

- Email/password auth (sign up, sign in, email confirmation)
- Profile with photo upload
- Book an appointment (service + live availability + buffer times), with a **Stripe deposit required to confirm** — a configurable % of the service price, account credit can be applied toward it, and the slot is held for 30 minutes while checkout is in progress
- Cancellation policy: cancelling far enough ahead (configurable window) auto-refunds the deposit via Stripe; cancelling late or not showing up forfeits it
- Upcoming appointments, appointment history (with cancel), and payment history — all as tabs on one page
- Google Calendar sync (connect account, appointments create/delete calendar events)
- Booking confirmation and appointment reminder emails via Resend (a hourly-checked reminder ~2 days out, and another the day of)
- **Loyalty**: a dollar-credit ledger (not points) — members earn credit for creating an account, completing a paid visit, referring a friend, sharing an admin-flagged promo, or leaving a review (the last two require admin approval). Referring a friend generates a link + a ready-to-paste message the member copies and sends themselves (no SMS provider/cost involved). Credit is spent in whole or in part at checkout and expires a year after it's earned. Full admin controls at `/admin/loyalty` (earn rates, shareable posts, review platforms, approval queue, ledger + manual adjustments) and `/admin/appointments` (mark a visit paid & completed, which is what triggers session credit and referral confirmation).
- Messages: a single thread per member with the studio, live via Supabase Realtime
- Look Book: members attach up to 3 photos to a past appointment; all members' photos appear in a shared Pinterest-style masonry grid where anyone can like a photo or save it into a personal collection
- Early Access: admin-posted sales/product/event announcements, members-only, with an unread indicator in the nav
- **Skill Projects**: practice projects the admin assigns to a nail tech (`/admin/skill-projects`). Each has a reference (a Look Book photo, an uploaded image or an outside link), tutorial links (YouTube plays in the app), a goals checklist, due date and priority. The tech works through them under **My Projects**: they submit photos plus links to videos hosted elsewhere, and the admin approves or sends the work back with feedback. Approved work forms the tech's portfolio. Give someone the tech role from the Clients page; an admin can be a tech too. Photos are kept in a private storage bucket and only shown through short-lived links.
- Admin section (`/admin`, linked from the nav for accounts with `profiles.is_admin = true`): clients directory (bookings/spend/loyalty/referral stats per member), working hours, services & rates, early access posts, appointments (mark paid & completed, cancel, or no-show), booking & deposit settings, loyalty, and a messages inbox to reply to members' threads

## Local development

You can build and test the whole app on your own machine without a hosted Supabase project. Supabase runs locally in Docker, and nothing is sent to supabase.com.

Requires Node.js 20+ and Docker (Docker Desktop on Mac/Windows, running).

**The quick way:** run this from the project folder, every time you want to work on the app:

```bash
npm run local
```

It runs `scripts/local.sh`, which:

- checks Node and Docker are ready
- points `.env.local` at the local database, first moving any existing `.env.local` with real keys to `.env.hosted.backup` (nothing is deleted)
- installs dependencies when they've changed
- starts local Supabase, then the app

Press Control+C to stop the app.

**Doing it by hand** (same result):

1. Install dependencies and start local Supabase. This applies every migration in `supabase/migrations/`, then `supabase/seed.sql`:

   ```bash
   npm install
   npx supabase start
   ```

2. Create `.env.local` pointing at it. These are the standard keys every local Supabase install uses: they aren't secrets and only work against your own machine.

   ```
   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   ```

3. Run the app and open http://localhost:3000:

   ```bash
   npm run dev
   ```

Sign in with the seeded admin account, `admin@example.com` / `password123`, or the seeded nail tech, `tech@example.com` / `password123` (for Skill Projects), or sign up a new member. Locally, sign-ups don't need email confirmation.

Useful while developing:

- **Supabase Studio** (browse and edit tables, storage, users): http://localhost:54323
- **Mailpit** (catches every email local Supabase sends, e.g. password resets): http://localhost:54324
- **Start the database over** (wipes local data, re-runs all migrations and the seed): `npx supabase db reset`
- **Stop Supabase** when you're done: `npx supabase stop`

What's different from production locally (set in `supabase/seed.sql`):

- **Booking deposits are off**, so bookings confirm without Stripe.
- **The hourly reminder job from migration 0004 is switched off**, because it points at a hosted project.

Stripe, Resend and Google Calendar are optional locally. Add their test keys to `.env.local` when you want to work on those features.

Local data is throwaway. Anything that should exist in production (schema changes, the service menu, business hours) belongs in a new file in `supabase/migrations/`, not just in Studio. When you're ready to go live, follow the setup below to create the hosted project and apply the same migrations to it.

## Setup

### 1. Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL editor, run the migrations in `supabase/migrations/` in numeric order, skipping 0004 for now — it needs values filled in first, see "Reminder emails" below.
3. Copy the Project URL, `anon` key, and `service_role` key from Project Settings → API.

### 2. Google Calendar OAuth

1. In [Google Cloud Console](https://console.cloud.google.com), create a project (or use an existing one) and enable the **Google Calendar API**.
2. Configure the OAuth consent screen (External, or Internal if using Google Workspace).
3. Create an OAuth Client ID (Web application). Add an authorized redirect URI: `{NEXT_PUBLIC_SITE_URL}/api/calendar/callback` (e.g. `http://localhost:3000/api/calendar/callback` for local dev, and your production URL once deployed).
4. Copy the client ID and secret.

### 3. Stripe (booking deposits)

1. Create an account at [dashboard.stripe.com](https://dashboard.stripe.com) (test mode is fine to start — the `sk_test_...` key works the same way, just against fake cards).
2. Copy the **Secret key** from [dashboard.stripe.com/apikeys](https://dashboard.stripe.com/apikeys).
3. Set up the webhook that confirms a deposit payment (`/api/stripe/webhook`):
   - **For local dev**: install the [Stripe CLI](https://stripe.com/docs/stripe-cli), run `stripe listen --forward-to localhost:3000/api/stripe/webhook`, and use the webhook signing secret it prints (`whsec_...`).
   - **For production**: in the Stripe Dashboard → Developers → Webhooks → Add endpoint, use `https://your-production-url/api/stripe/webhook`, select the **checkout.session.completed** event, and copy its signing secret.
4. Without this configured, booking a service with a nonzero deposit will fail at the Stripe checkout step — set `booking_settings.deposit_percent` to `0` in the Table Editor if you want to test booking before Stripe is set up.

### 4. Resend (booking confirmation + reminder emails)

1. Create an account at [resend.com](https://resend.com) and copy an API key from the dashboard.
2. Without a verified sending domain, Resend's shared `onboarding@resend.dev` address only delivers to the email you signed up to Resend with — fine for testing, but verify a domain (Resend → Domains) and set `EMAIL_FROM` to an address on it before real members need to receive mail.

### 5. Environment variables

Copy `.env.local.example` to `.env.local` and fill in the Supabase, Google, Stripe, and Resend values.

### 6. Run it

```bash
npm install
npm run dev
```

Visit `http://localhost:3000`, sign up, and you'll land on the members dashboard.

### 7. Reminder emails (optional, for appointment reminders)

The edge function in `supabase/functions/send-appointment-reminders` checks hourly and emails each member directly via Resend's API in two stages, each tracked independently so a last-minute booking doesn't get a stale "2 days away" email: one reminder once the appointment is within 48 hours, and another once it's within 14 hours (effectively "day of"). Booking confirmation emails don't need this setup — they're sent inline when a booking is confirmed, as long as `RESEND_API_KEY` is set in the app's own environment (step 5).

1. Deploy the function: `supabase functions deploy send-appointment-reminders`
2. Set its secrets: `supabase secrets set RESEND_API_KEY=... EMAIL_FROM='Nail Studio <you@yourdomain.com>' CRON_SECRET=...`
3. Edit `supabase/migrations/0004_reminder_schedule.sql`, replacing `<project-ref>` and `<CRON_SECRET>`, then run it in the SQL editor.

### 8. Expiring credit daily (optional, for the loyalty program)

`expire_credits()` (defined in `0011_reward_credits.sql`) sweeps confirmed credit lines past their `expires_at` to `expired`. It's a plain SQL function with no external dependency, so — unlike the reminder emails — it can be scheduled directly with `pg_cron`, no edge function needed:

```sql
select cron.schedule('expire-reward-credits-daily', '0 3 * * *', $$select public.expire_credits();$$);
```

Run that once in the SQL editor (requires the `pg_cron` extension, already enabled if you set up reminder emails above; otherwise run `create extension if not exists pg_cron with schema extensions;` first).

### 9. Freeing abandoned booking slots (recommended once deposits are live)

When someone starts booking, the appointment is created immediately (holding the slot) before they've actually paid the deposit — otherwise two people could both try to book the same opening while one of them is mid-checkout. If they abandon the Stripe checkout page, that slot would stay held forever without this: `expire_stale_pending_appointments()` (also in `0012_deposits.sql`) cancels anything still unpaid after 30 minutes. Schedule it every 10–15 minutes:

```sql
select cron.schedule('expire-stale-pending-appointments', '*/10 * * * *', $$select public.expire_stale_pending_appointments();$$);
```

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
