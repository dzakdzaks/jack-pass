# PRD: Drive Vault Password Manager PWA

Date: 2026-06-14
Status: Draft (MVP implemented in codebase)
Last updated: 2026-06-14
Product type: Personal password manager web app
Platforms: Desktop browser, mobile browser, installable PWA
Design reference: [DESIGN.md](DESIGN.md)
Implementation reference: [README.md](README.md), [IMPLEMENTATION-PLAN.md](IMPLEMENTATION-PLAN.md)

### Implementation snapshot

The current codebase delivers the MVP scope in PRD §17 with these notable behaviors:

- **Local-only mode** — When `VITE_GOOGLE_CLIENT_ID` is unset, the app skips Google sign-in and stores the encrypted vault in IndexedDB under a `local` account namespace.
- **Per-account vaults** — When Drive sync is enabled, each Google account (`google:<sub>`) has its own encrypted vault and master password. Users switch accounts by signing out and signing in with another Google account.
- **OAuth scopes** — `drive.appdata` for vault sync plus `userinfo.email` to identify the signed-in Google account (no broad Drive access).
- **Hardening gaps** — CSP and unit tests are in place; privacy policy page, storage-leak E2E, and full accessibility QA remain open (see IMPLEMENTATION-PLAN M5).

## 1. Summary

Build a free, installable Progressive Web App that lets users store, search, manage, generate, reveal, and copy account credentials across desktop and mobile. The app stores all vault data in the user's Google Drive and encrypts the data before it ever leaves the device.

The product should feel similar to a lightweight 1Password experience, but optimized for zero recurring infrastructure cost. The app should be client-only, with no custom backend. Google Drive is used only as encrypted file storage and sync transport.

## 2. Problem

Users need a simple way to manage account passwords across devices without paying for a password manager subscription. They also need confidence that the app developer, hosting provider, and Google Drive cannot read their stored credentials.

Existing password managers are polished but often paid, bundled with native apps, or difficult for a small team to self-host securely. This product should provide the core day-to-day workflow in a modern web app while keeping costs and operational complexity near zero.

## 3. Goals

- Let users create a private encrypted vault protected by a master password.
- Store the encrypted vault in the user's Google Drive.
- Support desktop and mobile layouts from one responsive PWA codebase.
- Allow users to add, edit, delete, search, favorite, and copy credentials quickly.
- Keep all credential fields encrypted at rest and in transit to Drive.
- Require no paid infrastructure for MVP operation.
- Work offline for viewing and editing the locally cached encrypted vault, then sync when online.
- Use narrow Google Drive permissions and avoid full-drive access.
- Provide a clear forgot master password flow that supports recovery with a user-held recovery key or vault reset.

## 4. Non-Goals

- No shared vaults or team permissions in MVP.
- No browser extension in MVP.
- No native iOS or Android app in MVP.
- No server-side account system.
- No server-side master password recovery, admin reset, or developer backdoor.
- No storage of unencrypted passwords in Google Drive, app logs, analytics, or support tooling.
- No automatic autofill into websites in MVP.

## 5. Target Users

- Individual users who want a free password manager for personal accounts.
- Users who already have a Google account and are comfortable using Google Drive.
- Users who need access from both desktop and mobile without installing native apps.
- Developers or privacy-conscious users who prefer client-side encryption and transparent storage.

## 6. Key Product Principles

- Zero-knowledge by design: credentials are encrypted locally before upload.
- Free-first architecture: static hosting plus Google Drive API, no app-owned database or backend.
- Least privilege: use only the Google Drive app data scope, not broad Drive access.
- Recovery honesty: if both the master password and recovery key are lost, encrypted vault data cannot be decrypted.
- Mobile-first ergonomics: common actions must be one-handed and fast on phone screens.
- Security over convenience where tradeoffs matter.

## 7. Proposed Free Architecture

### Client App

- Toolchain: Bun for package management, dependency installation, and script execution. Do not use npm, yarn, or pnpm.
- Framework: React + TypeScript + Vite.
- PWA: `vite-plugin-pwa` with Workbox service worker.
- UI: Tailwind CSS or CSS Modules with a compact responsive component system.
- State: Zustand for local UI/vault state.
- Forms: React Hook Form + Zod validation.
- Storage:
  - Google Drive `appDataFolder` for cloud sync.
  - IndexedDB for local encrypted vault cache and sync queue.
  - No plaintext vault data persisted to localStorage, sessionStorage, cookies, or logs.

