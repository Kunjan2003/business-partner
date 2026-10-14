# Verification record

Executed during preparation on 14 October 2026:

| Check                        | Result    | What it proves                                                                                   |
| ---------------------------- | --------- | ------------------------------------------------------------------------------------------------ |
| Workspace TypeScript checks  | Passed    | Shared API, Next.js and Expo types compile                                                       |
| Next.js production build     | Passed    | Web routes compile and prerender                                                                 |
| Expo Android export          | Passed    | React Native app produces an Android Hermes bundle                                               |
| Unit + PostgreSQL WASM tests | 20 passed | Input validation, immutable product updates, upload validation, relational/RLS access boundaries |
| Formatter                    | Passed    | Source/config/docs formatting                                                                    |

Security cases include metadata-based admin escalation, customer edits to another business, ownership reassignment, moderation flags, nonparticipant message reads/inserts, forged senders, private attachment access, attachment sender checks, unread counts, notification tampering, moderation permissions, block enforcement and database write limits.

## Not yet executed

- Full Supabase stack and the real PostGIS pgTAP tests: Docker/PostgreSQL services were unavailable in the preparation environment. The CI database job is included but has not run remotely.
- A live Supabase project, provider credentials and mobile signing credentials were not supplied. Email confirmation, Google/SMS provider delivery, Storage CDN and Realtime have not been exercised end-to-end against a live project.
- Physical Android/iOS device runs, signed APK/AAB/IPA builds, browser visual QA and cross-device chat acceptance tests have not been performed.
- No cloud deployment, production load test, penetration test or store submission was performed.

PGlite tests stub Supabase's auth/storage metadata and omit PostGIS geometry/search. They exercise real PostgreSQL grants, RLS and triggers for the relational subsystem; they are not a substitute for the real Supabase acceptance run.

## Known product scope

See README's feature matrix and the phase plan. Stories/reels/video processing, FCM push delivery, views/profile visits, richer maps, full cross-platform moderation and production operations remain planned. This repository is an MVP implementation, not a completed production launch of every requested capability.

## Expo SDK 57 upgrade

Upgraded mobile to Expo 57.0.29, React Native 0.86.3 and the SDK's matching native modules. Both workspaces use React 19.2.3. The minimum documented Node version is 22.13. The legacy splash configuration was migrated to the `expo-splash-screen` plugin.

Upgrade validation: Expo Doctor 21/21 checks passed, workspace TypeScript passed, all 20 tests passed, and the web production build passed after clearing its stale generated cache. Android export passed with SDK 57. A signed native build and physical-device testing still require the owner's build credentials/device. Existing development clients must be rebuilt for the new SDK.

## Mobile UI and integration refresh

The mobile app was rebuilt into separate feed, explore, create, inbox, profile, catalog and account screens with shared native UI and navigation. Backend fixes include native JPEG/file uploads, safe missing-profile repair, Google display-name mapping, named inbox counterparts, singular RPC decoding, compound message cursors and mutation row confirmation.

Verified locally: 29 validation/API/database tests, 7 native UI/media tests, all workspace TypeScript checks, a web production build, Android export and Expo Doctor 21/21. Native tests use fixture-backed APIs. No live Supabase project or physical device was available, so live auth/storage/realtime and device acceptance testing are still outstanding. Existing backend projects must apply the new `202610140002_mobile_integration.sql` migration.
