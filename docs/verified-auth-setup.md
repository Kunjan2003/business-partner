# Verified email signup and onboarding

For both web and mobile: enter email and password → receive verification link → confirm email → choose name, username, account type, bio and optional profile photo → see protected feed.

**Important**: Supabase Auth creates a pending auth identity before confirmation. The database migration defers creation of the publicly visible `profiles` row until verified.

1. In hosted Supabase Dashboard → Authentication → Providers → Email, enable **Confirm email**; set up custom SMTP for reliable production delivery. The checked-in `config.toml` controls only local Supabase.
2. Apply `supabase/migrations/202610150001_verified_onboarding.sql` with `supabase db push` or your SQL migration pipeline. Back up a live database first.
3. Authentication → URL Configuration: set Site URL to your production web origin and allow `http://localhost:3000/auth/callback`, `https://YOUR-DOMAIN/auth/callback` and `businesspartner://auth/callback`.
4. Supabase confirmation email template must include its confirmation URL; email links will exchange the PKCE code in the app's callback. Mobile deep links need an installed Expo development or production build, not necessarily Expo Go. Verify email on the same device on which signup was initiated.
5. Supply public URL/anon key env vars for both apps. Never use service-role keys in client apps.
6. Test new signup, existing user login, expired confirmation, duplicate username, logout, session reload, and email link on a physical Android/iOS device.

Hosted Supabase Authentication settings and migration deployment are **required** before production signup works end-to-end.