### Hosting

- Preferred MVP hosting: GitHub Pages, Cloudflare Pages free tier, or Vercel free tier.
- App must be served over HTTPS because Web Crypto, service workers, OAuth, and clipboard flows require secure browser contexts.
- No backend service required for MVP.

### Google Drive Integration

- Use Google Identity Services in the browser to request an OAuth access token.
- Request `https://www.googleapis.com/auth/drive.appdata` for vault sync.
- Request `https://www.googleapis.com/auth/userinfo.email` to identify the signed-in Google account (account namespace only; no broad Drive listing).
- Store one encrypted vault object in Drive's hidden `appDataFolder`, for example `vault.enc.json`.
- Use Drive file metadata, revision IDs, or app-level vector clocks to detect sync conflicts.
- Implement exponential backoff and quota error handling.
- **Local-only fallback:** When no OAuth client id is configured, the app operates without Google sign-in and keeps the encrypted vault in IndexedDB on the current device only.

### Cost Position

- Standard Google Drive API use is currently available at no additional cost within published limits, but Google documents that future quota overages may incur charges later in 2026. MVP usage should be tiny because it syncs one encrypted file per user.
- The encrypted vault consumes the user's Google Drive storage quota. Credential-only vaults should usually be small.
- No paid server, database, email service, object storage, or native app store account is required for MVP.

## 8. Security and Encryption Requirements

### Encryption Model

- All credential data must be encrypted locally before upload to Google Drive.
- Use authenticated encryption: AES-GCM with 256-bit keys.
- Use a new cryptographically random nonce/IV for every vault encryption.
- Use browser `crypto.getRandomValues()` for randomness.
- Use Web Crypto `crypto.subtle` for AES-GCM encryption/decryption where possible.
- Generate a random 256-bit vault data encryption key during vault creation.
- Encrypt the vault data with the vault data encryption key.
- Derive key-encryption keys from the user's master password using Argon2id via a vetted open-source WebAssembly package. If Argon2id is not feasible for an early prototype, PBKDF2-SHA-256 via Web Crypto is allowed temporarily, but Argon2id remains the production requirement.
- Store encrypted key envelopes that wrap the vault data encryption key, not the raw vault key.
- Store only encryption metadata in plaintext:
  - vault format version
  - KDF algorithm and parameters
  - salt
  - encryption algorithm
  - nonce/IV
  - encrypted key envelope metadata
  - schema version
  - created/updated timestamps
- Encrypt all user-sensitive content, including account titles, usernames, URLs, notes, tags, and passwords.

### Master Password

- The master password is never sent to Google, the hosting provider, or any backend.
- The derived encryption key must stay in memory only while the vault is unlocked.
- The app must auto-lock after inactivity.
- The app must lock when the browser tab is hidden for a configurable duration.
- The app must support changing the master password only after the vault is unlocked or recovered with the recovery key.
- The product must warn users during vault setup that losing both the master password and recovery key makes vault contents unrecoverable.

### Recovery Key and Forgot Master Password

- During vault setup, the app must generate a high-entropy recovery key locally.
- The recovery key must be shown once to the user and must not be stored in plaintext.
- The user must confirm they saved the recovery key before adding credentials.
- The recovery key must wrap the same vault data encryption key in a separate encrypted key envelope.
- The encrypted vault metadata should contain at least two key envelopes:
  - `masterPassword`: vault key encrypted by a key-encryption key derived from the master password
  - `recoveryKey`: vault key encrypted by a key-encryption key derived from the recovery key
- Forgot master password flow with recovery key:
  1. User selects "Forgot master password" on the unlock screen.
  2. App explains that Google sign-in alone cannot decrypt the vault.
  3. User enters their recovery key.
  4. App derives the recovery key-encryption key and decrypts the vault data key locally.
  5. User creates a new master password.
  6. App creates a new `masterPassword` key envelope for the existing vault data key.
  7. App re-encrypts and syncs updated vault metadata to Google Drive.
