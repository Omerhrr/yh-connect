# YH Connect — Project Status

Last updated: 2026-08-11

This file exists so a fresh session (human or Claude) can get oriented quickly
without re-deriving context. Update it whenever a session wraps up meaningful
work, especially anything touching deployment.

## What this is

YH Connect is a Nigerian construction marketplace: clients post projects,
verified professionals (architects, engineers, contractors, trades) bid on
them, work happens through milestones, and payment is held in escrow via
Monnify until each milestone is approved. There's a full admin panel with
CMS-editable public pages, platform settings, dispute resolution, and
analytics.

**Stack**: Next.js App Router (`src/`) + FastAPI/SQLAlchemy 2.0/Alembic
backend (`backend/`), monorepo. Local dev uses SQLite; production
(Render) uses Postgres.

## Current state

Feature-complete for a demo/early-access launch. Client, talent (professional),
and admin sides are all built out: registration/auth (with email
verification, password reset, rate limiting), KYC (NIN-based, currently
**enforcement disabled** via `KYC_ENFORCEMENT_ENABLED=false` — the submit/
verify flow works, it just doesn't block actions yet), project posting and
bidding, milestones with escrow, disputes, messaging (WebSocket), reviews,
favorites, notifications, wallet/withdrawals, natural-language search, dark
mode across the whole app.

**Deployed** to Render as a checkpoint (see below) after a first live demo.
Local dev continues on the `main` branch; redeploy to Render only when
there's a new batch of work worth pushing live.

## Deployment (Render)

Blueprint spec lives at repo root: `render.yaml`. Three services:
`yh-connect-db` (Postgres, free), `yh-connect-api` (FastAPI, free),
`yh-connect-web` (Next.js, free). Live at:
- Frontend: https://yh-connect-web.onrender.com
- Backend: https://yh-connect-api.onrender.com

Migrations run automatically on backend startup (`run_migrations()` in
`app/main.py`), followed by category seeding. Free tier limitations worth
remembering: services spin down after inactivity (cold start ~30-60s on next
request), and local disk uploads are ephemeral (wiped on redeploy/restart —
fine for now, would need S3/similar before real usage).

### Getting a fresh Render deploy from a clean push

1. Push to GitHub, Render auto-deploys both services if a Blueprint is
   already connected (or use "New +" → "Blueprint" the first time).
2. Backend env vars are mostly defined in `render.yaml`. A few are
   intentionally `sync: false` (blank until set manually in the Render
   dashboard): `SMTP_HOST/USER/PASSWORD`, Monnify keys, `VERIFYME_API_KEY`,
   `SEED_SECRET`. The app degrades gracefully with these unset (emails log
   to console, payments/KYC simulate).
3. First deploy on a brand-new Postgres database needs an admin account and
   (for demos) sample data — see "Bootstrapping a fresh database" below.

### Bootstrapping a fresh database (no admin, no demo data)

A fresh Postgres database only gets the 12 categories auto-seeded on
startup — no admin account, no demo clients/professionals/projects. There's
no Render shell on the free plan, so there's a secret-gated HTTP endpoint
for this instead: `backend/app/api/v1/internal.py`.

1. In the Render dashboard, set `SEED_SECRET` on `yh-connect-api` to any
   random string, save (triggers a redeploy of that service).
2. Visit `https://yh-connect-api.onrender.com/api/v1/internal/seed?secret=YOUR_SECRET&demo=true`
   in a browser. Returns JSON: creates `admin@yhconnect.ng` / `AdminPass123!`
   (no-ops safely if it already exists) and, with `demo=true`, runs
   `app/seed_demo_users.py` (20 clients, ~48 professionals, ~50+ projects
   with bids/reviews — same generator used for local demos, output also
   written to `demo_credentials.csv` on the instance).
3. **Clear `SEED_SECRET` again afterward** to close the endpoint back up —
   it fails closed (404) whenever the env var is unset, but there's no
   reason to leave it open longer than needed.

The endpoint returns real error detail (type/message/traceback) as JSON in
the response body on failure, specifically because Render's log viewer was
unreliable for surfacing tracebacks during setup (see incident log below).
Don't "clean this up" to a bare 500 without a good reason — it's the fastest
diagnostic tool available on the free plan.

## Known footguns for anyone doing Postgres migration work

The whole migration history was written and tested against SQLite locally,
then ran against real Postgres for the first time during the first Render
deploy. Two real bugs surfaced purely because of dialect differences — worth
keeping in mind for any *future* migrations too:

1. **Enum columns added via bare `op.add_column()` don't auto-create the
   Postgres type.** Enums declared inline inside `op.create_table(...)` are
   fine (SQLAlchemy creates the type as part of that DDL). A standalone
   `op.add_column('table', sa.Column('x', sa.Enum(...), ...))` is NOT the
   same — it just assumes the type exists. On SQLite this is invisible
   (enums are just a CHECK constraint there). Fix pattern (see
   `migrations/versions/a852c24c973f_client_kyc_fields.py`): explicitly
   `postgresql.ENUM(...).create(op.get_bind(), checkfirst=True)` before the
   `add_column`, and the mirror `.drop(..., checkfirst=True)` in
   `downgrade()`.

2. **Enum→String `alter_column` needs an explicit cast.** Converting a
   Postgres enum column to plain text (done in
   `migrations/versions/d3e4f5a6b7c8_dispute_rebuild.py` for
   `milestones.status` / `notifications.type`) requires
   `postgresql_using='column::text'` on the `alter_column` call, or Postgres
   refuses with "column cannot be cast automatically." SQLite doesn't
   need this at all.

If a future migration touches an enum column in any way, sanity-check it
against these two patterns before assuming "it worked on SQLite" means
anything.

## Known footgun: passlib + bcrypt

`backend/requirements.txt` pins `bcrypt==4.0.1` on purpose, right under
`passlib[bcrypt]==1.7.4`. **Do not remove or loosen that pin.** `passlib`
hasn't been released since 2020 and is incompatible with `bcrypt>=4.1`
(which started raising `ValueError: password cannot be longer than 72
bytes` instead of silently truncating, which breaks passlib's internal
self-test the first time it touches bcrypt at all). This isn't cosmetic —
it breaks *every* password hash/verify call in the app, i.e. all login and
registration, everywhere. It only ever surfaced on Render because a fresh
`pip install` there resolved the newest bcrypt; local/dev environments had
an older one cached. If login mysteriously breaks again after a dependency
bump, check this pin first.

## Deploy incident log (2026-08-09 → 2026-08-11)

Chronological, so the reasoning trail is there if something similar happens
again:

1. Frontend `next build` failed type-checking — 21 unused shadcn/ui scaffold
   components (never imported anywhere) referenced packages that were never
   installed. Deleted them (`src/components/ui/`: aspect-ratio, calendar,
   carousel, chart, command, context-menu, drawer, form, hover-card,
   input-otp, menubar, navigation-menu, popover, radio-group, resizable,
   scroll-area, slider, sonner, switch, toggle-group, toggle).
2. Backend build failed — Render defaulted to Python 3.14, no prebuilt
   `pydantic-core` wheel, source build failed (read-only cargo cache).
   Pinned Python 3.11.9 via `backend/runtime.txt` + `PYTHON_VERSION` env var
   in `render.yaml`.
3. Backend booted then crashed on startup, repeatedly, with no visible
   traceback — turned out to be Python's stdout buffering in a container
   dropping output before the process died. Added `PYTHONUNBUFFERED=1` and
   wrapped `on_startup()` in `app/main.py` with explicit
   `traceback.print_exc()` + forced flush. This is what finally surfaced
   the real errors in points 4 and 6 below.
4. Real migration crash #1: `type "kycstatus" does not exist` — see
   "Known footguns" #1 above. Fixed in
   `a852c24c973f_client_kyc_fields.py`.
5. (A second migration, `d3e4f5a6b7c8_dispute_rebuild.py`, was pre-emptively
   fixed for the enum→string cast issue — footgun #2 above — before it was
   ever hit in practice, based on code review rather than a live crash.)
6. Frontend deployed and worked; homepage showed no professionals/projects
   (correctly — fresh prod DB, empty, not a bug) and admin login failed
   (correctly — no admin account existed in prod yet, only ever seeded
   locally). Built the `/api/v1/internal/seed` bootstrap endpoint (see
   above) to solve both without needing Render shell access.
7. First few calls to that endpoint returned a bare "Internal Server Error"
   with nothing useful in Render's log viewer despite many attempts to
   retrieve it (the log viewer appeared to just not be surfacing request-
   level tracebacks reliably). Rather than keep fighting the log viewer,
   changed the endpoint to catch everything and return the real error as
   JSON in the response body itself. That immediately surfaced the actual
   error on the next attempt: the passlib/bcrypt incompatibility above.
8. Pinned `bcrypt==4.0.1`, redeployed, endpoint worked, admin + demo data
   seeded successfully, first live demo completed on this Render
   deployment.

## Recent session: client-path UX pass (2026-08-16)

System-design pass over the client journey (frontend + backend). Built:
- Project workspace: edit + close open projects, direct-invite visibility,
  bidder profile links, wallet-balance/top-up hint on funding, fee note on
  release (src/components/site/pages/ProjectWorkspace.tsx, api.ts,
  backend/app/api/v1/projects.py, schemas/project.py).
- Notifications: client now gets one when a professional responds to an
  invite and when a milestone is submitted / updated (invites.py,
  milestones.py).
- Find Professionals: removed a client-side KYC hard-block that contradicted
  the disabled server-side enforcement, added pagination (previously capped
  at 20 results).
- My Projects: status filter tabs. Overview: wallet balance strip. Company
  settings: Industry field (backend already supported it).
- Messages nav badge (unread count) via new GET /messages/unread-count.
Details in docs/BUG_FIXES_2026-08-16.md (Client path section).

## Recent session: code audit + bug fixes + client/talent UX passes (2026-08-16)

A full code-level audit was run across the backend and frontend, and nine
classes of bugs were fixed (all backend-only, uncommitted in the working tree
alongside the message-replies/tiers work). Highlights: messaging was missing a
participant authorization check on send; a client could accept a second bid
and silently displace the hired professional; unvalidated `category_id` values
could poison rows and 500 the public listing endpoints; email verification
tokens are now hashed at rest like password-reset tokens.

Two system-designer passes then closed UX gaps on the client and talent
paths: edit/close project, invites visibility, bidder profile links, wallet
and fee transparency, unread-message badge, Find Professionals pagination
(client pass); proposal withdrawal + re-apply, shortlist notifications, Find
Work pagination, and an overview wallet/tier card (talent pass).

A third pass rebuilt the **admin panel** as the company command center: the
overview is now a live dashboard (attention items, recent activity, quick
actions, announcements), users gained verified-business/KYC/wallet visibility
plus suspend / adjust-wallet / add-admin tools, projects/payments/disputes
got real filtering and pagination, verifications now capture rejection
reasons, and the CMS gained blog editing, highlight reordering, and category
editing. New backend: wallet adjust + platform announcements endpoints, and a
migration widening `wallet_transactions.type` (already applied to the local
SQLite DB).

A fourth pass covered the **homepage / marketing site**: the orphaned
`/for-clients` and `/for-talents` routes (which rendered the entire homepage)
are now dedicated audience landing pages wired into the header/footer;
Recent Projects cards link to real project pages instead of the browse list;
the highlights band falls back to live stats when the CMS is unconfigured;
verified pros carry a badge on the homepage; and the homepage gained SEO
metadata.

A fifth pass reviewed the **client path as a product designer**: wizard-created
projects no longer show the broken "₦500,000 – ₦500,000" budget range
anywhere (new `formatBudgetRange` helper), milestone cards make the
approve-then-release flow explicit instead of showing both buttons at once,
the onboarding skills step uses tappable suggestion chips, new clients land
on their just-posted project, the overview's misleading "Committed Budget"
stat is now an honest "Total Budget", and find-professionals filters apply
live.

A sixth pass reviewed the **talent path as a product designer**: rejection
reasons from the admin review now reach the professional (verification and
address notes exposed and surfaced in Settings), earnings link back to their
projects, the apply dialog explains the escrow/milestone payment model, the
professional skills editor is chip-based like onboarding, registration now
actually validates the required location field, and active-job cards show the
client and read as navigable. Full write-up with per-fix reasoning, changed
files, and a manual verification checklist:
**`docs/BUG_FIXES_2026-08-16.md`**.

A seventh pass reviewed the **admin path as a product designer**: the user
record finally shows its wallet (balance, recent transactions, adjust action,
payments deep link), verification rejection reasons are visible to admins
with a tier badge, dispute resolution shows escrow context (is the linked
milestone actually funded?) and links both parties to their records, the
verifications reject flow uses a proper dialog instead of a native browser
prompt, disputes float active cases to the top, payments filters are honest
about what auto-applies and honor the `?user=` deep link, and analyticsgot refresh. Details in **`docs/BUG_FIXES_2026-08-16.md`** (Admin path section).

An eighth pass walked the full client-talent journey end to end and fixed the
**project-flow dead-ends**: hired professionals can now propose milestones
(badged "Proposed by ...", funding by the client is the approval gate, the
misleading "set up milestones" acceptance notification is fixed),a project no longer dead-ends when a milestone is refunded via dispute (completion fires once
all milestones are terminal: paid or refunded), clients got a guarded manual
"Start Final Review" action for everything else, and both parties are now
notified when a project completes with a nudge toward reviews. Details in
**`docs/BUG_FIXES_2026-08-16.md`** (Project-flow dead-ends pass section).

A ninth pass wired up the previously-dead **`review` project status** into a
real final-acceptance window: when all milestones are closed out (or the client
starts it manually), the project lands in `review`; the assigned professional
can leave a closing note (`closing-note` endpoint) or flag remaining issues;
the client then confirms completion (`confirm`, the sole path into
`completed`, which unlocks reviews) or reopens for more work (`reopen`). The
workspace gained a final-review panel for both roles and now refreshes its
project state in place after status-affecting actions. Details in
**`docs/BUG_FIXES_2026-08-16.md`** (Review-state pass section).

A tenth pass fixed **role switching**: the backend's seamless
`POST /auth/switch-role` existed but the site header never exposed it (it sent
you to the other role's login page instead), and cross-role login attempts were
rejected with no way forward, forcing a logout/re-login cycle. The header now
shows a one-click "Switch to X Mode" (or the inline talent-profile setup
dialog) in the opposite role's section, and both login pages now switch the
account seamlessly when you sign in on the other role's page. Details in
**`docs/BUG_FIXES_2026-08-16.md`** (Role-switch pass section).

An eleventh pass fixed **messaging inconsistency**: the project workspace's
inline chat was a primitive v1 (no replies, reactions, edit/delete, voice
notes, or typing) while the dedicated Messages app had all of it, so voice
notes in a project even rendered as a broken attachment link. The
full-featured conversation was extracted into one shared `ProjectChat`
component (in `src/components/site/chat/ProjectChat.tsx`) used by both the
Messages app and every project workspace, deleting the duplicated chat pane
and helpers from `DashboardPages.tsx` and the old `MessageThread` from the
workspace. The two surfaces now share a single implementation and can't drift
apart again. Details in **`docs/BUG_FIXES_2026-08-16.md`**
(Messaging-consistency pass section).

A twelfth pass added **chat cross-links** between the project workspace and the
full Messages app: the workspace chat now has an "Open in Messages" header
action that deep-links into the Messages app with the same project + person
preselected (so a conversation started on a project continues there without
losing context, even when it's still empty), and the Messages app links the
project title in the chat header back to the project workspace. Details in
**`docs/BUG_FIXES_2026-08-16.md`** (Messaging cross-links pass section). A follow-up added **unread badges** to the workspace: the "Open Chat" button on an in-progress project and each bidder's "Message" button on an open project carry a count of unread messages for that thread, polled from `/messages/threads` and cleared the moment the chat is opened. The same hook now drives badges on the dashboard lists too (My Projects, Recent Projects, and both Active Jobs surfaces) and on the dashboard nav itself (desktop sidebar, mobile slide-out drawer, and the mobile bottom tab bar), so the count is visible before entering a project. The bottom tab bar is now explicit per role (a `mobile` flag on nav items) rather than "first 4 items", which put Active Jobs and Messages into the talent's mobile tabs and Messages into the client's tabs, so both unread badges are always visible.

A later pass redesigned the dashboard's **Post a New Project** dialog as a guided 5-step wizard (describe the work in your own words with live category inference, confirm details, set a budget with a fixed/hourly toggle, pick skill chips, then review and accept the posting terms), ending on a success screen with Done / View Project. The category-inference logic was extracted to `src/lib/categoryInference.ts` and is now shared with the onboarding wizard. A follow-up added **draft persistence**: the wizard saves to localStorage as the client types and resumes exactly where they left off on reopen (with a "Start over" option), clearing the draft on successful post. The My Projects page shows a "Continue posting your draft" card whenever a draft exists, so resuming is one tap away.

A further pass redesigned the **talent dashboard overview**: an emerald hero with a state-driven next action (verify identity/address, add bank details, complete the profile, or find work) and a live profile-strength meter, meaningful stats (Active Jobs, Proposals Sent, Completed Jobs, Job Success Rate), a "Get hired faster" checklist card deep-linking into the profile/settings/earnings tabs, and a two-column layout with Active Jobs in the main column. The **client overview** got the same treatment: an action-driven hero (verify email/identity, fund the wallet, post a project, review proposals) with an account-readiness meter, a "Hire with confidence" checklist deep-linking into settings tabs, and a wallet + open-pipeline card row. Details in **`docs/BUG_FIXES_2026-08-16.md`** (Talent dashboard redesign pass section).

A later pass redesigned **verification and talent tiers**: the talent settings' Tier tab was folded into Verification as a three-card flow (Identity & Tier 2 with NIN + an ID document upload that falls back to admin review when the NIN check can't confirm, Proof of Address & Tier 3, and Credential Badges with review status). The admin verifications page became Tiers / Certs tabs with the claimed NIN shown on tier-2 entries. Tier is now genuinely invisible to clients (removed from public professional responses, bid responses, and every client-facing view) while the talent's own dashboard and settings show it; the previously-dropped `tier` field was wired into `ProfessionalOut` so the talent's own views no longer render "Tier undefined". Details in **`docs/BUG_FIXES_2026-08-16.md`** (Verification & talent-tier redesign pass section). A follow-up added the same tier-2 submission (NIN + DOB + ID document upload) as an optional step in the professional signup wizard, so professionals can get verified during onboarding, not just from Settings. Details in **`docs/BUG_FIXES_2026-08-16.md`** (Post-Project wizard pass section).

A later pass overhauled the **Messages app UI/UX**: the conversation list gained a search box and an All/Unread filter with per-thread timestamps and real unread-count badges; on mobile the list and chat no longer stack (the chat takes over with a back button in its header). Inside the chat: own messages show a "Read" receipt once read, message actions moved from click-the-bubble to an explicit hover-visible "⋯" button, the header gained an avatar, and reading history is no longer yanked to the bottom by incoming messages (a floating jump-to-latest button appears instead). Details in **`docs/BUG_FIXES_2026-08-16.md`** (Messages app UI/UX pass section).

A follow-up added **date-range filtering** to the talent's Earnings transaction history: five quick presets (This Month, Last 3 Months, Last 6 Months, This Year, All Time) plus custom from/to date inputs. The filtered range also updates the summary stats (Total Earned, Withdrawn, Payouts), and an empty-range state with a clear-filters CTA is shown when no transactions match. Details in **`docs/BUG_FIXES_2026-08-16.md`** (Deep audit pass section).

A comprehensive second pass addressed remaining gaps across admin, client, and cross-cutting concerns: the **admin analytics page** was redesigned with stat cards, visual bar charts, and a revenue breakdown with fee rate; the **admin users list** now shows professional tier (backend `AdminUserOut` schema gained `professional_tier` populated from `get_tier()`); the **admin disputes list** shows milestone amount, the other party, days open, message count, and a styled resolution card. **Client Payments** got the same date-range filter as talent Earnings (shared `DateRangeFilter` component); the **Invite to Project dialog** now shows the client's wallet balance and warns when the proposed amount exceeds it; the **Client Preferences tab** expanded from categories-only to include email notification toggles, always-on alert labels, and communication settings. **Post-project drafts** now sync across browser tabs via `BroadcastChannel`. **Role switching** no longer flashes the login page: `RoleSwitcher`, `ClientLoginPage`, and `TalentLoginPage` all use hard navigation (`window.location.href`) so the target layout's auth guard reads the freshly-persisted role from localStorage cleanly. Details in **`docs/BUG_FIXES_2026-08-16.md`** (Batch 2 section).

## Conventions worth knowing

- Local DB is SQLite (`backend/yhconnect.db`). If editing it directly while
  the dev server is running, **stop the server first** — a live
  `uvicorn --reload` connection can silently overwrite direct file edits on
  its next write. Prefer running things through the app/scripts instead of
  raw file edits.
- `backend/seed_admin.py` — creates a single admin account (used for local
  dev bootstrap; the Render equivalent is the `/internal/seed` endpoint).
- `backend/app/seed_demo_users.py` — the demo-data generator (clients,
  professionals, projects, bids, reviews). Destructive+idempotent: wipes
  and recreates data scoped strictly to `@pro.yhconnect.demo` /
  `@client.yhconnect.demo` emails only, never touches real accounts.
- Monnify (payments) and VerifyMe (NIN/KYC) are simulated until real API
  credentials are provided — both env-var-gated, degrade gracefully when
  unset.
- No em-dashes in UI copy (a standing content convention from earlier
  cleanup work) — keep using commas/periods/"and" instead.
