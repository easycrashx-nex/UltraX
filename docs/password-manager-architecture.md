# UltraX Password Manager Architecture

## Scope

v1.1.8 adds an UltraX-owned, local-first encrypted vault without changing the
existing browser data store. It implements setup, lock/unlock, redacted search,
CRUD, generation, health checks, clipboard protection, CSV import, encrypted
backup, optional OS-backed quick unlock, and explicit user-triggered top-frame
fill. It does not implement automatic form capture, cloud sync, password sharing,
plaintext export, browser-profile scans, payment data, or private browsing.

## Components and trust flow

```text
Trusted React shell
  -> narrow typed preload API
  -> sender-validated main-process IPC
  -> PasswordManagerService
       -> VaultStore -> userData/password-manager/vault.ultraxvault
       -> Electron safeStorage (optional wrapped vault key)
       -> Electron clipboard (copy and conditional clear)
       -> active BrowserController -> active top-level WebContents frame

Untrusted website WebContentsView ------ no preload / no vault IPC
Extensions and plugin runtime ---------- no vault dispatcher operations
```

The service is process-global so all UltraX windows share one lock state. Window
ownership and active-tab identity are resolved from the IPC sender immediately
before fill. No renderer receives an encryption key or stored password.

## Vault format

The primary file is JSON containing only versioned cryptographic envelopes:

```ts
type VaultFileV1 = {
  format: "ultrax-password-vault";
  version: 1;
  kdf: {
    name: "scrypt";
    salt: string; // base64, random 16 bytes
    N: 131072;
    r: 8;
    p: 1;
    keyLength: 32;
  };
  wrappedVaultKey: AesGcmEnvelope;
  osWrappedVaultKey?: string; // base64 safeStorage output
  payload: AesGcmEnvelope;
};

type AesGcmEnvelope = {
  algorithm: "aes-256-gcm";
  nonce: string; // base64, random 12 bytes per encryption
  ciphertext: string;
  authTag: string;
};
```

The payload contains the full typed vault document and all record metadata. The
unencrypted file reveals only format, version, KDF parameters, and ciphertext
sizes. AAD binds every envelope to its product, purpose, and version.

The master password is converted to a 32-byte key with Node's maintained
`crypto.scrypt` implementation. `scrypt` was selected over a native Argon2 add-on
to avoid a new native supply-chain and installer surface while still using a
standard memory-hard KDF. The derived key wraps a random 256-bit vault key. The
vault key encrypts the payload using AES-256-GCM. Changing the master password
rewraps the vault key and does not re-encrypt every record.

## Storage and recovery

- Primary: `userData/password-manager/vault.ultraxvault`
- Last-known-good: `vault.ultraxvault.bak`
- Writes: create a same-directory temporary file, flush/close, move the previous
  primary to `.bak`, and atomically rename the temporary file to primary.
- Permissions: best-effort owner-only mode on platforms that honor POSIX modes.
- Read: validate size, schema, KDF bounds, base64 lengths, GCM authentication,
  and plaintext schema before accepting data.
- Recovery: if primary authentication/structure fails, report corruption and do
  not silently replace it. A separate recovery action can restore the encrypted
  `.bak` only after successful authentication.

There is no plaintext fallback. Temporary test vaults and imports are deleted by
tests; production writes never create a plaintext database.

## Key lifecycle

1. Setup derives a master key, creates a random vault key, encrypts an empty vault,
   optionally wraps the vault key with `safeStorage`, then zeroes mutable keys.
2. Unlock derives the master key and unwraps the vault key. Generic failure and
   bounded exponential backoff prevent a detailed password/corruption oracle.
3. While unlocked, only the vault key Buffer and redacted status are retained.
   Full decrypted vault documents are short-lived per operation.
4. Auto-lock, manual lock, application close, screen lock, or suspend zeroes the
   vault key and invalidates the session generation.
5. OS quick unlock is offered only when Electron reports usable OS encryption.
   On Linux, the insecure `basic_text` backend is rejected. It is not biometric
   authentication and is never described as Windows Hello.

## IPC contract

Renderer-facing operations are explicit and typed: status, setup, unlock, lock,
list redacted items, create/update/delete/duplicate, generate, copy field, fill,
health, import CSV, encrypted backup import/export, change master password, and
delete vault. Boundary validators constrain strings, arrays, file sizes, enum
values, URL schemes, and identifiers.

List and detail responses redact passwords. Copy and fill are completed in main.
There is intentionally no `getAll`, `getPassword`, raw vault read, arbitrary file
read/write, arbitrary script, or generic IPC method.

## Origin and fill model

Saved sites are canonical origins, not substrings or free-form match patterns.
The normalizer uses the platform URL parser, allows only `http:` and `https:`,
lowercases canonical hosts, preserves non-default ports, and distinguishes HTTP
from HTTPS. Default fill policy requires HTTPS; localhost is not silently exempt.

Fill is available from trusted UltraX chrome only. Main verifies the requesting
BrowserWindow, active tab ID, current main-frame origin, matching entry origin,
vault state, and policy. It executes a fixed field-selection routine only in the
active main frame. Cross-origin and hidden iframes are not targeted. Navigation
between request and execution causes rejection.

Automatic save/update prompt detection is deliberately not included in v1.1.8.
Correct implementation requires a dedicated isolated content bridge that can
observe only a bounded form event, bind it to a frame and navigation generation,
and withhold form data until user consent. Polling pages or exposing a general
web preload would violate the threat model. Manual save for the current origin is
the safe release path.

## Import and backup

CSV import requires an explicit file picker, plaintext warning, bounded file
size, a maintained structured CSV parser, field mapping, preview counts, and a
second confirmation. Values are data only. Valid records are normalized and
encrypted in the next atomic vault write. UltraX never scans other profiles.

Encrypted backups use a separate versioned, authenticated AES-GCM envelope and a
backup-password `scrypt` key. Import authenticates and validates the complete
backup before replacing data and preserves a last-known-good encrypted primary.
Plaintext export is excluded from v1.1.8.

## Future sync boundary

No sync provider is active. A future provider may exchange only opaque encrypted
vault blobs and version metadata. It must never receive plaintext, derived keys,
master passwords, or OS-wrapped key material. Conflict handling and account
authentication are outside this release.
