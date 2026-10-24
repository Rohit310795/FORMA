# Apple Health (HealthKit)

FORMA reads Apple Health data **read-only** through HealthKit, using `@kingstinct/react-native-healthkit` (configured as an Expo config plugin in `apps/mobile/app.json`).

## What's read
Steps and active energy (today), resting heart rate (most recent), sleep analysis (last 14 nights), and workouts (last 14 days). Only these types are requested.

## Requirements
- A **development or production build** of the iOS app. HealthKit doesn't work in Expo Go, in a web browser or on Android. The app shows a clear “not available here” message in those cases.
- A **physical iPhone**. The simulator has limited Health data.
- Apple Developer account with the **HealthKit capability** enabled for your App ID. The config plugin adds the entitlement and the `NSHealthShareUsageDescription` text during `eas build`.

## Steps
1. Set your own `ios.bundleIdentifier` in `app.json`.
2. In the Apple Developer portal → Identifiers → your App ID, enable **HealthKit**.
3. `npx eas-cli@latest build --profile development --platform ios` and install it on the device.
4. In FORMA: More → Health Sync → Connect Apple Health → choose the categories → Sync now.

## Behaviour
- **Duplicates are prevented:** imported workouts use the HealthKit UUID (`externalId`) and a stable document id, and imported sleep uses one id per night. A night you logged manually is never overwritten.
- **Imported data is labelled** as device data (`source: healthkit`) and kept separate from self-reported entries.
- **Missing permissions:** HealthKit never tells apps whether read access was denied, so missing categories simply show as unavailable — never as zero.
- **Disconnect:** More → Health Sync → Disconnect, with an option to delete imported data. To fully revoke access, open the Health app → Profile → Apps → FORMA. The app explains this.
- FORMA doesn't infer any medical condition from wearable data.

## Testing status
The HealthKit code path typechecks and is isolated behind `lib/healthkit.ios.ts`. It **hasn't been run on a physical device yet**: that needs Apple hardware and a signed build.
