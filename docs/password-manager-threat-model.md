# UltraX Password Manager Threat Model

## Overview

UltraX is an Electron browser that renders the trusted local React shell in a
`BrowserWindow` and untrusted websites in separate sandboxed `WebContentsView`
instances. The v1.1.8 password manager adds a local encrypted vault controlled
by the main process. It does not add cloud sync, browser-profile scanning,
automatic form capture, extension access, or private browsing.

The primary assets are the vault key, master password, decrypted credentials,
encrypted vault and backup files, clipboard contents, and the integrity of the
origin-to-tab decision used for credential filling.

## Threat Model, Trust Boundaries, and Assumptions

### Trust boundaries

1. **User to trusted UltraX shell.** Master passwords and entry edits enter the
   packaged local shell. The shell has a narrow preload bridge and cannot use
   raw Electron or Node APIs.
2. **Trusted shell to main process.** Every password operation crosses a typed,
   allow-listed IPC handler. Main validates the sender and all request values.
3. **Main process to vault file.** Only authenticated ciphertext and versioned,
   non-secret format metadata are stored under Electron `userData`.
4. **Main process to operating system.** Optional quick unlock uses Electron
   `safeStorage` only when OS encryption is available. Clipboard operations use
   Electron's main-process clipboard API.
5. **Main process to website.** An explicit fill request targets only the active
   tab's top-level frame after the main process re-checks its exact origin.
6. **Extensions and plugins.** They are untrusted relative to the vault and
   receive no password-manager API, key material, records, or fill capability.

### Security invariants

- The master password and derived key are never persisted.
- Credentials, usernames, notes, tags, origins, and titles are never stored in
  plaintext vault metadata.
- AES-GCM nonces are random and unique for each envelope; AAD authenticates the
  format purpose and version.
- Decryption must authenticate before plaintext is parsed.
- Wrong passwords and tampered data fail closed without a plaintext fallback.
- Password lists returned to the renderer contain redacted metadata only.
- A stored password is never returned to the renderer for copy or fill actions.
- Fill requires an unlocked vault, an explicit user action, the active tab ID,
  exact normalized HTTPS origin equality, and a top-level-frame target.
- Extensions cannot invoke password-manager IPC, even with tabs, activeTab,
  storage, clipboard, history, or settings permission.
- Existing bookmarks, history, extensions, settings, and sessions are never
  overwritten by vault creation or migration.

### Assumptions

- The packaged UltraX main process and shell bundle are trusted and untampered.
- Node.js, Electron, Chromium, and the operating-system cryptography provider
  behave according to their documented contracts.
- The user chooses a sufficiently strong master password and protects the
  unlocked desktop session.
- JavaScript cannot guarantee perfect memory erasure. UltraX minimizes secret
  lifetime and zeroes mutable buffers where practical, but cannot protect a
  running unlocked process from privileged local inspection.

## Attack Surface, Mitigations, and Attacker Stories

### Stolen vault file

An attacker may copy `vault.ultraxvault`, its backup, or an encrypted export.
The vault key is wrapped with a key derived using memory-hard `scrypt`, and all
payloads use authenticated AES-256-GCM. This limits the attacker to offline
master-password guessing. File names and format version remain visible; record
metadata does not.

### Malicious website and phishing domain

A site may imitate UltraX UI, create hidden fields or frames, navigate during a
fill request, or use a look-alike hostname. Password fill is initiated only in
trusted browser chrome, compares exact normalized origins in main immediately
before use, distinguishes HTTP from HTTPS, rejects substring and parent-domain
matches, and targets only the active top-level frame. `example.com.evil.test`
does not match `example.com`. UltraX cannot determine whether a visually similar
registered domain is legitimate; the target origin is shown to the user.

### Compromised renderer

A compromised website renderer has no preload and no password IPC. A compromised
trusted shell renderer could issue allowed IPC calls, but cannot list plaintext
passwords or retrieve a password directly. It could still abuse user-authorized
copy/fill operations while the vault is unlocked, so sender validation, narrow
actions, lock timeouts, production DevTools restrictions, and origin checks are
material controls. Compromise of the main process is out of scope.

### Compromised extension or plugin

Extensions are explicitly outside the vault trust boundary. The extension API
dispatcher has no password operations and does not receive the shell preload.
An extension that can modify a page could observe a credential after UltraX
fills that page, as can any script already executing in the target origin. This
is an inherent browser autofill risk and is why fill is explicit and exact-origin.

### Clipboard exposure

Other desktop applications and clipboard-history tools may read copied secrets.
UltraX copies through main, schedules clearing, and clears only if a hash of the
current clipboard still matches the copied value. Copy is optional and the UI
states the residual operating-system risk.

### Crash logs, screenshots, previews, and diagnostics

No password values, master passwords, imports, or vault plaintext are logged.
Diagnostics contain only redacted status and counts. UltraX cannot prevent the
operating system, screen-recording software, or local malware from capturing a
visible secret. Passwords remain masked in normal views.

### Memory exposure

The unlocked vault key exists in main-process memory. Records are decrypted only
for a bounded operation, references are released, and mutable key/plaintext
buffers are zeroed where possible. JavaScript strings and garbage collection
prevent a guarantee of immediate erasure. Local malware, debuggers, process
dumps, and a compromised main process remain out of scope.

### Malicious import or backup file

Imports are explicit, size-limited, parsed as CSV data, and schema validated.
Formula-like cells, HTML, and JavaScript are never executed. Backup import first
authenticates the encrypted envelope and validates format/version before parsing
or replacing a vault. A recoverable encrypted last-known-good copy is retained.

### Update and supply-chain risk

A compromised update, dependency, build machine, or GitHub release could replace
the trusted main process and defeat vault protections after installation. The
release uses dependency audit and CI checks, but Windows binaries are not yet
code signed. Signed builds, protected branches, reproducible provenance, and an
independent review remain required release-hardening work.

### Lost master password

There is no server recovery and no stored master password. Without the master
password, an OS quick-unlock wrapper that still works on the same OS account, or
an encrypted backup password, vault data may be unrecoverable. UltraX does not
weaken encryption to provide recovery.

### Multiple windows, screen lock, and sleep

One main-process vault session is shared by trusted UltraX windows. Lock state is
global and broadcast as redacted status. Screen lock and suspend events lock the
session. A request includes its owning window and active tab; one window cannot
fill another window's inactive tab.

### Private browsing

UltraX v1.1.8 has no private/incognito mode. No private-mode behavior or security
claim is implemented. A future private mode must default to no save prompts and
must require an explicit unlock and fill action.

### Out of scope

- Privileged local malware, kernel compromise, memory scraping, keylogging, and
  screen capture while the vault is unlocked.
- Compromise of the packaged main process, operating system, Node.js, Electron,
  Chromium, or OS key provider.
- Recovery from a forgotten master password without an existing valid wrapper.
- Protection after a credential is intentionally filled into a compromised page
  at the exact saved origin.

## Severity Calibration

- **Critical:** plaintext vault persistence; unauthenticated decryption; a remote
  website or extension reading arbitrary vault secrets; master/key logging.
- **High:** cross-origin fill; inactive-window/tab confusion; nonce reuse; bypass
  of lock or master-password verification; destructive import without recovery.
- **Medium:** clipboard clearing overwrites newer user data; metadata leakage;
  weak import validation; auto-lock failure on a supported screen-lock event.
- **Low:** non-secret status leakage, inaccessible controls, or visual defects
  that do not expose or destroy credentials.

Repository: https://github.com/easycrashx-nex/UltraX.git
Version: 8543eb3
