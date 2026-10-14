# Step-by-step MVP build plan

## Phase 1 — implemented foundation

1. Create a Turborepo with web/mobile apps and a shared TypeScript/Zod/Supabase API package.
2. Define identity, business, catalog, post, social, chat and moderation tables.
3. Add constraints, indexes, RLS, column grants, private media policies, and rate-limit triggers.
4. Build email/password auth, phone OTP and Google PKCE flows, role selection and profile editing.
5. Build business create/edit, logo upload, contact/hours/address/map coordinates.
6. Build photo/text/offer feeds, following/saved modes, likes/comments/follows and a web catalog editor.
7. Build typo-tolerant search, category/price/rating filters, radius search, distance and directions.
8. Build customer-to-business chat, uploads, signed media, subscription cleanup, unread counts and pagination.
9. Add in-app notifications, web reviews, business totals and admin report resolution/hiding.
10. Add validation/RLS regression tests, production web build and Android bundling checks.

## Phase 2 — configure and validate with a real project

1. Create Supabase staging and production projects; apply the migration and verify extension versions.
2. Supply public client env values, configure SMTP, SMS and Google OAuth; allow exact callback URLs.
3. Run real PostGIS tests and two-user cross-device auth/chat/storage tests.
4. Configure a restricted Maps Embed key; verify shop pins and denied-location fallback.
5. Run actual Android/iOS development builds; test deep links, keyboard, slow/offline networking, reconnects and foreground/background session renewal.
6. Test owner, customer, anonymous and admin access against direct REST calls.
7. Add restore/backup monitoring, crash reporting, quota alerts and a moderation runbook.
8. Validate accessibility with keyboard/screen readers and real-device small screens.

## Phase 3 — full social media features

1. Choose Mux or Cloudflare Stream; add signed direct uploads, webhook validation and processing status.
2. Add video/reel metadata and moderated playback; prefetch only the next item and pause offscreen video.
3. Add stories with `expires_at`, audience policies and scheduled media cleanup. Expiry must be enforced server-side.
4. Add FCM token registration and a durable outbox for messages/offers/activity; configure opt-outs and deep links.
5. Add cursor-based feed pagination, aggregate counts, scalable notification fanout and query-plan benchmarking.

## Phase 4 — complete cross-platform parity and operations

1. Native product CRUD, saved-feed navigation for owners, review editor and richer navigation routes.
2. Draggable map pin picker and native interactive map; geocoding and location accuracy UX.
3. Post edit/delete UI, unblock/report management, report subject preview and audited moderation reversals.
4. Analytics event ingestion with anti-spam deduplication, daily rollups, views/profile visits and conversion funnels.
5. Chat delivery/reconnect state, read receipts, attachment cleanup, compound timestamp/ID cursors and optional typing status.
6. Production load/security review, content upload scanning, account deletion/export, retention policies and privacy/legal pages.

## MVP acceptance criteria

A newly registered owner can create a business and publish a post. A separate customer can find it through search or nearby discovery, follow it, react, and open a conversation. Both apps see the same persisted data. A nonparticipant cannot read messages or private attachments, a customer cannot edit an owner's shop, and no client can self-assign admin access.

Release only after these journeys pass on configured staging. Provider-dependent paths are implemented where noted, but cannot be considered live-tested simply because compilation succeeds.
