const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  createVaultKdf,
  decryptAesGcm,
  deriveMasterKey,
  encryptAesGcm,
} = require("../../dist-electron/main/password-manager/crypto.js");
const { generatePassword } = require("../../dist-electron/main/password-manager/generator.js");
const {
  isSecureCredentialOrigin,
  normalizeCredentialOrigin,
  originsMatch,
} = require("../../dist-electron/main/password-manager/origin.js");
const { parsePasswordCsv } = require("../../dist-electron/main/password-manager/csv-import.js");
const { VaultStore } = require("../../dist-electron/main/password-manager/vault-store.js");
const {
  clipboardStillContainsSecret,
  hashClipboardValue,
} = require("../../dist-electron/main/password-manager/clipboard-protection.js");

const MASTER = "correct horse battery staple 2026";

test("AES-GCM and scrypt authenticate ciphertext, metadata, and unique nonces", async () => {
  const kdf = createVaultKdf({ N: 16_384, r: 8, p: 1 });
  const key = await deriveMasterKey(MASTER, kdf);
  const plaintext = Buffer.from("vault-test-secret", "utf8");
  try {
    const first = encryptAesGcm(key, plaintext, "ultrax:test:v1");
    const second = encryptAesGcm(key, plaintext, "ultrax:test:v1");
    assert.notEqual(first.nonce, second.nonce);
    assert.equal(decryptAesGcm(key, first, "ultrax:test:v1").toString("utf8"), "vault-test-secret");
    assert.throws(() => decryptAesGcm(key, first, "ultrax:wrong-aad"), /authentication/i);
    const tampered = {
      ...first,
      ciphertext: Buffer.from(`${Buffer.from(first.ciphertext, "base64").subarray(0, -1).toString("binary")}x`, "binary").toString("base64"),
    };
    assert.throws(() => decryptAesGcm(key, tampered, "ultrax:test:v1"), /authentication/i);
  } finally {
    key.fill(0);
    plaintext.fill(0);
  }
});

test("origin matching uses exact canonical origins and rejects hostile lookalikes", () => {
  assert.equal(normalizeCredentialOrigin("EXAMPLE.com/login"), "https://example.com");
  assert.equal(originsMatch("https://example.com", "https://example.com/account"), true);
  assert.equal(originsMatch("https://example.com", "https://login.example.com"), false);
  assert.equal(originsMatch("https://example.com", "https://example.com.evil.test"), false);
  assert.equal(originsMatch("https://example.com", "https://evil-example.com"), false);
  assert.equal(originsMatch("http://example.com", "https://example.com"), false);
  assert.equal(originsMatch("https://example.com", "https://example.com:444"), false);
  assert.equal(normalizeCredentialOrigin("https://buecher.example"), "https://buecher.example");
  assert.equal(normalizeCredentialOrigin("http://127.0.0.1:8080/path"), "http://127.0.0.1:8080");
  assert.equal(normalizeCredentialOrigin("http://localhost:5173"), "http://localhost:5173");
  assert.equal(isSecureCredentialOrigin("https://example.com"), true);
  assert.equal(isSecureCredentialOrigin("http://localhost"), false);
});

test("password generation uses selected groups and never emits ambiguous defaults", () => {
  const options = {
    length: 32,
    uppercase: true,
    lowercase: true,
    digits: true,
    symbols: true,
    avoidAmbiguous: true,
  };
  const generated = generatePassword(options);
  assert.equal(generated.length, 32);
  assert.match(generated, /[A-Z]/);
  assert.match(generated, /[a-z]/);
  assert.match(generated, /[0-9]/);
  assert.match(generated, /[^A-Za-z0-9]/);
  assert.doesNotMatch(generated, /[Il1O0|`'"]/);
  assert.notEqual(generatePassword(options), generated);
});

test("CSV import parses browser exports as data and validates origins", () => {
  const result = parsePasswordCsv(`name,url,username,password,note\nExample,https://example.com/login,alice,secret-1,hello\nEvil,javascript:alert(1),bad,secret-2,no\nDuplicate,https://example.com,alice,secret-1,same\nMissing,https://missing.test,user,,none`);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].origins[0], "https://example.com");
  assert.equal(result.skipped, 2);
  assert.equal(result.failed, 1);
});

test("clipboard ownership never clears newer clipboard content", () => {
  const expected = hashClipboardValue("copied password");
  assert.equal(clipboardStillContainsSecret(expected, "copied password"), true);
  assert.equal(clipboardStillContainsSecret(expected, "new user clipboard value"), false);
  assert.equal(clipboardStillContainsSecret(null, "copied password"), false);
});

test("vault setup, lock/unlock, CRUD persistence and encrypted backup fail closed", async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "ultrax-vault-test-"));
  t.after(async () => fs.rm(directory, { recursive: true, force: true }));
  const store = new VaultStore(directory);
  const key = await store.create(MASTER);
  assert.equal(await store.hasOsWrappedKey(), false);
  await assert.rejects(() => store.unlockWithOs(async () => Buffer.alloc(32)), /not configured/i);
  await assert.rejects(() => store.unlockWithMasterPassword("wrong password"), /authentication/i);

  const now = Date.now();
  const document = await store.readDocument(key);
  document.items.push({
    id: "test-item",
    type: "login",
    title: "Example",
    origins: ["https://example.com"],
    username: "alice@example.com",
    password: "unique-test-password-93!",
    notes: "private note",
    favorite: true,
    tags: ["work"],
    createdAt: now,
    updatedAt: now,
    passwordChangedAt: now,
  });
  await store.writeDocument(key, document);
  const rawVault = await fs.readFile(store.vaultPath, "utf8");
  assert.doesNotMatch(rawVault, /alice@example\.com|unique-test-password|private note|example\.com/i);
  assert.equal((await fs.stat(store.backupPath)).isFile(), true);

  key.fill(0);
  const restartedStore = new VaultStore(directory);
  const restartedKey = await restartedStore.unlockWithMasterPassword(MASTER);
  assert.equal((await restartedStore.readDocument(restartedKey)).items[0].title, "Example");

  const backup = await restartedStore.exportEncryptedBackup(restartedKey, "separate backup password 2026");
  assert.doesNotMatch(backup.toString("utf8"), /unique-test-password|alice@example\.com/i);
  await assert.rejects(
    () => restartedStore.importEncryptedBackup(restartedKey, backup, "wrong backup password"),
    /authentication/i,
  );
  const modified = Buffer.from(backup);
  modified[modified.length - 4] ^= 1;
  await assert.rejects(
    () => restartedStore.importEncryptedBackup(restartedKey, modified, "separate backup password 2026"),
  );
  const imported = await restartedStore.importEncryptedBackup(
    restartedKey,
    backup,
    "separate backup password 2026",
  );
  assert.equal(imported.items.length, 1);
  restartedKey.fill(0);
  backup.fill(0);
  modified.fill(0);
});
