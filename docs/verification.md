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

See README's feature matrix and the phase plan. Stories/reels/video processing, FCM push delivery, views/profile visits, native catalog administration, richer maps, full cross-platform moderation and production operations remain planned. This repository is an MVP implementation, not a completed production launch of every requested capability.
