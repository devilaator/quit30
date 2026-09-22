# QUIT30

Local-first smoking cessation app for Android built with React Native, Expo and TypeScript.

A DEVILAATOR project  
[https://devilaator.ee](https://devilaator.ee)

## Status

- Android
- Testing
- ET / EN / RU
- Version: **1.1.0** (`expo.version` in `app.json`)

## Features

- Onboarding with smoking profile, personal reasons and savings goal.
- Editable quit plan: past quit date/time or future preparation date/time.
- Live smoke-free duration, estimated savings and cigarettes avoided.
- Daily check-ins, recent-day confirmation and month-based history calendar.
- Lapse recording, restart history and long-term journey tracking.
- Five-minute craving countdown with practical support.
- Stage-aware support cards, 60 translated thoughts and recent-card avoidance.
- Body-recovery information and progress achievements.
- Local daily/motivational notifications and a five-second notification test.
- Settings for language, profile, goal and reminder preferences.
- Protected development-only reset.

## Tech

- Expo SDK 57, React Native 0.86.3, React 19.2.3.
- TypeScript 6.0.
- AsyncStorage 2.2 for local persistence.
- `expo-notifications`, `expo-dev-client`, `expo-status-bar`, `expo-insights`.
- `react-native-safe-area-context` and `react-native-svg`.
- npm lockfile and EAS Build configuration.

## Run

From the project directory with Node.js and npm installed:

```powershell
npm ci
npm start
```

Open on a connected Android device or emulator:

```powershell
npm run android
```

To explicitly use Expo Go:

```powershell
npx expo start --go
```

Android Expo Go keeps reminder settings but does not load or schedule notifications.
Use a development or release build to test notification delivery.

Local checks:

```powershell
npx tsc --noEmit
node --test scripts/check.cjs scripts/branding-check.cjs
npx expo install --check
```

## Build

Authenticate with an Expo account that has access to the existing EAS project:

```powershell
npx eas-cli login
npx eas-cli build --platform android --profile preview
```

The `preview` profile produces an internally distributed APK using remote signing
credentials. EAS CLI must satisfy the version constraint in `eas.json`.
Android version codes are managed remotely; preview and production enable
`autoIncrement`. App version comes from `app.json`.
Package ID: `com.muhkelino.quit30`.

## Data

Settings, progress, check-ins, lapses, craving state and support history are stored
locally with AsyncStorage. Existing settings are normalized when loaded.
There is no login or server-side progress sync.

## Security

Secrets and signing credentials are not stored in the repository. The preview
build uses EAS-managed remote credentials. Do not commit credentials or private keys.

## License

The repository includes an [MIT license](LICENSE) with the Expo copyright notice.
