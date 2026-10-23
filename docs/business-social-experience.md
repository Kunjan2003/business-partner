# Business Partner social experience

This branch adapts the supplied Instagram desktop references to Business Partner's business-focused data model.

- Dark desktop login, navigation, profile and settings layouts; responsive bottom navigation on the web.
- Profile identity, business post grid, saved-post grid, exact following count, business follower counts and post detail dialogs using the existing backend. Posts remain associated with businesses.
- Edit name, unique username, bio, website and profile photo on web and native mobile. Photo removal updates the profile without deleting shared storage objects.
- Email/password registration with email verification before onboarding; email-link sign-in, Google OAuth, password recovery and password changes. Resend uses the original email flow. Native password recovery is gated on Supabase's PASSWORD_RECOVERY event.
- Existing business publishing, products, messages, reviews, moderation and ownership policies remain in place.

## Deployment

Apply `supabase/migrations/202610230001_profile_details.sql` after the existing migrations. It adds a constrained public website field and a column-scoped update grant. No service-role credentials belong in either client.

Keep Confirm email enabled in Supabase Auth. Allow each deployed web origin's `/auth/callback` (including the recovery query string) and `businesspartner://auth/callback` as redirect URLs. Enable Google and configure its OAuth credentials if Google sign-in is offered in the deployment. Configure production SMTP and verify delivery of signup, email-link and recovery messages. Expo Go/development-build callback support follows `mobile-setup.md`.

## Scope and verification

This is a business social experience, not complete Instagram feature parity. The existing backend follows businesses rather than personal accounts. Full Stories, Reels, archives, private accounts, Meta login and username/phone login are not added by this branch; login continues to use email or the configured Google provider. No decorative controls claim those unsupported features.

Automated validation covers profile input, unsafe links, duplicate usernames, authenticated update scope, website migration/grants, password recovery requests, existing database security rules, native editing, recovery gating and password confirmation. Production web build and Android export are also required.

Live SMTP delivery, OAuth credentials, production migration application and physical-device verification require the configured Supabase deployment. The local browser runtime could not reach the development server, so visual browser verification was unavailable in this environment.
