# Mobile refresh: backend setup and acceptance checks

## Update an existing installation

1. Pull the latest `main` and run `npm ci` from the repository root.
2. If your Supabase project already has the initial schema, apply **only** `supabase/migrations/202610140002_mobile_integration.sql` once in the SQL editor, or run `supabase db push` against the linked project. It preserves existing app data.
3. For a brand-new project, apply both migrations in filename order.
4. In `apps/mobile/.env`, use your project's actual `EXPO_PUBLIC_SUPABASE_URL` and public anon/publishable key. Do not use a service-role key. Mobile and web must point to the same project.
5. From `apps/mobile`, run `npx expo start --clear`. Rebuild your native development client after adding the photo/file/font modules. Use an Expo SDK 57-compatible client.
6. Optional: set `EXPO_PUBLIC_WEB_URL` to your deployed web URL for share links. Without it, sharing sends the business name/caption.

No cloud project is created automatically by the app. A profile error is now shown with retry and a signed-in session is preserved; it is not silently converted into a logout. Missing tables/RPCs, permission failures and network errors show actionable feedback.

## Backend mappings

- Account edits persist to `profiles`, including the public avatar URL.
- Google `full_name`/`name` metadata maps to the profile display name for new signups.
- Profile repairs are limited to the JWT user; admin membership never comes from user metadata.
- Owner business edits write to `businesses`; catalog writes go to `products`; posts go to `posts`.
- Profile grids use business-filtered post queries; stats use `business_stats` with caller visibility.
- Follow/like/save/comment/review actions use the same API as the web and database policies.
- Inbox queries embed the customer profile and owner profile instead of displaying identity UUIDs.
- Messages are private to the two participants, use compound cursors, subscribe to realtime and poll as a reconnect fallback. Read markers are written without invalidating unrelated feed/profile queries.
- Gallery photos are converted to JPEG, resized to at most 1600 pixels, read through Expo FileSystem and uploaded as ArrayBuffer. HEIC inputs do not get posted under an unsupported MIME type.
- Public post/logo/product/avatar images use `business-media`. Chat attachments use `chat-images` and short-lived signed URLs.

## Run the checks

```bash
npm run typecheck
npm test
npm run test:mobile
npm run build
npm run export -w @bp/mobile
cd apps/mobile
npx expo-doctor
```

Automated native tests use fixture-backed APIs. They exercise screen navigation and actions, but are not live Supabase or physical-device tests.

## Two-account acceptance run

1. Register an owner, create a business with a real map location, add a product, and publish a gallery photo with a caption.
2. Sign in as a different customer. Search for the shop/product, open its profile, follow it, like/save a post and add a comment/review.
3. Open a business conversation from the profile. Reply as the owner and verify that the inbox displays the customer's name.
4. Send gallery photos from each account. Confirm only participants can fetch signed image URLs and blocked users cannot continue messaging.
5. Edit profile/name/avatar, restart the app and confirm persistence. Check error/retry behavior with networking disabled.
6. Test keyboard behavior, Android back navigation, permissions denied, slow uploads and realtime reconnects on an actual device.

Video/reels processing, expiring stories and FCM delivery remain separate future features. This refresh does not show fake story circles or a nonfunctional reels tab.