- Forgot master password flow without recovery key:
  1. User selects "Reset vault".
  2. App shows a destructive warning that existing credentials cannot be decrypted.
  3. App asks the user to type a confirmation phrase.
  4. App preserves the old encrypted vault as an archived encrypted file in `appDataFolder` when possible, for example `vault.archived.<timestamp>.enc.json`.
  5. App creates a new empty vault with a new master password and new recovery key.
- Resetting the vault must never attempt to decrypt, modify, or delete the old encrypted vault unless the user explicitly confirms deletion.

### Local Device Security

- IndexedDB may store only encrypted vault blobs and non-sensitive sync metadata.
- The unlocked vault may exist in memory while the app is open.
- The app must provide a manual lock action.
- The app must clear sensitive in-memory state on lock, sign-out, and reload.
- Clipboard copy must require a user action.
- The password reveal state should be temporary and reset when navigating away.

### Threat Model

In scope:

- Google Drive account stores only encrypted vault data.
- A passive attacker who downloads the Drive file cannot decrypt it without the master password.
- A hosting provider or static CDN cannot read stored vault data.
- Accidental Drive file exposure does not reveal credentials.

Out of scope for MVP:

- Compromised browser, operating system, keyboard, clipboard manager, or malware.
- Phishing sites impersonating the app domain.
- Malicious browser extensions reading page memory.
- A compromised app deployment serving malicious JavaScript.

Mitigations for deployment integrity:

- Use a custom domain and HTTPS.
- Publish source code and build reproducibly where possible.
- Add Content Security Policy with minimal script sources.
- Avoid third-party analytics and tracking scripts.
- Pin and audit dependencies.

## 9. Core User Journeys

### First-Time Setup

**With Google Drive sync configured:**

1. User opens the web app.
2. User signs in with Google.
3. App requests the Drive app data permission.
4. App checks for an existing encrypted vault file for that Google account.
5. If none exists, app asks user to create a master password.
6. App generates a recovery key and asks the user to save it.
7. App warns that the vault cannot be recovered if both the master password and recovery key are lost.
8. App creates an empty encrypted vault and uploads it to Drive.
9. User lands on the vault home screen.

**Local-only mode (no OAuth client configured):**

1. User opens the web app.
2. User chooses to create a vault (no Google sign-in).
3. App asks user to create a master password and acknowledge the recovery warning.
4. App generates a recovery key and asks the user to save it.
5. App creates an empty encrypted vault in IndexedDB under the `local` account namespace.
6. User lands on the vault home screen.

### Unlock Existing Vault

1. User opens app on desktop or mobile.
2. User signs in with Google if no valid Google token is available.
3. App downloads encrypted vault metadata/blob from Drive or loads local encrypted cache.
4. User enters master password.
5. App derives key and decrypts vault locally.
6. User sees account list.

### Forgot Master Password With Recovery Key

1. User selects "Forgot master password" on the unlock screen.
2. App explains that Google sign-in alone cannot unlock encrypted data.
3. User enters the recovery key saved during setup.
4. App unwraps the vault data key locally.
5. User creates a new master password.
6. App updates the encrypted master-password key envelope and syncs metadata to Drive.
7. User unlocks the existing vault with the new master password.

### Forgot Master Password Without Recovery Key

1. User selects "Forgot master password" on the unlock screen.
2. User chooses "Reset vault".
3. App explains that existing credentials will remain encrypted and inaccessible.
4. User confirms with a typed phrase.
5. App archives the old encrypted vault file when possible.
6. App creates a new empty encrypted vault with a new master password and recovery key.

### Add Credential

1. User taps add.
2. User enters title, username/email, password, URL, tags, and notes.
3. User may generate a password.
4. User saves.
5. App encrypts updated vault and writes to local encrypted cache.
6. App syncs encrypted vault to Drive.

### Copy Password

1. User searches or selects account.
2. User taps copy password.
3. App writes password to clipboard after explicit user action.
4. App shows brief confirmation.

### Offline Edit

1. User opens app while offline.
2. App unlocks from encrypted local cache.
3. User can view, add, edit, or delete entries.
4. App queues encrypted changes locally.
5. When online, app syncs changes to Drive.
6. If Drive has changed elsewhere, app presents conflict resolution.

## 10. Functional Requirements

### Vault

