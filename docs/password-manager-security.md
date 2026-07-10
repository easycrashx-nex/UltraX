# UltraX Password Manager Security

## What v1.1.8 protects

UltraX stores vault records locally as authenticated ciphertext. A random vault
key encrypts the record payload with AES-256-GCM. A key derived from the master
password with memory-hard scrypt wraps that vault key. The master password is not
stored. Optional OS quick unlock wraps the same vault key with Electron
`safeStorage` only when a secure platform provider is available.

The password manager does not send vault contents, password hashes, health data,
or keys to a remote service. Extensions and plugins receive no vault API.

## User security guidance

- Use a unique master password of at least 12 characters; a longer passphrase is
  preferable.
- Keep an encrypted backup in a separate protected location. Losing both the
  master password and all usable wrappers can make the vault unrecoverable.
- Treat CSV imports as highly sensitive plaintext and securely remove the source
  file after confirming the import.
- Clipboard history and other desktop applications can read copied passwords.
  Prefer direct fill and keep automatic clipboard clearing enabled.
- Verify the exact origin displayed by UltraX before filling. A visually similar
  phishing domain is a different origin and will not match automatically.
- Lock the vault before leaving the computer and keep screen-lock/sleep locking
  enabled.
- Install UltraX updates from the official GitHub Releases page. v1.1.8 Windows
  binaries are not yet code signed and can trigger SmartScreen warnings.

## Security defaults

- Auto-lock after 15 minutes of inactivity.
- Lock when UltraX closes, when all windows close, on screen lock, and on sleep.
- Password fill requires a click, an unlocked vault, the active tab, an exact
  saved origin, HTTPS, and the top-level frame.
- Passwords remain masked and list responses remain redacted.
- Copied passwords clear after 30 seconds only if the clipboard still contains
  that same value.
- No automatic profile import, plaintext export, cloud sync, or private-mode
  behavior.

## Known limitations

- JavaScript and Electron cannot guarantee complete or immediate memory erasure.
- Local malware, keyloggers, debuggers, screen capture, and a compromised main
  process can defeat protections while the vault is unlocked.
- OS quick unlock is tied to the operating-system account. On Windows, DPAPI does
  not protect against other applications running as the same user.
- Once a credential is deliberately filled, scripts at that exact origin may be
  able to observe it, as with normal browser form interaction.
- v1.1.8 does not monitor form submissions or show automatic save/update prompts.
  Manual creation and explicit fill are provided until an isolated content bridge
  can be designed and audited.
- UltraX has no private/incognito mode in v1.1.8.
- This implementation has not received an independent security audit.

## Reporting vulnerabilities

Do not include vault files, passwords, keys, imported CSV data, or personal sites
in a public issue. Use a private GitHub security advisory for the UltraX
repository or contact the project owner directly.

## Implementation references

- Electron safeStorage: https://www.electronjs.org/docs/latest/api/safe-storage
- Electron powerMonitor: https://www.electronjs.org/docs/latest/api/power-monitor
- Electron security: https://www.electronjs.org/docs/latest/tutorial/security
- Node.js crypto: https://nodejs.org/docs/latest-v22.x/api/crypto.html
