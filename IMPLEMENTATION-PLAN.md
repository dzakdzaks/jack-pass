# Implementation Plan: Drive Vault Password Manager PWA

Date: 2026-06-14
Status: MVP implemented (M0–M4 complete; M5 partial)
Last updated: 2026-06-14
Sources: [PRD-password-manager-pwa.md](PRD-password-manager-pwa.md), [DESIGN.md](DESIGN.md)

## 1. Goal

Ship the MVP defined in PRD §17: an installable, client-only React + TypeScript PWA that creates and unlocks a zero-knowledge encrypted vault, stores it as a single encrypted file in the user's Google Drive `appDataFolder`, caches it encrypted in IndexedDB for offline use, and supports credential CRUD, search, generation, copy, recovery-key recovery, and vault reset. Success = all PRD §20 acceptance criteria and §19 security validation metrics pass.

## 2. Scope

In scope (MVP):

- Responsive PWA shell + install manifest + offline app shell.
- Google sign-in (Google Identity Services token model) + `drive.appdata` authorization.
- Crypto core: AES-GCM 256, Argon2id KDF, key envelopes (master password + recovery key).
- Create / unlock / lock vault; forgot-password recovery; vault reset with archive.
- Credential CRUD, search, favorites, tags, copy, reveal, password generator.
- IndexedDB encrypted cache + debounced Drive sync + basic conflict handling.
- Encrypted import/export backup.
- CSP, dependency pinning, crypto/storage tests, accessibility + responsive QA.

Out of scope (per PRD §4 / §17): browser extension, autofill, shared vaults, teams, native biometrics, server backend, passkeys storage, attachments, multi-account.

## 3. Tech Stack & Key Decisions

| Concern                  | Choice                                                                                                       | Rationale / PRD ref                                |
| ------------------------ | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| Package manager / runner | **Bun** (`bun install`, `bun run`, `bunx`); commit `bun.lock` only                                           | PRD §7, §16 (Bun mandated, npm/yarn/pnpm excluded) |
| Framework / build        | React + TypeScript + Vite                                                                                    | PRD §7                                             |
| PWA                      | `vite-plugin-pwa` + Workbox (app-shell precache only, never vault data)                                      | PRD §7, §11                                        |
| Styling                  | Tailwind CSS v4 (`@tailwindcss/vite`) with `@theme` tokens in `src/index.css` mapping DESIGN.md            | DESIGN.md token system; PRD §7 allows Tailwind     |
| Routing                  | `react-router-dom`                                                                                           | PRD screens §12                                    |
| State                    | Zustand (UI + in-memory unlocked vault); never persisted plaintext                                           | PRD §7, §8                                         |
| Forms / validation       | React Hook Form + Zod                                                                                        | PRD §7                                             |
| Crypto KDF               | Argon2id via `hash-wasm` (WASM); PBKDF2-SHA-256 via Web Crypto as temporary prototype fallback behind a flag | PRD §8                                             |
| Symmetric crypto         | Web Crypto `crypto.subtle` AES-GCM 256, random IV per encryption                                             | PRD §8                                             |
| Local storage            | IndexedDB via `idb`; encrypted blobs + non-sensitive sync metadata only                                      | PRD §7, §8                                         |
| Google Drive             | GIS token model + Drive REST v3 via `fetch` (no googleapis SDK)                                              | PRD §7, §16                                        |
| Testing                  | Vitest (unit) + Playwright (E2E/PWA/storage-leak checks)                                                     | PRD §22 M5                                         |
| Hosting                  | Static deploy (GitHub Pages / Cloudflare Pages / Vercel free tier), HTTPS required                           | PRD §7                                             |

Resolved decisions (from PRD §23, confirmed):

