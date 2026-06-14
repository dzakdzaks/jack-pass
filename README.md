# JackPass

JackPass is a client-only, zero-knowledge password manager PWA. Credentials are encrypted on-device with AES-GCM before anything is cached locally or synced to Google Drive's hidden `appDataFolder`.

## Features

- **Encrypted vault** — Argon2id key derivation (PBKDF2-SHA-256 fallback), AES-GCM 256, dual key envelopes (master password + recovery key).
- **Credential management** — Add, edit, delete, duplicate, favorite, tag, search, reveal, and copy username/password/URL.
- **Password generator** — Length, character classes, ambiguous-character avoidance, strength estimate.
- **Recovery & reset** — Recover with a saved recovery key; reset vault with typed confirmation and archived encrypted backup.
- **Google Drive sync** — Optional. Debounced upload, revision tracking, offline cache, conflict resolution (keep local / use Drive).
- **Local-only mode** — Works without Google OAuth when `VITE_GOOGLE_CLIENT_ID` is unset; vault stays in IndexedDB on this device.
- **PWA** — Installable shell with app-shell precache (vault data is never cached by the service worker).
- **Settings** — Auto-lock, lock-on-tab-hidden, master password change, encrypted import/export, vault delete.

## Architecture

```
Browser (JackPass PWA)
  ├─ In-memory unlocked vault (cleared on lock / sign-out)
  ├─ IndexedDB — encrypted vault blobs + sync metadata (per account)
  └─ Google Drive appDataFolder — vault.enc.json (when signed in)
```

Vault namespaces are scoped per Google account (`google:<sub>`) or to a local profile (`local`) when Drive sync is disabled. Each namespace has its own master password and encrypted data.

## Tech stack

