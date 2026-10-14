# Shared API / endpoint list

Base URL: your Supabase project URL. Both clients call `packages/core/src/client.ts`. Supabase generates REST endpoints from the schema; there is no duplicate Express server to deploy.

Send the public `apikey` and, for protected operations, `Authorization: Bearer <user access token>`. Use the SDK to manage token refresh. Never use a service-role key in a browser/mobile app. Errors propagate to UI feedback; validation is shared and RLS is authoritative.

## Auth and account

| Shared method              | Endpoint                                | Behavior                                       |
| -------------------------- | --------------------------------------- | ---------------------------------------------- |
| signUp                     | POST /auth/v1/signup                    | Email/password + name and customer/owner role  |
| signIn                     | POST /auth/v1/token?grant_type=password | Email/password session                         |
| phoneOtp                   | POST /auth/v1/otp                       | Request SMS OTP; provider required             |
| verifyOtp                  | POST /auth/v1/verify                    | Verify SMS code                                |
| SDK signInWithOAuth        | GET /auth/v1/authorize?provider=google  | PKCE OAuth; web/mobile redirect flows          |
| SDK exchangeCodeForSession | POST /auth/v1/token?grant_type=pkce     | Exchange callback code                         |
| signOut                    | POST /auth/v1/logout                    | Revoke session                                 |
| profile, updateProfile     | GET/PATCH /rest/v1/profiles             | Caller profile; name/role only via API wrapper |

## Commerce and social

| Method                     | Endpoint                             | Permission / notes                                 |
| -------------------------- | ------------------------------------ | -------------------------------------------------- |
| business, myBusiness       | GET /rest/v1/businesses              | Visible businesses or caller’s shop                |
| saveBusiness               | POST/PATCH /rest/v1/businesses       | Owner; one shop per owner in MVP                   |
| products                   | GET /rest/v1/products                | Business catalog, 100 cap                          |
| saveProduct, deleteProduct | POST/PATCH/DELETE /rest/v1/products  | Business owner                                     |
| feed                       | GET /rest/v1/posts                   | 12/page; discovery/following/saved                 |
| createPost, deletePost     | POST/DELETE /rest/v1/posts           | Business owner                                     |
| search                     | POST /rest/v1/rpc/search_market      | Full-text, trigram, price/category/rating/location |
| toggle likes/follows/saves | POST/DELETE /rest/v1/{table}         | JWT user must match relation owner                 |
| following, saved           | GET /rest/v1/follows or /saves       | Relation state for caller                          |
| comments, comment          | GET/POST /rest/v1/comments           | Visible posts; authenticated writes                |
| reviews, review            | GET/POST /rest/v1/reviews            | One review/customer/business; upsert               |
| analytics                  | POST /rest/v1/rpc/business_analytics | Caller’s business totals                           |

`search_market` parameters: `q` (max 100 chars), `filter_category`, `price_min`, `price_max`, `rating_min` (0–5), `lat`, `lng`, `radius` (1–200 km), `page_offset` (0–10000). Returns `id`, `business_id`, `kind`, `name`, `description`, `category`, `image_url`, `price`, `rating`, `distance_km`. The API accepts camel-independent validation names and maps them explicitly to SQL parameters. Prices are INR in this MVP; businesses (no price) remain visible when product-price filters apply. Unreviewed shops have rating 0.

## Chat, notifications and media

| Method           | Endpoint                                             | Behavior                                          |
| ---------------- | ---------------------------------------------------- | ------------------------------------------------- |
| startChat        | POST /rest/v1/rpc/start_chat                         | target_business; idempotent per customer/business |
| chats            | GET /rest/v1/chats + POST /rest/v1/rpc/unread_counts | Participant-only inbox, unread counts             |
| messages         | GET /rest/v1/messages                                | Last 50 or older timestamp page                   |
| send             | POST /rest/v1/messages                               | body and/or image_path; sender bound to JWT       |
| markRead         | POST /rest/v1/rpc/mark_chat_read                     | Server timestamp; participant check               |
| subscribeChat    | /realtime/v1/websocket                               | INSERT messages; chat filter + RLS                |
| notifications    | GET /rest/v1/notifications                           | Recipient only, 100 cap                           |
| readNotification | PATCH /rest/v1/notifications                         | read_at only                                      |
| uploadImage      | POST /storage/v1/object/{bucket}/{path}              | JPEG/PNG/WebP, 6 MB; generated filename           |
| chatImage        | POST /storage/v1/object/sign/chat-images/{path}      | Participant-only five-minute URL                  |

Public image paths: `business-media/{userId}/{uuid}.{ext}`.
Private image paths: `chat-images/{chatId}/{userId}/{uuid}.{ext}`. A message may only attach an existing object under its own sender/chat path. Other participants may read it but cannot forge it as their own attachment.

## Trust and safety

| Method   | Endpoint                          | Behavior                                                |
| -------- | --------------------------------- | ------------------------------------------------------- |
| report   | POST /rest/v1/reports             | User, business, or post target; 5–1000-character reason |
| block    | POST /rest/v1/blocks              | Caller blocks another profile                           |
| isAdmin  | POST /rest/v1/rpc/is_admin        | Boolean for current user only                           |
| reports  | GET /rest/v1/reports              | RLS: reporter sees own, admins see all                  |
| moderate | POST /rest/v1/rpc/moderate_report | Admin resolves or hides post/business                   |

Notifications for new messages, follows, likes, and comments are inserted by trusted triggers, not clients. Offers-to-followers fanout is a later phase.

Rate limits are atomic per authenticated user/table/minute: messages 60, likes/saves/follows 120, other inserts 20; starting conversations 20/minute. Supabase Auth has separate provider/rate-limit configuration. These are MVP write safeguards, not a complete anti-abuse system: add gateway/IP limits, signup protections, storage quotas, update throttles, and lifecycle cleanup before a public launch.
