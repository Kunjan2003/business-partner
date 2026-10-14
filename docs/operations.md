# Deployment and operations

## Supabase

Apply migrations to a new project, then configure auth providers. Realtime publication entries for messages/notifications and both storage buckets are created by the migration. Re-run migrations through the CLI history, not by pasting the same SQL repeatedly.

Use only the project URL and anon/publishable key in clients. Supabase enforces JWT authentication and RLS; the public key is not a server secret. A service-role key is never needed for these client features. Keep provider secrets in Supabase/CI secret stores.

Create trusted admins through a database console. Do not expose the admins table in a client settings form. User reports can be resolved here; account suspension is intentionally a trusted Supabase Auth admin action rather than a client-controlled role flag.

## Web hosting

Use a Node-compatible Next.js host, selecting the repository root as the install directory. Install with `npm ci`; build with `npm run build`; run `npm run start -w @bp/web`. Supply the two `NEXT_PUBLIC_SUPABASE_*` values at build time, plus the optional Maps Embed key. Restrict the map key to required API/domain origins. Add your deployed HTTPS auth callback to Supabase and Google configuration.

## Mobile builds

Run Expo's development build/EAS setup for your own account, then build Android and iOS. The app includes a unique URL scheme and package IDs; change these before publishing if they conflict with an app you already own. EAS credentials/signing, app store accounts and device distribution are not provisioned by this repo.

The `export` script only checks JavaScript/Hermes bundling. It does not create a signed APK/AAB/IPA or test permission prompts on a device.

## Launch hardening

- Run Supabase CLI database tests, then test RLS with multiple real users and media URLs.
- Add gateway/IP read throttling and abuse controls; database write limits alone do not stop storage/read/signup abuse.
- Schedule cleanup of `rate_limits` rows older than two days and abandoned uploads after a grace period.
- Review public-image deletion/moderation: hiding a post removes it from feeds but does not revoke an already-known public image URL. Delete/purge the stored object when legal/moderation policy requires it.
- Add a durable audit record for moderation decisions before a public community launch.
- Add database backups/PITR, uptime/error monitoring, query metrics and storage budget alerts.
- Verify notification permissions and consent before adding push. Never put message content into push payloads without an explicit privacy choice.
- Test account deletion, data export, retention and abuse reporting procedures.
- Add automated dependency update reviews and audit output triage. Avoid blind major upgrades of React Native modules; use `expo install --check`.

## Design decisions

One business per owner, one conversation per customer/business, INR prices, text working hours, and numeric map pins keep the first release manageable. Multi-branch ownership, multiple staff, structured hours, currencies, shipping and checkout require explicit schema/product changes.

Public businesses/posts are intentionally browsable anonymously. Blocking hides relationships/content for the signed-in blocked user and disables private chat; it cannot prevent someone from viewing public marketing content while signed out.