- Create a new encrypted vault.
- Unlock an existing encrypted vault.
- Lock the vault manually and automatically.
- Sync vault to Google Drive.
- Load latest vault from Google Drive.
- Cache encrypted vault locally for offline use.
- Detect corrupt, incompatible, or undecryptable vault files.
- Export encrypted backup file.
- Import encrypted backup file.
- Change master password after successful unlock.
- Recover access using a saved recovery key.
- Reset vault when neither master password nor recovery key is available.
- Preserve old encrypted vault data during reset when possible.

### Forgot Master Password

- Unlock screen must include a "Forgot master password" action.
- Recovery path must require the recovery key and a new master password.
- Recovery must update only key envelope metadata unless vault schema migration is also required.
- Reset path must clearly state that existing credentials cannot be decrypted.
- Reset path must require explicit typed confirmation.
- Reset path must create a new empty encrypted vault with a new recovery key.
- Reset path should archive the previous encrypted vault in Drive `appDataFolder` so it can be restored later if the old master password or recovery key is found.
- The app must prevent reset when there are unsynced local changes unless the user explicitly chooses to discard them.

### Credential Items

Each credential item should support:

- Title
- Username/email
- Password
- Website URL
- Notes
- Tags
- Favorite flag
- Created timestamp
- Updated timestamp
- Password history, optional for post-MVP

User actions:

- Add item
- Edit item
- Delete item with confirmation
- Duplicate item
- Favorite/unfavorite
- Copy username
- Copy password
- Copy URL
- Open URL
- Reveal/hide password
- Generate password
- Search by decrypted local fields after unlock
- Filter by tag/favorite

### Password Generator

MVP options:

- Length selector
- Include uppercase
- Include lowercase
- Include numbers
- Include symbols
- Avoid ambiguous characters
- Generate passphrase option, post-MVP
- Show password strength estimate

### Sync

- App must treat Google Drive as the source of cloud truth and IndexedDB as local encrypted cache.
- Writes should be debounced to avoid excessive API calls.
- App must track local changes, remote revision, and last successful sync time.
- App must handle:
  - no vault exists
  - first upload
  - successful update
  - expired OAuth token
  - offline state
  - quota/rate-limit errors
  - remote file deleted
  - remote file changed since last sync

### Conflict Resolution

MVP conflict handling:

- If no local unsynced changes exist, pull latest remote vault.
- If local and remote both changed, preserve both by creating a conflict copy locally and ask user to choose:
  - Keep local version
  - Use Drive version
  - Review differences, post-MVP

## 11. PWA and Platform Requirements

- Installable on desktop and mobile where supported by the browser.
- Responsive layout for:
  - mobile: 360px and up
  - tablet: 768px and up
  - desktop: 1024px and up
- App shell should load offline after first successful visit.
- Vault unlock must work offline if encrypted cache exists.
- Sync status must be visible.
- Use service worker for app assets, not for caching plaintext credential data.
- Provide web app manifest with app name, icons, theme color, display mode, and shortcuts.
- Use accessible touch targets on mobile.
- Avoid hover-only interactions.

## 12. UX Requirements

### Primary Screens

- Welcome/sign-in screen
- Create vault screen
- Unlock vault screen
- Vault list screen
- Credential detail screen
- Add/edit credential screen
- Password generator modal/sheet
- Settings screen
- Sync/conflict screen

### Navigation

- Mobile: bottom navigation or compact top bar with search-first layout.
- Desktop: two-pane layout with list on left and selected item details on right.
- Search must be available from the main vault screen.
- Copy actions should be one tap/click from list and detail views where safe.

### Visual Tone

- Clean, trustworthy, utility-focused.
- Avoid a marketing landing page as the main experience.
- Prioritize fast scanning, clear status, and low visual noise.

## 13. Privacy Requirements

- No analytics in MVP.
- No third-party tracking scripts.
- No telemetry containing titles, URLs, usernames, notes, tags, or passwords.
- If error reporting is added later, it must redact vault data and be opt-in.
- Privacy policy must clearly state:
  - data is encrypted locally
  - encrypted vault is stored in the user's Google Drive when sync is enabled (or device-only in local-only mode)
  - master password is not recoverable
  - no backend stores user data

## 14. Accessibility Requirements

- Keyboard navigable on desktop.
- Screen reader labels for all icon buttons.
- Visible focus states.
- Color contrast should meet WCAG AA.
- Forms must have clear validation states.
- Copy/reveal actions must have text alternatives.
- Auto-lock warnings must be perceivable without relying only on color.

