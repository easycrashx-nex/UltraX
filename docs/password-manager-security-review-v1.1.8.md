# UltraX Password Manager Security Review v1.1.8

## Review status

This is a project security review of the v1.1.8 working tree. It is not an
independent audit, certification, penetration test, or guarantee of security.

- Review date: 2026-07-10
- Base revision: `8543eb36d0c986ab2179d9a4b10a37aef1c9950d`
- Scope: password-manager crypto, storage, lifecycle, IPC, renderer UI, website
  fill boundary, imports/backups, clipboard behavior, extension isolation, tabs,
  packaging, and release metadata.
- Threat model: `docs/password-manager-threat-model.md`
- Architecture: `docs/password-manager-architecture.md`

## Security invariants reviewed

- The master password and derived key are not persisted.
- A random 256-bit vault key encrypts the authenticated payload.
- Master and backup passwords use Node's maintained memory-hard scrypt API with
  random 16-byte salts and bounded parameters.
- Payloads and wrapped keys use AES-256-GCM with random 12-byte nonces, 16-byte
  authentication tags, and purpose/version AAD.
- Authentication completes before vault or backup plaintext is parsed.
- Wrong passwords, modified ciphertext, modified AAD, unsupported versions, and
  malformed inputs fail closed without a plaintext fallback.
- Atomic vault writes preserve an encrypted last-known-good `.bak` file.
- Only the main process retains the unlocked vault key; mutable key Buffers are
  zeroed on replacement and lock where practical.
- Renderer list/detail responses omit stored passwords. Copy and fill complete in
  the main process through narrow actions.
- Password-manager IPC validates the shell sender through the existing
  `WindowRecord` lookup. Remote `WebContentsView` pages have no preload.
- Extension and plugin dispatchers contain no password-manager methods.
- Fill revalidates the active window, active tab ID, exact normalized origin,
  HTTPS policy, matching saved origin, vault state, and top-level frame.
- Child frames and insecure HTTP pages are not fill targets.
- Clipboard clearing compares the current clipboard hash and does not overwrite
  content copied by the user afterward.
- Screen lock, suspend, app close, all-window close, timeout, and manual actions
  clear the in-memory key according to saved settings.
- Production shell DevTools are disabled.

## Automated checks

The final working tree passed:

```text
npm run typecheck             PASS
npm run lint                  NOT AVAILABLE - repository has no lint script
npm run test:unit             PASS - 8 tests
npm run test:e2e              PASS - 17 tests
npm audit --omit=dev          PASS - 0 vulnerabilities
npm audit                     PASS - 0 vulnerabilities
npm run dist:win              PASS
git diff --check              PASS
```

Password-manager tests cover AES-GCM round trip, unique nonce generation, wrong
passwords, ciphertext/AAD tampering, vault key wrapping, strict origin matching,
CSPRNG generation, CSV parsing, clipboard ownership, encrypted-at-rest CRUD,
restart/unlock, encrypted backup authentication, and backup tampering.

Electron E2E covers setup, encrypted CRUD, plaintext-at-rest absence, lock,
wrong-password state, unlock, local health analysis, and HTTP fill blocking. Tab
E2E covers readable widths, overflow activation, local wheel scroll, fixed pinned
tabs, New Tab visibility, active-tab visibility, All Tabs, overlap prevention,
and drag edge auto-scroll.

## Artifact and release checks

- `latest.yml` reports version 1.1.8 and the correct Setup asset.
- Generated SHA256 values were recomputed for Setup and Portable executables and
  matched `release/SHA256SUMS.txt`.
- The packaged ASAR contains none of the known unit/E2E/visual-review test secret
  strings.
- No `.ultraxvault`, `.ultraxvault.bak`, or `.ultraxvaultbackup` artifact exists
  in the repository.
- The packaged `win-unpacked/UltraX Browser.exe` remained running during the
  release smoke test.
- The Windows installer is not Authenticode signed. SmartScreen warnings and
  update supply-chain risk remain until code signing is configured.

## Findings and resolutions

### Critical

No confirmed Critical finding remained after review and tests.

### Important

1. **Automatic form capture could violate consent and frame boundaries.** It was
   not implemented. v1.1.8 provides manual save and explicit fill only. A future
   release requires a dedicated isolated content bridge, navigation generation
   binding, top-frame rules, and focused security review.
2. **Packaged shell DevTools could expose renderer-held setup/edit secrets.** The
   main-process DevTools action now rejects packaged builds.
3. **Clipboard timeout could erase newer user content.** Clearing now occurs only
   when a hash of the current clipboard matches the copied password; focused unit
   coverage verifies both owned and replaced clipboard states.

### Minor and accepted limitations

- JavaScript strings and garbage collection prevent guaranteed immediate memory
  erasure. Full decrypted documents are operation-scoped, but a privileged local
  attacker may recover process memory while the vault is unlocked.
- On Windows, Electron safeStorage uses DPAPI and does not protect against another
  process already running as the same user. Quick unlock is optional and is not
  presented as biometric authentication.
- A script executing at the exact saved origin can potentially observe a password
  after the user explicitly fills the page. This is an inherent page-interaction
  boundary, not an extension of vault access.
- UltraX v1.1.8 has no private/incognito mode and makes no private-mode claim.
- There is no plaintext export, cloud sync, recovery service, or silent browser
  profile import.
- The Codex Security plugin workspace was opened for a working-tree diff scan,
  but its interactive Start action had not completed at the time of this local
  review. Its result is not counted as a passing check.

## Manual security steps still required

1. Complete the interactive Codex Security diff scan and remediate validated
   findings before broad distribution.
2. Obtain Windows Authenticode/SmartScreen code signing and protect the signing
   key outside the repository.
3. Protect `main`, require passing CI, sign Git tags, and publish release
   provenance/checksums through the official GitHub workflow.
4. Commission an independent review before describing the password manager as
   audited or recommending it for high-risk credentials.
5. Review Electron/Chromium and dependency advisories for every release.

## Release decision

The implemented v1.1.8 foundation is suitable for a local unsigned preview
release with the limitations above stated clearly. It must not be described as
independently audited, zero-risk, biometric, or resistant to privileged local
malware.
