# 🕳️ Pothole Alert

A cross-platform mobile application for reporting and tracking potholes on roads. Built with React Native (Expo) and an Express backend.

## ✨ Features

- **Real-time Map** — View reported potholes on an interactive map
- **One-tap Reporting** — Report a pothole at your current GPS location instantly
- **Edit & Update** — Modify reported pothole locations with precision
- **Cross-platform** — Runs on iOS, Android, and Web
- **Location Services** — Automatic geolocation with permission handling
- **Haptic Feedback** — Tactile responses on supported devices
- **Settings Panel** — Configurable preferences via a slide-out drawer

## 🛠️ Tech Stack

| Layer       | Technology                          |
| ----------- | ----------------------------------- |
| Frontend    | React Native, Expo SDK 54, Expo Router |
| UI          | React Native Maps, Reanimated, Gesture Handler |
| State       | TanStack React Query, React Context |
| Backend     | Express.js, Node.js                 |
| Database    | PostgreSQL with Drizzle ORM         |
| Validation  | Zod                                 |
| Language    | TypeScript                          |

## 📋 Prerequisites

- **Node.js** ≥ 18
- **npm** ≥ 9
- **PostgreSQL** (for backend storage)
- **Expo CLI** (`npx expo` — no global install needed)
- **Expo Go** app on your phone (for device testing)

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/your-username/pothole-detection-app.git
cd pothole-detection-app
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

```bash
cp .env.example .env
# Edit .env with your database credentials
```

### 4. Push the database schema

```bash
npm run db:push
```

### 5. Start the development server

```bash
# Start the Expo app
npm start

# In a separate terminal, start the backend server
npm run server:dev
```

### 6. Open the app

- **Phone**: Scan the QR code with Expo Go
- **Web**: Press `w` in the terminal
- **iOS Sim**: Press `i` in the terminal
- **Android Emu**: Press `a` in the terminal

## 📜 Available Scripts

| Script            | Description                              |
| ----------------- | ---------------------------------------- |
| `npm start`       | Start Expo development server            |
| `npm run server:dev` | Start Express backend in dev mode     |
| `npm run server:build` | Build server for production          |
| `npm run server:prod` | Run production server                |
| `npm run db:push` | Push Drizzle schema to PostgreSQL        |
| `npm run lint`    | Run ESLint checks                        |
| `npm run lint:fix`| Auto-fix ESLint issues                   |

## 📁 Project Structure

```
pothole-detection-app/
├── app/                    # Expo Router screens
│   ├── _layout.tsx         # Root layout with providers
│   ├── index.tsx           # Home screen (map view)
│   ├── +not-found.tsx      # 404 screen
│   └── +native-intent.tsx  # Deep linking config
├── components/             # Reusable UI components
│   ├── AppHeader.tsx       # Top navigation bar
│   ├── DrawerMenu.tsx      # Side navigation drawer
│   ├── FloatingActionButton.tsx
│   ├── MapViewWrapper.*.tsx # Platform-specific map
│   ├── SettingsView.tsx    # Settings panel
│   ├── UpdateModal.tsx     # Pothole edit modal
│   ├── ErrorBoundary.tsx   # Error boundary wrapper
│   └── ErrorFallback.tsx   # Error fallback UI
├── constants/              # App-wide constants
│   └── colors.ts           # Color palette
├── contexts/               # React contexts
│   └── PotholeContext.tsx   # Pothole state management
├── lib/                    # Utilities & clients
│   ├── query-client.ts     # TanStack Query config
│   └── storage.ts          # Local storage helpers
├── server/                 # Express backend
│   ├── index.ts            # Server entry point
│   ├── routes.ts           # API route definitions
│   ├── storage.ts          # Data access layer
│   └── templates/          # HTML templates
├── shared/                 # Shared between client & server
│   └── schema.ts           # Drizzle DB schema + Zod types
├── assets/                 # Static assets (icons, splash)
├── patches/                # patch-package patches
├── scripts/                # Build & utility scripts
├── .env.example            # Environment variable template
├── app.json                # Expo configuration
├── drizzle.config.ts       # Drizzle ORM configuration
├── package.json            # Dependencies & scripts
└── tsconfig.json           # TypeScript configuration
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
