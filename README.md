# Business Partner

**Your neighborhood. A little closer.** A social commerce MVP for local businesses, with a Next.js web app, Expo mobile app, and one Supabase backend.

This is an implemented first release of **auth, business profiles, photo/text/offer posts, product discovery, and private chat**, with additional social and business features. It is not a claim that every phase of the full product is production-complete. No credentials are bundled and no cloud services have been provisioned.

## What works in this codebase

| Feature                                                              | Web                              | Expo mobile                                          |
| -------------------------------------------------------------------- | -------------------------------- | ---------------------------------------------------- |
| Email signup/login, role choice, logout, account editing             | Yes                              | Yes                                                  |
| Phone OTP / Google PKCE OAuth                                        | Implemented; configure providers | Implemented; configure providers + development build |
| Business profile, logo upload, address, hours, map coordinates       | Yes                              | Yes; use current location for pin                    |
| Discovery / following feed, photo/text/offer/product-highlight posts | Yes                              | Yes                                                  |
| Product catalog browsing                                             | Yes                              | Yes                                                  |
| Product create, edit, availability, deletion                         | Yes                              | Manage through web for now                           |
| Full-text + trigram search, category/price/rating/nearby filters     | Yes                              | Yes                                                  |
| Distance + Google Maps directions                                    | Yes                              | Yes                                                  |
| Embedded Google map                                                  | Optional browser API key         | Opens Google Maps                                    |
| Follow, like, comments, saved posts, share                           | Yes                              | Yes; owner saved-feed navigation planned             |
| Reviews                                                              | Read/write                       | Rating filter; review editor planned                 |
| Real-time chat, image messages, unread counts, older messages        | Yes                              | Yes                                                  |
| In-app activity notifications                                        | Yes                              | Account screen                                       |
| Business totals: posts, likes, followers, chat inquiries             | Yes                              | Web dashboard                                        |
| Report content, block owner, admin hide/resolve                      | Yes                              | Block owner; full moderation through web             |
| Reels, 24-hour stories, transcoded video                             | Planned                          | Planned                                              |
| FCM push, offers-to-followers delivery                               | Planned                          | Planned                                              |
| Views/profile-visit event analytics                                  | Planned                          | Planned                                              |

## Quick start

Requires Node 22+, npm, and either a hosted Supabase project or the Supabase CLI with Docker for local development.

```bash
npm ci
```

### 1. Start the shared backend

Local development:

```bash
npx supabase start
npx supabase db reset
npx supabase status
```

`db reset` deletes your **local** database and reapplies migrations. Do not use it against production. Local confirmation emails are available through the mail viewer printed by `supabase status`. Email confirmation is disabled only in the checked-in local config.

For a new hosted Supabase project, apply `supabase/migrations/202610140001_initial.sql` once in the SQL editor, or use `supabase link` followed by `supabase db push`. Do not paste server secrets into frontend environment files.

### 2. Run web

```bash
cp apps/web/.env.example apps/web/.env.local
# Set your Supabase URL and public anon/publishable key in the file.
npm run dev:web
```

Open `http://localhost:3000`. Without environment variables the app intentionally shows a setup screen instead of fabricated business data.

### 3. Run mobile

```bash
cp apps/mobile/.env.example apps/mobile/.env
# Set the SAME Supabase project URL and public key.
npm run dev:mobile
```

For a physical phone with a local backend, use your computer's reachable LAN IP instead of `127.0.0.1` and allow the Supabase ports through your local firewall. For a hosted project, use the HTTPS project URL.

Expo SDK 55 is paired with its bundled React Native/Expo module versions. The lockfile records the tested dependency graph. Email/password and core screens can be exercised with a compatible Expo client. Google sign-in needs a development/production build with the `businesspartner` URL scheme; Expo Go does not provide this production scheme.

### 4. Configure auth providers

In Supabase Authentication:

- Set the web site URL and allow `http://localhost:3000/auth/callback`, your deployed `https://your-domain/auth/callback`, and `businesspartner://auth/callback` as redirect URLs.
- Enable Google with your own OAuth client credentials. In Google Cloud, use the Supabase callback URL displayed in its dashboard.
- Configure an SMS provider and enable Phone Auth for OTP login.
- Enable email confirmation and configure production SMTP before launch.
- Google/phone users start as customers. They can choose Business owner in their account after sign-in. This role never grants administration.

### 5. Try the core journey

1. Register one **business owner**, save a shop with real coordinates, and upload a logo.
2. Add a product through the web dashboard and publish a photo/offer post from either app.
3. Sign in as a separate customer on the other app.
4. Search by business/product name, follow the business, and like/comment/save a post.
5. Start a chat from the business profile. Reply as the owner. Send a photo and check unread counts.
6. Block the other participant and verify that messaging is denied.

Create an administrator only through a trusted database console:

```sql
insert into public.admins(user_id) values ('AUTH_USER_UUID');
```

Never derive admin access from email addresses or editable user metadata.

## Commands

```bash
npm run typecheck          # all three workspaces
npm test                   # validation + PostgreSQL WASM relational/RLS tests
npm run build              # web production build
npm run export -w @bp/mobile # Android JS/Hermes bundle (not an APK)
npx supabase test db        # real PostGIS/migration tests, requires local Supabase
npm run format:check
```

The RLS tests run the migration's relational policies in PGlite with Supabase auth/storage stubs. They explicitly exclude PostGIS and the search RPC; those are tested by `supabase/tests/search.test.sql` against a real Supabase stack in CI. A successful Android export is not a device UI test. See [verification](docs/verification.md) for what was actually executed.

## Project layout

```text
Business-Partner/
  apps/
    web/                    Next.js App Router + Tailwind
      app/                  root, setup, OAuth callback, global styling
      components/           application screens, session/query provider
    mobile/                 Expo + React Native + TypeScript
  packages/core/src/
    schema.ts               Zod input validation and shared helpers
    types.ts                shared response/input models
    client.ts               one API layer for both clients
  supabase/
    migrations/             schema, RLS, indexes, search, rate limits, storage
    tests/                  real database/PostGIS tests
  tests/                    validation, API regressions, relational/RLS tests
  docs/                     architecture, API, MVP plan, operations, verification
  .github/workflows/ci.yml   builds, tests, database checks
```

## Documentation

- [Architecture and database schema](docs/architecture.md)
- [API/endpoints](docs/api.md)
- [MVP build plan](docs/mvp-plan.md)
- [Deployment and operations](docs/operations.md)
- [Verification and remaining work](docs/verification.md)

This platform enables discovery and conversation; checkout, inventory reservations, payments, delivery and tax invoicing are not included in this release.