- D1: **App name = JackPass.** Used for OAuth consent screen, PWA manifest `name`/`short_name`, and document title.
- D2: **Dev origin = `http://localhost:3000`.** Vite dev server pinned to port 3000; this is the OAuth authorized JavaScript origin / redirect for development. No production hosting decision yet.
- D3: **OAuth posture = public, External user type in Testing first.** Configure the consent screen as External and operate in Testing with added test users initially, with public verification as the next step (not a private/internal-only app).
- D4: **One vault per Google account namespace for MVP.** Signing in with a different Google account loads a separate encrypted vault; local-only mode uses a `local` namespace. No multi-account picker UI.
- D5: **Encrypted backup export is optional** (prompt/offer only; not required before first credential).

Assumptions (defaults unless user objects):

- A1: Tailwind chosen over CSS Modules for speed of building the DESIGN.md token system.
- A2: `hash-wasm` is the vetted Argon2id WASM package; pinned and audited (PRD §8 leaves package open).

## 4. Proposed Repository Structure

```text
jack-pass/
├─ index.html
├─ package.json            # scripts run via Bun
├─ bun.lock
├─ vite.config.ts          # vite-plugin-pwa manifest, CSP, port 3000
├─ src/index.css           # Tailwind v4 @theme tokens (DESIGN.md)
├─ tsconfig.json
├─ public/
│  └─ icons/               # PWA icons (maskable + favicon)
├─ src/
│  ├─ main.tsx
│  ├─ app/                 # router, layout shells, gate screens
│  ├─ features/
│  │  ├─ auth/             # Google sign-in, token lifecycle, session cache
│  │  ├─ vault/            # unlock/lock/create/reset flows + store
│  │  ├─ credentials/      # list/detail/add/edit/delete, search, favorites
│  │  ├─ generator/        # password generator + strength
│  │  ├─ recovery/         # forgot-password (recovery key + reset)
│  │  ├─ sync/             # debounced sync, revision tracking, conflicts
│  │  └─ settings/         # auto-lock, import/export
│  ├─ crypto/              # kdf, aes-gcm, key envelopes, recovery key gen
│  ├─ storage/
│  │  ├─ drive/            # GIS token + Drive REST appDataFolder client
│  │  ├─ idb/              # encrypted cache + sync queue (per account)
│  │  └─ accountScope.ts   # vault namespaces (google:<sub> | local)
│  ├─ vault/               # vault schema, versioning, (de)serialization
│  ├─ ui/                  # DESIGN.md components (buttons, inputs, cards…)
│  └─ lib/                 # clipboard, encoding, errors, types
└─ tests/
   ├─ unit/                # vitest: vault, generator
   └─ e2e/                 # playwright: app shell smoke
```

## 5. Crypto Architecture (PRD §8)

Vault file `vault.enc.json` layout (plaintext metadata + encrypted body):

```jsonc
{
  "format": 1,
  "schema": 1,
  "kdf": {
    "alg": "argon2id",
    "memKiB": 65536,
    "iterations": 3,
    "parallelism": 1,
    "salt": "<b64>",
  },
  "envelopes": {
    "masterPassword": {
      "alg": "AES-GCM",
      "iv": "<b64>",
      "ct": "<b64 wrapped vaultKey>",
    },
    "recoveryKey": {
      "alg": "AES-GCM",
      "iv": "<b64>",
      "ct": "<b64 wrapped vaultKey>",
    },
  },
  "body": {
    "alg": "AES-GCM",
    "iv": "<b64>",
    "ct": "<b64 encrypted vault JSON>",
  },
  "createdAt": "<iso>",
  "updatedAt": "<iso>",
  "vectorClock": 1,
}
```

Key flow:

1. Generate random 256-bit `vaultKey` (`crypto.getRandomValues`).
2. Derive `KEK_master` = Argon2id(masterPassword, salt); derive `KEK_recovery` = Argon2id(recoveryKey, salt2).
3. Wrap `vaultKey` with each KEK via AES-GCM → two envelopes.
4. Encrypt vault body JSON with `vaultKey` (fresh IV).
5. Unlock = derive KEK from entered secret → AES-GCM unwrap `vaultKey` → decrypt body. Wrong secret → GCM auth tag fails → reject without leaking.