## 15. Performance Requirements

- Initial app shell should load quickly on mobile networks.
- Unlock should complete within an acceptable time after KDF tuning:
  - target: under 2 seconds on modern desktop
  - target: under 4 seconds on mid-range mobile
- Search should feel instant for at least 1,000 credentials after unlock.
- Sync should upload one compact encrypted blob for MVP.
- Large vault handling and chunked storage are post-MVP unless needed.

## 16. Technical Constraints

- Use Bun as the sole package manager and script runner (`bun install`, `bun run`, `bunx`). Commit a `bun.lock` lockfile; do not commit `package-lock.json`, `yarn.lock`, or `pnpm-lock.yaml`.
- Google OAuth access tokens are short-lived and should be requested again from a user gesture when needed.
- The app must use HTTPS in production.
- The OAuth client ID is public in a browser app; security must rely on OAuth redirect/origin restrictions, least-privilege scopes, and local encryption.
- Web Crypto is available only in secure contexts in supporting browsers.
- Clipboard copy behavior varies by browser and OS.
- Offline mode cannot sync until Google auth and network are available.

## 17. MVP Scope

Included:

- Responsive PWA shell.
- Google sign-in and Drive app data authorization (optional when `VITE_GOOGLE_CLIENT_ID` is unset; local-only encrypted vault in IndexedDB).
- Create/unlock encrypted vault.
- Generate and confirm recovery key during vault setup.
- Recover forgotten master password using recovery key.
- Reset vault when recovery is impossible.
- Add/edit/delete/search credentials.
- Copy username/password.
- Password generator.
- Local encrypted cache.
- Manual and automatic lock.
- Basic sync status.
- Basic conflict handling.
- Encrypted import/export backup.

Excluded from MVP:

- Browser extension.
- Autofill.
- Shared vaults.
- Organization/team accounts.
- File attachments.
- Passkeys storage.
- Native biometrics.
- Multi-user collaboration.
- Paid hosting or backend.

## 18. Post-MVP Opportunities

- Browser extension for autofill.
- WebAuthn/passkey-assisted unlock, while keeping master password recovery limitations clear.
- Biometric unlock where browser/platform support is available.
- Recovery key rotation and multiple recovery keys.
- Shared vaults using recipient public-key encryption.
- Attachment storage with encrypted blobs.
- Password health dashboard.
- Data breach checks using k-anonymity APIs.
- CSV import from 1Password, Bitwarden, Chrome, and Firefox.
- Rich conflict merge UI.
- Multiple vaults.

## 19. Success Metrics

MVP product metrics:

- User can create first vault in under 2 minutes.
- User can add first credential in under 30 seconds after unlock.
- User can find and copy a password in under 10 seconds.
- User can recover access with a valid recovery key in under 2 minutes.
- Sync failure rate under 1 percent during normal use.
- No plaintext credential persistence in browser storage.
- Lighthouse PWA checks pass for installability and offline app shell.

Security validation metrics:

- Drive file contains no plaintext credential data.
- Local IndexedDB contains no plaintext credential data.
- Static bundle contains no hardcoded secrets.
- App does not request broad Drive scopes (only `drive.appdata` and `userinfo.email`).
- Vault cannot be decrypted with an incorrect master password.
- Vault cannot be recovered with an incorrect recovery key.

## 20. Acceptance Criteria

- Given a new user, when they sign in with Google and create a master password, then the app creates an encrypted vault in Google Drive app data storage.
- Given a stored vault, when the user enters the correct master password, then the vault decrypts locally and displays credentials.
- Given an incorrect master password, when the user tries to unlock, then the app fails without revealing vault contents.
- Given a valid recovery key, when the user forgets their master password, then they can create a new master password without losing existing vault data.
- Given no valid master password or recovery key, when the user chooses reset vault, then the app preserves the old encrypted vault when possible and creates a new empty vault.
- Given a vault reset, when the user inspects the old archived vault file, then it remains encrypted and inaccessible without the old master password or recovery key.
- Given a credential item, when the user taps copy password, then the password is copied only after a user action.
- Given the app is offline after a prior successful sync, when the user unlocks, then the encrypted local cache can be decrypted and used.
- Given local changes while offline, when the app reconnects, then encrypted changes sync to Google Drive.
- Given a browser storage inspection, then no plaintext credentials are visible in localStorage, sessionStorage, IndexedDB, cache storage, or cookies.
- Given the Google OAuth consent screen, then the app requests only the Drive app data scope and user email scope (no broad Drive access).

