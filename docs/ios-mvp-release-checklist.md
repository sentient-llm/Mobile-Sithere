# Sit-Here iOS MVP Release Checklist

## Backend

- Apply `supabase/migrations/20260508000100_marketplace_core.sql`.
- Deploy `supabase/functions/api-v1`.
- Set Edge Function secrets:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `STRIPE_SECRET_KEY`
  - APNs signing credentials for the notification sender when added
- Run RLS smoke tests with one owner account and one walker account:
  - owner can create pets and walk requests
  - walker can read assigned walk requests
  - unrelated users cannot read private pets, reports, payments, or conversations
  - public walker directory and vet list are readable as intended

## iOS

- Generate Xcode project from `ios/project.yml`.
- Set bundle ID, Apple Developer Team, app icon, signing, and capabilities.
- Confirm these capabilities:
  - Sign in with Apple
  - Push Notifications
  - Background Modes: location and remote notifications
  - Apple Pay after Stripe setup
- Replace placeholder merchant/privacy domains:
  - `merchant.com.sithere.app`
  - `https://sithere.app/privacy`
- Test on a physical iPhone:
  - location permission and live walk updates
  - push permission and APNs device token registration
  - photo picker/camera access
  - Apple Pay sheet
  - account deletion

## TestFlight

- Create the app record in App Store Connect.
- Upload internal build first.
- Add internal testers and verify install, login, owner flow, walker flow, and account deletion.
- Add external testing group only after the build is stable.
- Include review notes that describe the dog-walking service, test credentials, and how to exercise owner/walker roles.

## App Store

- Add privacy policy URL in App Store Connect and in the app.
- Complete App Privacy details for account data, location, payment info, photos, messages, diagnostics, and push tokens.
- Confirm no mock payment paths are exposed in production.
- Add screenshots for owner and walker flows.
- Submit with clear review notes for physical dog-walking services and Apple Pay/Stripe usage.