Modules: `src/crypto/kdf.ts`, `aesgcm.ts`, `envelopes.ts`, `recoveryKey.ts` (high-entropy, shown once, never stored). Master/derived keys live only in memory while unlocked; cleared on lock/sign-out/reload.

## 6. Vault Data Model

```ts
interface VaultData {
  version: 1;
  items: CredentialItem[];
}
interface CredentialItem {
  id: string; // uuid
  title: string;
  username: string;
  password: string;
  url: string;
  notes: string;
  tags: string[];
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
  // passwordHistory?: ... (post-MVP)
}
```

All fields encrypted inside `body` (PRD §8 — titles/usernames/URLs/notes/tags/passwords all sensitive). Search runs over decrypted in-memory items only.

## 7. Sync Architecture (PRD §10 Sync, §9 Conflict)

- Drive client: GIS requests short-lived access token on user gesture; Drive REST v3 `files` scoped to `appDataFolder`; create/get/update `vault.enc.json`; track Drive `headRevisionId`/`modifiedTime`.
- IndexedDB stores: `cache` (latest encrypted vault blob), `meta` (lastSyncedRevision, lastSyncTime, dirty flag), `archive` (reset-archived vaults).
- Write path: edit → encrypt → write IDB cache + set dirty → debounced upload to Drive.
- Read/merge path: on load/online, compare local `lastSyncedRevision` vs Drive revision.
  - No local dirty changes → pull remote.
  - Local dirty + remote unchanged → push.
  - Both changed → create local conflict copy, prompt user (Keep local / Use Drive); diff-merge is post-MVP.
- Error handling: expired token (re-request via gesture), offline (queue), quota/rate-limit (exponential backoff), remote deleted (treat as first upload), remote changed (conflict).

## 8. Implementation Milestones

Ordered to map onto PRD §22. Each milestone is independently testable.

### Milestone status (as built)

| Milestone | Status | Notes |
| --- | --- | --- |
| M0 — Project Foundation | Done | Vite + React + TS, Tailwind v4 `@theme`, PWA manifest in `vite.config.ts`, router, responsive layout |
| M1 — Auth + Drive Wrapper | Done | GIS token model, Drive REST client, optional local-only mode when `VITE_GOOGLE_CLIENT_ID` is unset |
| M2 — Crypto + Vault Lifecycle | Done | Argon2id + PBKDF2 fallback, create/unlock/lock/auto-lock, recovery + reset, per-account IDB cache |
| M3 — Credential Management | Done | CRUD, search, favorites, tags, copy/reveal, generator |
| M4 — Sync + Offline + Backup | Done | Debounced sync, conflict modal, encrypted import/export, vault delete |
| M5 — Hardening | Partial | CSP in `vite.config.ts`; unit tests for vault + generator; E2E app-shell smoke only; privacy policy and storage-leak E2E still open |

### M0 — Project Foundation

- `bun create vite` (react-ts), add deps via Bun, configure `vite-plugin-pwa`, Tailwind with DESIGN.md tokens, router, base layout shells (mobile bottom-nav / desktop two-pane per PRD §12).
- Pin Vite dev server to `server.port = 3000` (D2) and set document title + manifest `name`/`short_name` to **JackPass** (D1).
- Add PWA manifest (via `vite-plugin-pwa` in `vite.config.ts`), icons, theme color, service worker (app-shell precache only).
- README documenting Bun setup; verification scripts.
- Artifacts: `vite.config.ts`, `src/index.css`, `public/icons/`, `src/app/*`, `src/ui/*`.

### M1 — Auth + Drive Wrapper

