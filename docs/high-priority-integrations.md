# Priority integrations (web + Expo)

This branch builds on `feature/verified-auth-onboarding`, not `main`.

## Push notifications and durable queue

- Apply `202610150002_platform_integrations.sql`. Requires the **pgmq** extension and a Supabase project with Queues support.
- The existing database triggers create in-app notifications; a new trigger queues their IDs when a recipient has registered a device.
- The Expo app requests notification permission on real iOS/Android hardware, registers a push token against the signed-in user, and unregisters that token on logout.
- Deploy `push-worker` Edge Function with JWT verification disabled (`supabase/config.toml`); this function **requires** `PUSH_WORKER_SECRET` as a Bearer token. Set a long random value with `supabase secrets set PUSH_WORKER_SECRET=...`.
- Trigger `POST https://PROJECT.supabase.co/functions/v1/push-worker` regularly (for example, each minute) from a trusted cron system. Set header `Authorization: Bearer PUSH_WORKER_SECRET`. The worker does **not** run automatically without a scheduler.
- Worker needs `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` supplied by Supabase. No service role key belongs in web or mobile env files.
- Configure FCM/APNs credentials in EAS; Expo remote push does **not** function in Expo Go on Android. Use development or production builds and a real device. Disable push by not setting an EAS project ID.
- Expo's push ticket is only preliminary acceptance; production operations should periodically check receipts and handle `DeviceNotRegistered` results. This worker handles ticket-level errors and retries at least once.

## Cloudflare Stream direct uploads

- Enable Cloudflare Stream and create an API token with **Stream Write** access.
- Supabase secrets: `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_STREAM_TOKEN`.
- Deploy `stream-upload` and `stream-status`. They validate an actual signed-in user and verify that they own the requested business before creating a one-time URL or returning status.
- Configure Supabase Edge Functions. Videos are uploaded **directly** to Cloudflare (up to 200 MB, max 90 seconds), never proxied through Next.js or Supabase Storage. Video posts are allowed while Cloudflare processes uploads.
- Stream's public playback URLs are used in web and mobile feeds. Content is public and may take time to become available; moderation and media deletion lifecycle should be added before broad launch.
- Test real device multipart uploads, HLS playback, expired upload URLs, rate limits, and Cloudflare processing errors.

## Error tracking

- Configure `NEXT_PUBLIC_SENTRY_DSN` on the web and `EXPO_PUBLIC_SENTRY_DSN` on Expo. No SDK events are sent if these are absent.
- For readable production stack traces, configure Sentry source-map uploads in your web deployment and in EAS via `@sentry/react-native/expo`, following Sentry's setup process. Do not commit Sentry auth tokens.
- Crash and unhandled error telemetry should be reviewed for personal information before enabling in production.

## Verification

Run `npm ci && npm run format:check && npm run typecheck && npm test && npm run test:mobile && npm run build && npm run export -w @bp/mobile`. Run `supabase start && supabase test db` locally. True end-to-end verification needs actual Supabase, EAS push credentials, Sentry DSNs and Cloudflare Stream credentials.
