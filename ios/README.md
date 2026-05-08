# Sit-Here iOS

Native SwiftUI MVP source for the Sit-Here marketplace app.

## Generate The Xcode Project

This folder uses `project.yml` so the project can be generated repeatably with XcodeGen:

```bash
brew install xcodegen
cd ios
xcodegen generate
open SitHere.xcodeproj
```

Set these values in Xcode before archiving:

- `DEVELOPMENT_TEAM`
- Bundle ID if the App Store Connect app uses a different identifier than `com.sithere.app`
- `aps-environment` to `production` for App Store builds
- Apple Pay merchant identifier in `PaymentsService`

## Backend Configuration

The app points at:

```text
https://dyowjavinealuqewfrwa.supabase.co/functions/v1/api-v1/v1
```

The public anon key is embedded in `SitHereApp/App/AppEnvironment.swift`, matching the existing web app. Do not add service-role keys to the iOS app.

## Native MVP Surface

Implemented source scaffolding:

- Email/password auth with Keychain session storage
- Sign in with Apple button and entitlement placeholder
- Role-based owner and walker tab shells
- Owner pet creation, walker directory, and walk request creation
- Walker live walk session start, location tracking, location posting, and report submission
- Chat conversation/message API wiring
- Push device token registration
- Account deletion flow
- Privacy policy link placeholder

Still required on macOS before TestFlight:

- Generate/open the Xcode project
- Add real app icon assets
- Configure Sign in with Apple in Supabase and App Store Connect
- Configure APNs keys in Supabase or the notification worker
- Configure Stripe publishable key, Apple Pay merchant ID, and payment sheet UI
- Run simulator/device QA
- Archive and upload through Xcode or App Store Connect API