| Layer                     | Choice                                                         |
| ------------------------- | -------------------------------------------------------------- |
| Runtime / package manager | [Bun](https://bun.sh) 1.3+                                     |
| UI                        | React 19, TypeScript, Tailwind CSS v4 (`@tailwindcss/vite`)    |
| Build / PWA               | Vite 6, `vite-plugin-pwa` + Workbox                            |
| Routing                   | `react-router-dom`                                             |
| State                     | Zustand (vault in memory; settings in `localStorage`)          |
| Forms                     | React Hook Form + Zod                                          |
| Crypto                    | Web Crypto AES-GCM, Argon2id via `hash-wasm`                   |
| Local storage             | IndexedDB (`idb`)                                              |
| Google APIs               | Google Identity Services token model + Drive REST v3 (`fetch`) |
| Tests                     | Vitest (unit), Playwright (E2E)                                |

Design tokens follow [DESIGN.md](DESIGN.md) and are defined in `src/index.css`. Product requirements live in [PRD-password-manager-pwa.md](PRD-password-manager-pwa.md).

## Requirements

- Bun 1.3+
- A modern browser with Web Crypto and IndexedDB
- Optional for Drive sync: Google OAuth web client configured for `http://localhost:3000`

## Setup

```sh
bun install
cp .env.example .env.local
```

Set `VITE_GOOGLE_CLIENT_ID` in `.env.local` to enable Google Drive sync. Leave it blank to run in **local-only mode** (no Google sign-in screen).

### Google Cloud OAuth (Drive sync)

1. Enable **Google Drive API** in APIs & Services → Library (required; without this Drive calls return 403).
2. Create an OAuth client (Web application).
3. User type: External, publishing status: Testing.
4. Authorized JavaScript origin: `http://localhost:3000`
5. Scopes used by the app:
   - `https://www.googleapis.com/auth/drive.appdata`
   - `https://www.googleapis.com/auth/userinfo.email` (account identification only)
6. Add your Google account under OAuth consent screen → Test users.

## Development

```sh
bun run dev      # http://localhost:3000 (strict port for OAuth)
bun run preview  # production build preview on :3000
```

### App flow

| Phase          | Screen                     | When                                              |
| -------------- | -------------------------- | ------------------------------------------------- |
| Google sign-in | `GoogleSignInScreen`       | `VITE_GOOGLE_CLIENT_ID` set and no cached session |
| Onboarding     | `OnboardingScreen`         | No vault for the active account                   |
| Recovery key   | `RecoveryKeyScreen`        | Shown once after vault create / reset             |
| Unlock         | `UnlockScreen`             | Encrypted vault exists, locked                    |
| Main app       | Vault, Generator, Settings | Unlocked                                          |

### Routes (unlocked)

| Path                    | Screen                                 |
| ----------------------- | -------------------------------------- |
| `/`                     | Vault list (+ empty detail on desktop) |
| `/credentials/new`      | Add credential                         |
| `/credentials/:id`      | Credential detail                      |
| `/credentials/:id/edit` | Edit credential                        |
| `/generator`            | Password generator                     |
| `/settings`             | Preferences, backup, account           |

## Project structure

```text
jack-pass/
├─ public/icons/           # PWA icons
├─ src/
│  ├─ app/                 # Router, layout, gate screens (sign-in, unlock, onboarding)
│  ├─ crypto/              # KDF, AES-GCM, envelopes, recovery key
│  ├─ features/
│  │  ├─ auth/             # Google session + auth store
│  │  ├─ credentials/      # CRUD, search, vault page
│  │  ├─ generator/        # Password generator
│  │  ├─ recovery/         # Forgot-password / reset flows
│  │  ├─ settings/         # Preferences, import/export
│  │  ├─ sync/             # Drive sync, conflict UI
│  │  └─ vault/            # Vault lifecycle store
│  ├─ lib/                 # Types, clipboard, encoding, errors
│  ├─ storage/
│  │  ├─ drive/            # GIS + Drive REST client
│  │  ├─ idb/              # Encrypted cache + sync meta
│  │  └─ accountScope.ts   # Per-account vault namespaces
│  ├─ ui/                  # Shared components (Button, Input, Modal, …)
│  ├─ vault/               # Vault schema, encrypt/decrypt helpers
│  └─ index.css            # Tailwind v4 @theme tokens (DESIGN.md)
├─ tests/
│  ├─ unit/                # Vitest: crypto, vault, generator
│  └─ e2e/                 # Playwright: app shell smoke
├─ deploy/                 # nginx / Caddy examples for HTTPS VPS hosting
├─ security/               # CSP + production HTTP header definitions
├─ vite.config.ts          # PWA manifest, CSP, dev server port
├─ PRD-password-manager-pwa.md
├─ IMPLEMENTATION-PLAN.md
└─ DESIGN.md
```

## Verification

```sh
bun run typecheck
bun run lint
bun run test
bun run build
```

E2E smoke tests use the installed Google Chrome channel:

```sh
bun run test:e2e
```

If Chrome is not installed, either install Google Chrome or change `playwright.config.ts` to use downloaded Playwright browsers and run `bunx playwright install chromium`.

## Security notes

- Plaintext credentials must never be written to `localStorage`, `sessionStorage`, IndexedDB, Cache Storage, cookies, analytics, or logs.
- IndexedDB stores only encrypted vault files and non-sensitive sync metadata, keyed per account.
- The master password, derived keys, and decrypted vault data stay in memory only while unlocked.
- Settings (auto-lock intervals, KDF preference) are stored in `localStorage` — no vault data.
- Losing both the master password and recovery key makes the vault unrecoverable.
- CSP is defined in `security/csp.ts` and injected at build time via `vite.config.ts`; the service worker precaches app shell assets only.
- Production builds disable source maps and add `upgrade-insecure-requests` to CSP.
- Deploy behind HTTPS with the example configs in `deploy/nginx.conf.example` or `deploy/Caddyfile.example` (HSTS, COOP, CORP, Permissions-Policy, cache rules for `index.html` vs hashed assets).
- Add your production `https://` origin to Google OAuth authorized JavaScript origins before enabling Drive sync on the VPS.
- Run `bun run audit` periodically to check dependency vulnerabilities.

## Documentation

- [PRD-password-manager-pwa.md](PRD-password-manager-pwa.md) — product requirements and acceptance criteria
- [IMPLEMENTATION-PLAN.md](IMPLEMENTATION-PLAN.md) — architecture decisions and milestone status
- [DESIGN.md](DESIGN.md) — visual design system reference