- GIS sign-in, token lifecycle, `drive.appdata` consent. OAuth client configured External / Testing with `http://localhost:3000` as authorized origin (D2, D3); single account assumed (D4).
- Drive REST client: create/read/update/list `appDataFolder` files; revision metadata.
- Artifacts: `src/features/auth/*`, `src/storage/drive/*`.

### M2 — Crypto + Vault Lifecycle

- KDF (Argon2id + PBKDF2 fallback flag), AES-GCM, key envelopes, recovery key gen + confirm.
- Create vault, unlock vault, manual + auto lock (inactivity + tab-hidden), in-memory key clearing.
- Forgot-password recovery (recovery key → new master password → re-envelope) and vault reset (typed confirmation, archive old encrypted file).
- IndexedDB encrypted cache.
- Artifacts: `src/crypto/*`, `src/vault/*`, `src/features/vault/*`, `src/features/recovery/*`, `src/storage/idb/*`, `src/features/vault/useAppLifecycle.ts`.

### M3 — Credential Management

- List/detail/add/edit/delete, favorites, tags, search over decrypted items.
- Copy username/password/URL (user-gesture only), reveal/hide, open URL.
- Password generator (length, char classes, avoid-ambiguous) + strength estimate.
- Artifacts: `src/features/credentials/*`, `src/features/generator/*`, `src/lib/clipboard.ts`.

### M4 — Sync + Offline + Backup

- Online/offline detection, debounced sync, revision tracking, conflict handling, sync-status UI.
- Encrypted import/export backup.
- Artifacts: `src/features/sync/*`, `src/features/settings/*`.

### M5 — Hardening

- CSP (minimal script sources, no third-party analytics), dependency audit + pinning.
- Tests: crypto correctness, wrong-password/recovery rejection, vault schema, sync states, storage-leak (no plaintext in localStorage/sessionStorage/IDB/cache/cookies).
- Accessibility pass (keyboard nav, focus states, screen-reader labels, WCAG AA contrast), mobile + desktop QA, Lighthouse PWA pass.
- Privacy policy + recovery warning copy.

## 9. Verification (maps to PRD §19–§20)

- Unit: encrypt→decrypt round-trip; wrong master password / wrong recovery key both fail without revealing data; envelope re-wrap on password change preserves `vaultKey`; reset never decrypts old vault.
- E2E (Playwright): first-time setup creates Drive file; unlock with correct password shows items; offline unlock from cache; offline edits sync on reconnect; copy only after user action.
- Security checks: inspect Drive blob, IDB, and bundle for plaintext/secrets; confirm only `drive.appdata` scope requested; CSP present.
- Performance: unlock < 2s desktop / < 4s mobile after KDF tuning; search instant at 1,000 items.
- Lighthouse: installable + offline app shell pass.

## 10. Risks & Assumptions

- Argon2id WASM cost vs PRD performance targets → tune mem/iterations on target devices; keep PBKDF2 fallback flag (PRD §8 allows temporarily). (Risk: PRD §15 timing.)
- OAuth token short-lived + gesture requirement → request on explicit user action; queue sync when token absent (PRD §16).
- Conflict handling is minimal in MVP (keep-local/use-remote) → richer merge deferred (PRD §9).
- Deployment-integrity threats (malicious JS) → CSP, pinned deps, reproducible build; documented as partly out-of-scope (PRD §8 threat model).
- Assumptions A1–A4 in §3 stand unless the user decides otherwise.

## 11. Resolved Open Questions (from PRD §23)

1. OAuth posture → public, External user type, Testing phase first (D3).
2. Multiple Google accounts per browser profile → one vault per Google account namespace; user switches by signing out/in (no account picker). Local-only vault uses a separate `local` namespace.
3. Require encrypted backup export before first credential → no; optional (D5).
4. App name + domain → name **JackPass**; dev origin `http://localhost:3000`; production hosting deferred (D1, D2).

Remaining deferred (not MVP-blocking): production domain/hosting choice and public OAuth verification submission.