## 21. Risks and Mitigations

| Risk                                             | Impact                                | Mitigation                                                                                             |
| ------------------------------------------------ | ------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| User forgets master password                     | Lockout or data loss                  | Generate recovery key at setup, support recovery-key reset, preserve old encrypted vault on full reset |
| User loses both master password and recovery key | Permanent data loss                   | Clear setup warning, typed reset confirmation, encrypted backup export                                 |
| Malicious deployed JavaScript                    | Total vault compromise at unlock time | Strong deployment controls, CSP, dependency audit, reproducible build, open source                     |
| Google API quota/pricing changes                 | Cost or sync disruption               | Low API usage, debounced sync, documented quota handling, avoid backend service account                |
| OAuth app verification friction                  | Delayed public launch                 | Use non-sensitive `drive.appdata` scope, prepare consent screen and privacy policy early               |
| Clipboard leakage                                | Password exposure                     | User-initiated copy only; document risk on shared devices                                               |
| Browser extension malware                        | Password exposure while unlocked      | Document out-of-scope risk, encourage trusted browser environment                                      |
| Sync conflict                                    | Data loss risk                        | Revision checks, conflict copy preservation, explicit resolution UI                                    |

## 22. Recommended Implementation Milestones

### Milestone 1: Foundation

- Scaffold React + TypeScript + Vite app with Bun (`bun create vite` or equivalent).
- Document local setup with Bun commands in the project README.
- Add responsive shell and routing.
- Add PWA manifest and service worker.
- Add Google OAuth client setup.
- Add Drive API wrapper for appDataFolder file create/read/update.

### Milestone 2: Crypto and Vault

- Implement vault schema.
- Implement KDF and AES-GCM encrypt/decrypt.
- Add create vault and unlock vault flows.
- Add recovery key generation and key envelope storage.
- Add forgot master password recovery flow.
- Add vault reset flow with archived encrypted vault preservation.
- Add local encrypted cache in IndexedDB.
- Add auto-lock and manual lock.

### Milestone 3: Credential Management

- Add list/detail/add/edit/delete flows.
- Add search and favorites.
- Add copy username/password actions.
- Add password generator.

### Milestone 4: Sync and Offline

- Add online/offline detection.
- Add debounced sync.
- Add revision tracking.
- Add conflict handling.
- Add import/export encrypted backup.

### Milestone 5: Hardening

- Add CSP.
- Add dependency audit.
- Add tests for crypto, vault schema, sync, and storage leakage.
- Add accessibility pass.
- Add mobile and desktop QA.
- Add privacy policy and user-facing recovery warning.

## 23. Open Questions

Resolved:

- First release posture: public, External OAuth user type, operated in Testing phase first, moving toward public verification.
- App name: JackPass. Development origin: `http://localhost:3000`. Production hosting deferred for now.
- Multiple Google accounts per browser profile: one encrypted vault per Google account namespace; user switches by signing out/in (no multi-account picker). Local-only vault is a separate `local` namespace.
- Encrypted backup export before first credential: optional, not required.
- MVP uses only the hidden `appDataFolder` for the encrypted vault file.

Still open:

- Is biometric unlock required for MVP, or acceptable as post-MVP? (Currently post-MVP per §18.)
- Final production domain and public OAuth verification timing.

## 24. Source Notes

- Google Drive app data folder is hidden, app-specific, and accessible only by the app that created the data: https://developers.google.com/workspace/drive/api/guides/appdata
- Google Drive `drive.appdata` is listed as a non-sensitive, narrowly scoped Drive API permission: https://developers.google.com/workspace/drive/api/guides/api-specific-auth
- Google Drive API standard use is documented as available at no additional cost within limits, with quota/billing changes noted for later 2026: https://developers.google.com/workspace/drive/api/guides/limits
- Google Identity Services token model supports browser OAuth access tokens for direct REST/CORS Google API calls: https://developers.google.com/identity/oauth2/web/guides/use-token-model
- Web Crypto API provides browser cryptographic primitives and requires secure contexts: https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API
- PWAs can run across platforms, be installable, and operate offline using web platform features: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps
