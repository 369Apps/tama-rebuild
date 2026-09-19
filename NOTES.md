# TAMA rebuild: site system notes

## Architecture

Static frontend in this repo (`369Apps/tama-rebuild`, preview at
https://369apps.github.io/tama-rebuild/) plus a Cloudflare Worker
backend (`tama-members`) with a D1 database (`tama_members_db`).
Backend source lives in `~/workspace/tama-members/` (`worker.js`,
`schema.sql`, `cf.py`). The frontend never holds secrets; the worker
URL is a single constant at the top of `assets/js/tickets.js`.

### Content editing

- Events: submitted through `submit-event.html`, approved through
  `approve.html` (both write to the worker/D1). The homepage renders
  live ticketed events from `GET /api/events` via
  `assets/js/tickets.js`. Built-in HTML stays as the fallback if the
  worker is unreachable.
- News and Clinic: read from a shared Google Sheet by
  `assets/js/content.js` (tabs `News` and `Clinic`, `const SHEET_ID`
  at the top of the file). Any failure leaves the built-in HTML.
- `admin.html` (unlisted) explains all of this to the team and links
  the event tools. `admin/event-template.csv` covers News and Clinic.

### Member system

- 1,003 members imported from the committee's Google Sheet into D1
  (`POST /api/import-members`). Active rule: Life = always active;
  Biennial with blank expiry = active; expiry on/after 2026-09-18 =
  active; earlier = inactive. Imported 1,001 (2 rows had bad emails),
  945 active, 56 inactive (verified locally 2026-09-19).
- Login is email + password (PBKDF2-SHA256, 100k iterations).
  Members set passwords through `set-password.html` links emailed by
  the worker. `POST /api/admin/blast-password-emails?limit=&offset=`
  sends set-password links in batches (max 100 per call).
- `login.html`, `account.html` (member card + logout). Nav shows
  "Member Login", swapping to "My Account" when logged in.

### Tickets and check-in

- `POST /api/tickets/checkout` creates a Stripe Checkout Session at
  the member or public price (member = logged in + active). Free
  events register immediately. Webhook
  `POST /api/stripe/webhook` marks orders complete and issues one
  ticket code per ticket (`TAMA-XXXXXX`) into the `tickets` table,
  then emails the buyer each code plus a QR image per code
  (code text is always the fallback).
- `ticket-success.html` confirms the order after Stripe returns.
- `checkin.html` (phone-first, team key in sessionStorage):
  type/scan a code, tap CHECK IN. Responses: green "Checked in",
  red "Not a valid ticket", amber "Already checked in at <time>".
- `GET /api/admin/attendees?event_id=` lists tickets with
  checked-in status for headcounts.

### Event approval workflow

1. Team submits at `submit-event.html` -> stored as `pending`.
2. Pending events are not public and cannot sell tickets.
3. `approve.html` (team key) lists pending events with full details.
4. Approve -> `live`, appears on the site with ticket sales on.
5. Reject -> `hidden`.
6. Exact wording: submission confirms "Submitted. The president will
   review it."; approval returns status live.

## Worker configuration

Vars/secrets on the `tama-members` worker (never in frontend code):
`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`,
`FROM_EMAIL` (e.g. noreply@tama.org after the committee verifies the
domain in Resend), `ADMIN_KEY`, `SITE_URL`
(https://369apps.github.io/tama-rebuild), `MEMBER_SHEET_URL`
(optional override for the member import feed), `APPROVER_EMAILS`
(reserved: upgrade path from the shared ADMIN_KEY to individual
approver logins later).

Payments and email stay inert with clear errors until their keys are
set. Checked locally: health reports stripe/email not configured;
checkout returns "Online payments are not set up yet."

## Pending one-time committee setup

News/Clinic sheet:
1. Create a Google Sheet with tabs named exactly News, Clinic.
2. Fill the tabs from `admin/event-template.csv`.
3. File > Share > Publish to web (entire document).
4. Send the sheet ID to the site maintainer, who pastes it into
   `const SHEET_ID` in `assets/js/content.js` and redeploys.
5. Share the sheet with the team members who may edit it.

Until step 4 is done, the site keeps showing its built-in content.

## Go-live checklist

- [ ] Repair/reconnect the Cloudflare credential (Worker + D1 access).
- [ ] Create D1 `tama_members_db`, apply `schema.sql`, create worker
      `tama-members`, set non-secret vars + generated `ADMIN_KEY`.
- [ ] Set `WORKER_URL` in `assets/js/tickets.js` to the real
      workers.dev URL, redeploy the static site.
- [ ] Import members, verify counts.
- [ ] Committee provides: TAMA Stripe secret key, Stripe webhook
      secret, verified Resend domain + API key, approved FROM_EMAIL,
      confirmed member discount per paid event, approver emails.
      (Financial/security: bring Mukharjee in for this step.)
- [ ] Test: health, login, checkout, webhook, event submit/approve,
      check-in, attendees.
- [ ] Send set-password emails in daily batches (limit/offset).
- [ ] Final publish = clean front-end swap of tama.org, not
      incremental edits on the existing host.
