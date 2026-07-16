# ExpenseGauge Frontend

ExpenseGauge is a cross-platform expense management application built with **Expo**, **React Native**, and **Expo Router**.

This repository contains the mobile application that communicates with the ExpenseGauge backend. It supports authentication, offline-first expense tracking, multi-account management, analytics, admin workflows, server-generated PDF reports, and backend-driven app updates.

---

# Table of Contents

- Overview
- Architecture
- Features
- Tech Stack
- Project Structure
- Getting Started
- Environment Variables
- Configuration
- Engineering Highlights
- Scripts

---

# Overview

The application is designed around reliability for day-to-day usage rather than only online scenarios.

Core functionality includes:

- Email/password authentication and Google Sign-In
- Offline-first expense management
- Multi-account bookkeeping
- Monthly analytics and insights
- Admin-managed users
- Server-generated PDF reports
- Light/Dark theme support
- Backend-controlled update prompts

---

# Architecture

```text
Expo App
    │
    ▼
 Expo Router
 ├── Screens
 ├── Zustand Stores
 ├── API Layer
 ├── Offline Queue
 └── Helpers
    │
    ▼
ExpenseGauge Backend
```

The project keeps responsibilities separated:

- **app/** contains screens and navigation.
- **api/** handles networking, authentication and synchronization.
- **store/** contains persisted Zustand stores.
- **helper/** contains reusable business logic.
- **components/** contains shared UI.

---

# Features

## Authentication

- Email & password authentication
- Google Sign-In
- Secure token storage with Expo Secure Store
- Automatic access token refresh
- Password recovery using OTP

## Offline-first Synchronization

Instead of failing when connectivity is lost, write operations are queued locally.

The queue:

- survives app restarts
- retries automatically when network returns
- uses exponential backoff with jitter
- retries transient failures (5xx, 408, 429)
- attaches a `clientId` so duplicate requests are ignored by the backend

This allows users to continue tracking expenses without worrying about network availability.

## Token Refresh

Axios interceptors automatically attach access tokens.

If an access token expires:

- only one refresh request is sent
- pending requests wait for the refresh
- original requests are retried automatically
- logout only happens after an actual refresh failure

## Expense Tracking

- Add, edit and delete expenses
- Multi-account bookkeeping
- Running balances
- Bulk expense entry
- Recent activity
- Balance history

## Analytics

- Monthly summaries
- Spending trends
- Category breakdown
- Account insights

## Admin Mode

Admins can:

- Create managed users
- View user expenses
- Assign balances
- Edit assigned transactions

## Smart Category Prediction

A bundled Naive Bayes classifier predicts expense categories locally. When confidence is too low, the app falls back to **Other** instead of making unreliable predictions.

## Update Management

The app periodically checks the backend for available updates and supports:

- OTA updates
- APK updates
- Play Store updates
- Optional and forced update flows

## User Experience

- Light & Dark themes
- Smooth animations
- Haptic feedback
- Toast notifications

---

# Tech Stack

| Area | Technology |
|------|------------|
| Framework | Expo + React Native |
| Routing | Expo Router |
| Language | TypeScript |
| State | Zustand |
| Styling | NativeWind + react-native-paper |
| Networking | Axios |
| Persistence | Expo Secure Store + AsyncStorage |
| Charts | react-native-chart-kit |
| Updates | expo-updates |

---

# Project Structure

```text
frontend/
├── app/
├── api/
├── components/
├── helper/
├── store/
├── types/
├── assets/
├── classifier_model.json
└── global.css
```

Notable modules:

- **api/** – axios client, authentication, offline queue and synchronization
- **store/** – persisted Zustand stores for authentication, expenses, accounts, updates and theme
- **helper/** – category prediction and update service
- **app/** – Expo Router screens and navigation

---

# Getting Started

```bash
npm install

cp .env.example .env

npm start
```

Optional:

```bash
npm run android
npm run ios
npm run web
```

---

# Environment Variables

```env
EXPO_PUBLIC_API_URL=
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=
```

Only public values should be stored here. Private credentials remain on the backend.

---

# Configuration

The frontend automatically configures:

- API base URL from `EXPO_PUBLIC_API_URL`
- Google Sign-In using `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`
- `x-app-version` and `x-platform` headers on every request for update checking

---

# Engineering Highlights

## Offline-first request queue

Write requests are intercepted before reaching the network. When offline or when a retryable failure occurs, they are stored locally and synchronized automatically once connectivity returns.

## Safe synchronization

Queued requests carry a unique `clientId`, allowing the backend to safely ignore duplicates while still guaranteeing eventual synchronization.

## Single-flight authentication refresh

Only one refresh request is allowed at a time. Other requests subscribe to the result, avoiding multiple simultaneous refresh calls after token expiry.

## Clear separation of concerns

Networking, persistence, UI, business logic and state management live in separate modules, making features easier to extend and maintain.

## Local ML category prediction

Expense categories are predicted on-device using a bundled Naive Bayes model, keeping suggestions fast and available even without an internet connection.

## Consistent user experience

Theme persistence, animations, haptics, update prompts and typed API wrappers work together to provide a predictable experience across the application.

---

# Scripts

| Command | Description |
|---------|-------------|
| npm start | Start Expo development server |
| npm run android | Run Android build |
| npm run ios | Run iOS build |
| npm run web | Run Web version |

---

# Contributing

- Keep networking inside `api/`
- Keep application state inside `store/`
- Keep reusable logic inside `helper/`
- Keep screens inside `app/`
- Update frontend API wrappers whenever backend request or response contracts change.

---

Made by **Prathmesh Jain**
