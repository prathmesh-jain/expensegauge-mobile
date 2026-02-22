# ExpenseGauge

ExpenseGauge is a cross-platform expense management app built with **Expo (React Native)** and **Expo Router**.

This folder contains the mobile frontend.

## Features

- **Authentication**
  - Email + password login/signup.
  - Google Sign-In integration.
- **Offline-first mutations**
  - User/admin write requests (`POST`/`PATCH`/`DELETE`) are queued when offline or on retryable errors.
  - The queue is processed automatically on app start and whenever connectivity is restored.
- **Token refresh**
  - Requests include a `Bearer` token.
  - On `401`, the app attempts `/user/refresh` and retries the failed request.
- **User flows**
  - Home: balance + recent transactions.
  - History/Insights: paginated history grouped by month + trend chart.
  - Profile: update name, reports, logout.
- **Admin flows**
  - Admin mode switch is supported (admin can toggle `admin`/`user` view mode).
  - Admin screens for managing users and user expenses.
- **Category prediction**
  - Naive Bayes classifier via `helper/categoryDetector.js` with a bundled `classifier_model.json`.
- **Theming**
  - Light/dark mode is persisted via Zustand.

## Tech stack

- **Framework**: Expo (`~54`) + React Native (`0.81.5`)
- **Routing**: Expo Router
- **State**: Zustand (persisted)
- **Styling**: NativeWind + TailwindCSS
- **Networking**: Axios (with interceptors)
- **Persistence**
  - Auth tokens: Expo Secure Store
  - Cached expenses/admin data + offline queue: AsyncStorage
- **Charts**: `react-native-chart-kit`

## Project structure (high level)

- `app/`
  - `_layout.tsx`: root stack + queue processing on startup/network changes
  - `(auth)/`: landing/login/signup + admin preview
  - `(tabs)/`: main tabs (home/history/profile)
  - `admin/`: admin stack screens
  - `expenseModal/`: add/edit expense modal UI
- `api/`
  - `api.ts`: axios client + auth/queue interceptors
  - `expenseApi.ts`: typed wrappers for expense/admin mutations (adds queue metadata)
  - `syncQueue.ts`: queue processor
- `store/`: Zustand stores (`authStore`, `expenseStore`, `adminStore`, `offlineQueue`, `themeStore`)
- `helper/categoryDetector.js`: category prediction helper

## Setup

### Prerequisites

- Node.js (LTS recommended)
- npm
- Expo CLI tooling (via `npx expo`)

### Install

```bash
npm install
```

### Environment

1. Copy the template:

```bash
cp .env.example .env
```

2. Fill in:

- `EXPO_PUBLIC_API_URL`
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`

Important notes:

- Values prefixed with `EXPO_PUBLIC_` are intended for client-side use and are embedded into the app bundle. They **should not be treated as secrets**.
- Do not put private keys or secrets in `.env` for a mobile app. Keep secrets on the backend.

### Run

```bash
npm run start
```

Optional:

```bash
npm run android
npm run ios
npm run web
```

## Configuration notes

- **API base URL**
  - The axios client reads `process.env.EXPO_PUBLIC_API_URL` (with a fallback) in `api/api.ts`.

- **Google Sign-In**
  - `GoogleSignin.configure({ webClientId: ... })` reads `process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` in `app/_layout.tsx`.

## Keeping `.env` out of Git

This repo ignores `.env` via `frontend/.gitignore`. If you already committed it before, untrack it once:

```bash
git rm --cached frontend/.env
git commit -m "chore(frontend): stop tracking .env"
```

## Building with EAS

This repo includes `eas.json` with these Android profiles:

- `development`: development client (APK)
- `preview`: testing build (APK)
- `production`: Play Store bundle (AAB)

Build examples:

```bash
npm i -g eas-cli
eas build -p android --profile preview
eas build -p android --profile production
```

---

Made by [prathmesh-jain](https://github.com/prathmesh-jain)
