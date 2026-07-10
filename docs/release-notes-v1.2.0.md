# UltraX Browser 1.2.0

Internal version: `1.2.0`.
Release tag: `v1.2.0`.

## Password Save & Autofill

UltraX now detects cautious top-level login transitions through an isolated page preload. Candidate passwords remain transient in the Main process until the user explicitly confirms Save or Update in trusted UltraX chrome.

Autofill suggestions use exact normalized HTTPS origins. The password vault remains the only source of password values; the renderer receives usernames and masked metadata only. HTTP, child-frame, hidden-field, lookalike-domain, and inactive-tab paths fail closed.

The manual Passwords & Autofill settings page manages saving, updates, explicit account selection, vault unlock requirements, insecure HTTP policy, and Never Save origin rules.
