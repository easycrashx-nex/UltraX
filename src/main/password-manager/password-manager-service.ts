import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  BrowserWindow,
  clipboard,
  dialog,
  safeStorage,
} from "electron";
import type {
  PasswordBackupResult,
  PasswordGeneratorSettings,
  PasswordHealthSummary,
  PasswordImportSummary,
  PasswordManagerSettings,
  PasswordManagerStatus,
  PasswordVaultItemDisplay,
  PasswordVaultItemInput,
  PasswordVaultItemUpdate,
} from "../../shared/password-manager";
import { parsePasswordCsv } from "./csv-import";
import { generatePassword } from "./generator";
import { isSecureCredentialOrigin, normalizeCredentialOrigin, originsMatch } from "./origin";
import { VaultStore, type PasswordVaultItem, type VaultDocument } from "./vault-store";
import { clipboardStillContainsSecret, hashClipboardValue } from "./clipboard-protection";

type ServiceOptions = {
  directory: string;
  getSettings: () => PasswordManagerSettings;
  onStatusChanged: (status: PasswordManagerStatus) => void;
};

const MAX_BACKUP_BYTES = 32 * 1024 * 1024;

export class PasswordManagerService {
  readonly store: VaultStore;
  private vaultKey: Buffer | null = null;
  private itemCount = 0;
  private failedUnlocks = 0;
  private blockedUntil = 0;
  private autoLockTimer: NodeJS.Timeout | null = null;
  private clipboardTimer: NodeJS.Timeout | null = null;
  private clipboardSecretHash: string | null = null;
  private mutationQueue: Promise<void> = Promise.resolve();

  constructor(private readonly options: ServiceOptions) {
    this.store = new VaultStore(options.directory);
  }

  async initialize(): Promise<void> {
    this.scheduleAutoLock();
    await this.emitStatus();
  }

  async getStatus(): Promise<PasswordManagerStatus> {
    const exists = await this.store.exists();
    if (!exists) {
      return {
        state: "setup-required",
        quickUnlockAvailable: await this.isQuickUnlockAvailable(),
        quickUnlockConfigured: false,
        itemCount: null,
      };
    }
    let quickUnlockConfigured = false;
    try {
      quickUnlockConfigured = await this.store.hasOsWrappedKey();
    } catch {
      return {
        state: "corrupted",
        quickUnlockAvailable: await this.isQuickUnlockAvailable(),
        quickUnlockConfigured: false,
        itemCount: null,
      };
    }
    return {
      state: this.vaultKey ? "unlocked" : "locked",
      quickUnlockAvailable: await this.isQuickUnlockAvailable(),
      quickUnlockConfigured,
      itemCount: this.vaultKey ? this.itemCount : null,
      retryAfterMs: this.blockedUntil > Date.now() ? this.blockedUntil - Date.now() : undefined,
    };
  }

  async setup(masterPassword: string, enableQuickUnlock: boolean): Promise<PasswordManagerStatus> {
    validateMasterPassword(masterPassword);
    const quickUnlockAvailable = await this.isQuickUnlockAvailable();
    if (enableQuickUnlock && !quickUnlockAvailable) {
      throw new Error("OS quick unlock is unavailable on this device.");
    }
    this.replaceVaultKey(await this.store.create(
      masterPassword,
      enableQuickUnlock ? (key) => this.wrapKeyWithOs(key) : undefined,
    ));
    this.itemCount = 0;
    this.failedUnlocks = 0;
    this.blockedUntil = 0;
    this.scheduleAutoLock();
    return await this.emitStatus();
  }

  async unlock(masterPassword: string): Promise<PasswordManagerStatus> {
    this.assertUnlockAllowed();
    try {
      const key = await this.store.unlockWithMasterPassword(masterPassword);
      const document = await this.store.readDocument(key);
      this.replaceVaultKey(key);
      this.itemCount = document.items.length;
      this.failedUnlocks = 0;
      this.blockedUntil = 0;
      this.scheduleAutoLock();
      return await this.emitStatus();
    } catch {
      this.recordUnlockFailure();
      throw new Error("The vault could not be unlocked. Check the master password and try again.");
    }
  }

  async unlockWithOs(): Promise<PasswordManagerStatus> {
    this.assertUnlockAllowed();
    if (!(await this.isQuickUnlockAvailable())) throw new Error("OS quick unlock is unavailable.");
    try {
      const key = await this.store.unlockWithOs((wrapped) => this.unwrapKeyWithOs(wrapped));
      const document = await this.store.readDocument(key);
      this.replaceVaultKey(key);
      this.itemCount = document.items.length;
      this.failedUnlocks = 0;
      this.blockedUntil = 0;
      this.scheduleAutoLock();
      return await this.emitStatus();
    } catch {
      this.recordUnlockFailure();
      throw new Error("OS quick unlock failed. Use the master password instead.");
    }
  }

  async lock(): Promise<PasswordManagerStatus> {
    this.vaultKey?.fill(0);
    this.vaultKey = null;
    this.itemCount = 0;
    if (this.autoLockTimer) clearTimeout(this.autoLockTimer);
    this.autoLockTimer = null;
    await this.clearOwnedClipboard();
    return await this.emitStatus();
  }

  configure(): void {
    if (this.vaultKey) this.scheduleAutoLock();
  }

  async list(query = ""): Promise<PasswordVaultItemDisplay[]> {
    const document = await this.readUnlockedDocument();
    const normalizedQuery = query.trim().toLocaleLowerCase().slice(0, 256);
    this.touch();
    return document.items
      .filter((item) => !normalizedQuery || `${item.title} ${item.username} ${item.origins.join(" ")} ${item.tags.join(" ")}`.toLocaleLowerCase().includes(normalizedQuery))
      .sort((left, right) => Number(right.favorite) - Number(left.favorite) || left.title.localeCompare(right.title))
      .map(toDisplayItem);
  }

  async listMatchingCredentials(origin: string): Promise<PasswordVaultItemDisplay[]> {
    const normalizedOrigin = normalizeCredentialOrigin(origin);
    if (!isSecureCredentialOrigin(normalizedOrigin)) return [];
    const document = await this.readUnlockedDocument();
    this.touch();
    return document.items
      .filter((item) => item.origins.some((saved) => originsMatch(saved, normalizedOrigin)))
      .sort((left, right) => Number(right.favorite) - Number(left.favorite) || (right.lastUsedAt ?? 0) - (left.lastUsedAt ?? 0))
      .map(toDisplayItem);
  }

  async classifyCredentialCandidate(origin: string, username: string, password: string): Promise<"save" | "update" | "duplicate"> {
    const normalizedOrigin = normalizeCredentialOrigin(origin);
    if (!isSecureCredentialOrigin(normalizedOrigin)) return "save";
    const document = await this.readUnlockedDocument();
    const usernameKey = boundedString(username, "login username", 512, 1).trim().toLocaleLowerCase();
    const candidatePassword = boundedString(password, "login password", 4096, 1);
    const existing = document.items.find(
      (item) => item.username.trim().toLocaleLowerCase() === usernameKey &&
        item.origins.some((saved) => originsMatch(saved, normalizedOrigin)),
    );
    if (!existing) return "save";
    return existing.password === candidatePassword ? "duplicate" : "update";
  }

  async saveCredentialCandidate(origin: string, username: string, password: string): Promise<"saved" | "updated" | "duplicate"> {
    const normalizedOrigin = normalizeCredentialOrigin(origin);
    if (!isSecureCredentialOrigin(normalizedOrigin)) throw new Error("Password saving is blocked on insecure HTTP pages.");
    const normalizedUsername = boundedString(username, "login username", 512, 1).trim();
    const candidatePassword = boundedString(password, "login password", 4096, 1);
    const usernameKey = normalizedUsername.toLocaleLowerCase();
    return await this.mutate(async (document) => {
      const existing = document.items.find(
        (item) => item.username.trim().toLocaleLowerCase() === usernameKey &&
          item.origins.some((saved) => originsMatch(saved, normalizedOrigin)),
      );
      const now = Date.now();
      if (existing) {
        if (existing.password === candidatePassword) {
          existing.lastUsedAt = now;
          existing.updatedAt = Math.max(existing.updatedAt, now);
          return "duplicate";
        }
        existing.password = candidatePassword;
        existing.passwordChangedAt = now;
        existing.lastUsedAt = now;
        existing.updatedAt = now;
        return "updated";
      }

      document.items.push({
        id: randomUUID(),
        type: "login",
        title: new URL(normalizedOrigin).hostname,
        origins: [normalizedOrigin],
        username: normalizedUsername,
        password: candidatePassword,
        favorite: false,
        tags: [],
        createdAt: now,
        updatedAt: now,
        lastUsedAt: now,
        passwordChangedAt: now,
      });
      return "saved";
    });
  }

  async create(input: PasswordVaultItemInput): Promise<PasswordVaultItemDisplay> {
    const sanitized = sanitizeItemInput(input, true);
    return await this.mutate(async (document) => {
      const now = Date.now();
      const item: PasswordVaultItem = {
        ...sanitized,
        password: sanitized.password,
        id: randomUUID(),
        type: "login",
        createdAt: now,
        updatedAt: now,
        passwordChangedAt: now,
      };
      document.items.push(item);
      return toDisplayItem(item);
    });
  }

  async update(itemId: string, input: PasswordVaultItemUpdate): Promise<PasswordVaultItemDisplay> {
    const id = validateId(itemId);
    const sanitized = sanitizeItemInput({ ...input, password: input.password ?? "temporary" }, true);
    return await this.mutate(async (document) => {
      const item = findItem(document, id);
      const passwordChanged = typeof input.password === "string" && input.password.length > 0;
      Object.assign(item, {
        title: sanitized.title,
        origins: sanitized.origins,
        username: sanitized.username,
        notes: sanitized.notes,
        favorite: sanitized.favorite,
        tags: sanitized.tags,
        updatedAt: Date.now(),
      });
      if (passwordChanged) {
        item.password = sanitized.password;
        item.passwordChangedAt = item.updatedAt;
      }
      return toDisplayItem(item);
    });
  }

  async delete(itemId: string): Promise<void> {
    const id = validateId(itemId);
    await this.mutate(async (document) => {
      const index = document.items.findIndex((item) => item.id === id);
      if (index === -1) throw new Error("Login not found.");
      document.items.splice(index, 1);
    });
  }

  async duplicate(itemId: string): Promise<PasswordVaultItemDisplay> {
    const id = validateId(itemId);
    return await this.mutate(async (document) => {
      const source = findItem(document, id);
      const now = Date.now();
      const copy: PasswordVaultItem = {
        ...structuredClone(source),
        id: randomUUID(),
        title: `${source.title} Copy`.slice(0, 256),
        createdAt: now,
        updatedAt: now,
      };
      document.items.push(copy);
      return toDisplayItem(copy);
    });
  }

  generate(options: PasswordGeneratorSettings): string {
    return generatePassword(sanitizeGeneratorOptions(options));
  }

  async copyField(itemId: string, field: "username" | "password"): Promise<void> {
    const item = findItem(await this.readUnlockedDocument(), validateId(itemId));
    const value = field === "password" ? item.password : item.username;
    clipboard.writeText(value);
    if (field === "password") this.scheduleClipboardClear(value);
    this.touch();
  }

  async withCredentialForOrigin<T>(
    itemId: string,
    origin: string,
    action: (credential: { username: string; password: string }) => Promise<T>,
  ): Promise<T> {
    const normalizedOrigin = normalizeCredentialOrigin(origin);
    if (!isSecureCredentialOrigin(normalizedOrigin)) throw new Error("Password fill is blocked on insecure HTTP pages.");
    const document = await this.readUnlockedDocument();
    const item = findItem(document, validateId(itemId));
    if (!item.origins.some((saved) => originsMatch(saved, normalizedOrigin))) {
      throw new Error("This login does not match the active website origin.");
    }
    const result = await action({ username: item.username, password: item.password });
    await this.mutate(async (nextDocument) => {
      const nextItem = findItem(nextDocument, item.id);
      nextItem.lastUsedAt = Date.now();
      nextItem.updatedAt = Math.max(nextItem.updatedAt, nextItem.lastUsedAt);
    });
    this.touch();
    return result;
  }

  async health(): Promise<PasswordHealthSummary> {
    const document = await this.readUnlockedDocument();
    const passwordCounts = new Map<string, number>();
    const loginCounts = new Map<string, number>();
    for (const item of document.items) {
      passwordCounts.set(item.password, (passwordCounts.get(item.password) ?? 0) + 1);
      for (const origin of item.origins) {
        const key = `${origin}\n${item.username.toLocaleLowerCase()}`;
        loginCounts.set(key, (loginCounts.get(key) ?? 0) + 1);
      }
    }
    const oldBefore = Date.now() - 365 * 24 * 60 * 60 * 1000;
    this.touch();
    return {
      total: document.items.length,
      weak: document.items.filter((item) => isWeakPassword(item.password)).length,
      reused: document.items.filter((item) => (passwordCounts.get(item.password) ?? 0) > 1).length,
      duplicateLogins: [...loginCounts.values()].filter((count) => count > 1).reduce((total, count) => total + count, 0),
      old: document.items.filter((item) => (item.passwordChangedAt ?? item.createdAt) < oldBefore).length,
      insecureOrigins: document.items.filter((item) => item.origins.some((origin) => !isSecureCredentialOrigin(origin))).length,
      missingUsername: document.items.filter((item) => !item.username.trim()).length,
      analyzedLocally: true,
    };
  }

  async importCsv(owner: BrowserWindow): Promise<PasswordImportSummary | null> {
    this.requireUnlockedKey();
    const warning = await dialog.showMessageBox(owner, {
      type: "warning",
      buttons: ["Choose CSV", "Cancel"],
      defaultId: 1,
      cancelId: 1,
      message: "Import plaintext password CSV?",
      detail: "CSV exports contain readable passwords. UltraX will parse the selected file as data, encrypt valid logins immediately, and will not import cookies or tokens.",
    });
    if (warning.response !== 0) return null;
    const selected = await dialog.showOpenDialog(owner, {
      title: "Import passwords",
      properties: ["openFile"],
      filters: [{ name: "Password CSV", extensions: ["csv"] }],
    });
    if (selected.canceled || !selected.filePaths[0]) return null;
    const filePath = selected.filePaths[0];
    const stat = await fs.stat(filePath);
    if (!stat.isFile() || stat.size <= 0 || stat.size > 5 * 1024 * 1024) throw new Error("The selected CSV must be 5 MB or smaller.");
    const bytes = await fs.readFile(filePath);
    let parsed;
    try { parsed = parsePasswordCsv(bytes.toString("utf8")); } finally { bytes.fill(0); }
    const confirmation = await dialog.showMessageBox(owner, {
      type: "question",
      buttons: ["Import and Encrypt", "Cancel"],
      defaultId: 1,
      cancelId: 1,
      message: `Import ${parsed.items.length} valid login${parsed.items.length === 1 ? "" : "s"}?`,
      detail: `${parsed.skipped} rows will be skipped and ${parsed.failed} failed validation. Securely delete the plaintext CSV after confirming the import.`,
    });
    if (confirmation.response !== 0) return null;
    let imported = 0;
    await this.mutate(async (document) => {
      const existing = new Set(document.items.map((item) => `${item.origins.join("|")}\n${item.username}\n${item.password}`));
      for (const item of parsed.items) {
        const key = `${item.origins.join("|")}\n${item.username}\n${item.password}`;
        if (existing.has(key)) parsed.skipped += 1;
        else { existing.add(key); document.items.push(item); imported += 1; }
      }
    });
    return {
      imported,
      skipped: parsed.skipped,
      failed: parsed.failed,
      sourceFileName: path.basename(filePath),
    };
  }

  async exportBackup(owner: BrowserWindow, backupPassword: string): Promise<PasswordBackupResult | null> {
    validateMasterPassword(backupPassword);
    const key = this.requireUnlockedKey();
    const result = await dialog.showSaveDialog(owner, {
      title: "Export encrypted UltraX vault backup",
      defaultPath: `UltraX-password-vault-${new Date().toISOString().slice(0, 10)}.ultraxvaultbackup`,
      filters: [{ name: "UltraX Encrypted Vault Backup", extensions: ["ultraxvaultbackup"] }],
    });
    if (result.canceled || !result.filePath) return null;
    const bytes = await this.store.exportEncryptedBackup(key, backupPassword);
    try { await fs.writeFile(result.filePath, bytes, { mode: 0o600 }); } finally { bytes.fill(0); }
    this.touch();
    return { path: result.filePath, itemCount: this.itemCount };
  }

  async importBackup(owner: BrowserWindow, backupPassword: string): Promise<PasswordImportSummary | null> {
    validateMasterPassword(backupPassword);
    const key = this.requireUnlockedKey();
    const result = await dialog.showOpenDialog(owner, {
      title: "Import encrypted UltraX vault backup",
      properties: ["openFile"],
      filters: [{ name: "UltraX Encrypted Vault Backup", extensions: ["ultraxvaultbackup"] }],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const filePath = result.filePaths[0];
    const stat = await fs.stat(filePath);
    if (!stat.isFile() || stat.size <= 0 || stat.size > MAX_BACKUP_BYTES) throw new Error("The selected backup is invalid or too large.");
    const bytes = await fs.readFile(filePath);
    let document: VaultDocument;
    try { document = await this.store.importEncryptedBackup(key, bytes, backupPassword); } finally { bytes.fill(0); }
    this.itemCount = document.items.length;
    this.touch();
    await this.emitStatus();
    return { imported: document.items.length, skipped: 0, failed: 0, sourceFileName: path.basename(filePath) };
  }

  async changeMasterPassword(currentPassword: string, newPassword: string): Promise<void> {
    this.requireUnlockedKey();
    validateMasterPassword(newPassword);
    try {
      await this.store.changeMasterPassword(currentPassword, newPassword);
    } catch {
      throw new Error("The master password could not be changed. Check the current password.");
    }
    await this.lock();
  }

  async deleteVault(masterPassword: string): Promise<void> {
    const verificationKey = await this.store.unlockWithMasterPassword(masterPassword).catch(() => null);
    if (!verificationKey) throw new Error("The vault could not be deleted. Check the master password.");
    verificationKey.fill(0);
    await this.lock();
    await this.store.deleteVault();
    await this.emitStatus();
  }

  private async mutate<T>(action: (document: VaultDocument) => Promise<T> | T): Promise<T> {
    let result!: T;
    let failure: unknown;
    this.mutationQueue = this.mutationQueue.then(async () => {
      try {
        const key = this.requireUnlockedKey();
        const document = await this.store.readDocument(key);
        result = await action(document);
        await this.store.writeDocument(key, document);
        this.itemCount = document.items.length;
        this.touch();
        await this.emitStatus();
      } catch (error) {
        failure = error;
      }
    });
    await this.mutationQueue;
    if (failure) throw failure;
    return result;
  }

  private async readUnlockedDocument(): Promise<VaultDocument> {
    return await this.store.readDocument(this.requireUnlockedKey());
  }

  private requireUnlockedKey(): Buffer {
    if (!this.vaultKey) throw new Error("Unlock the password vault first.");
    return this.vaultKey;
  }

  private replaceVaultKey(key: Buffer): void {
    this.vaultKey?.fill(0);
    this.vaultKey = Buffer.from(key);
    key.fill(0);
  }

  private touch(): void {
    this.scheduleAutoLock();
  }

  private scheduleAutoLock(): void {
    if (this.autoLockTimer) clearTimeout(this.autoLockTimer);
    this.autoLockTimer = null;
    const minutes = this.options.getSettings().autoLockMinutes;
    if (!this.vaultKey || minutes === 0) return;
    this.autoLockTimer = setTimeout(() => { void this.lock(); }, minutes * 60_000);
    this.autoLockTimer.unref();
  }

  private assertUnlockAllowed(): void {
    if (Date.now() < this.blockedUntil) throw new Error("Too many attempts. Wait before trying again.");
  }

  private recordUnlockFailure(): void {
    this.failedUnlocks += 1;
    if (this.failedUnlocks >= 3) {
      const exponent = Math.min(5, this.failedUnlocks - 3);
      this.blockedUntil = Date.now() + Math.min(30_000, 1_000 * 2 ** exponent);
    }
    void this.emitStatus();
  }

  private async isQuickUnlockAvailable(): Promise<boolean> {
    try {
      if (!(await safeStorage.isAsyncEncryptionAvailable())) return false;
      if (process.platform === "linux" && safeStorage.getSelectedStorageBackend() === "basic_text") return false;
      return true;
    } catch {
      return false;
    }
  }

  private async wrapKeyWithOs(key: Buffer): Promise<string> {
    if (!(await this.isQuickUnlockAvailable())) throw new Error("OS encryption is unavailable.");
    return (await safeStorage.encryptStringAsync(key.toString("base64"))).toString("base64");
  }

  private async unwrapKeyWithOs(value: string): Promise<Buffer> {
    if (!(await this.isQuickUnlockAvailable())) throw new Error("OS encryption is unavailable.");
    const decrypted = await safeStorage.decryptStringAsync(Buffer.from(value, "base64"));
    return Buffer.from(decrypted.result, "base64");
  }

  private scheduleClipboardClear(secret: string): void {
    if (this.clipboardTimer) clearTimeout(this.clipboardTimer);
    this.clipboardSecretHash = hashClipboardValue(secret);
    const seconds = this.options.getSettings().clipboardClearSeconds;
    if (seconds === 0) return;
    this.clipboardTimer = setTimeout(() => { void this.clearOwnedClipboard(); }, seconds * 1000);
    this.clipboardTimer.unref();
  }

  private async clearOwnedClipboard(): Promise<void> {
    if (this.clipboardTimer) clearTimeout(this.clipboardTimer);
    this.clipboardTimer = null;
    const expected = this.clipboardSecretHash;
    this.clipboardSecretHash = null;
    if (clipboardStillContainsSecret(expected, clipboard.readText())) clipboard.clear();
  }

  private async emitStatus(): Promise<PasswordManagerStatus> {
    const status = await this.getStatus();
    this.options.onStatusChanged(status);
    return status;
  }
}

function sanitizeItemInput(input: PasswordVaultItemInput, passwordRequired: boolean): PasswordVaultItemInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid login data.");
  const title = boundedString(input.title, "title", 256, 1).trim();
  const username = boundedString(input.username, "username", 512, 0);
  const password = boundedString(input.password, "password", 4096, passwordRequired ? 1 : 0);
  const notes = input.notes === undefined ? undefined : boundedString(input.notes, "notes", 16_384, 0);
  if (!Array.isArray(input.origins) || input.origins.length === 0 || input.origins.length > 20) throw new Error("Add at least one valid website origin.");
  const origins = [...new Set(input.origins.map((origin) => normalizeCredentialOrigin(origin)))];
  if (!Array.isArray(input.tags) || input.tags.length > 30) throw new Error("Invalid login tags.");
  const tags = [...new Set(input.tags.map((tag) => boundedString(tag, "tag", 64, 1).trim()).filter(Boolean))];
  if (typeof input.favorite !== "boolean") throw new Error("Invalid favorite state.");
  return { title, origins, username, password, notes: notes || undefined, favorite: input.favorite, tags };
}

function sanitizeGeneratorOptions(value: PasswordGeneratorSettings): PasswordGeneratorSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid generator settings.");
  return {
    length: Number(value.length),
    uppercase: Boolean(value.uppercase),
    lowercase: Boolean(value.lowercase),
    digits: Boolean(value.digits),
    symbols: Boolean(value.symbols),
    avoidAmbiguous: Boolean(value.avoidAmbiguous),
  };
}

function toDisplayItem(item: PasswordVaultItem): PasswordVaultItemDisplay {
  return {
    id: item.id,
    type: "login",
    title: item.title,
    origins: [...item.origins],
    username: item.username,
    notes: item.notes,
    favorite: item.favorite,
    tags: [...item.tags],
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    lastUsedAt: item.lastUsedAt,
    passwordChangedAt: item.passwordChangedAt,
    passwordLength: item.password.length,
  };
}

function findItem(document: VaultDocument, itemId: string): PasswordVaultItem {
  const item = document.items.find((candidate) => candidate.id === itemId);
  if (!item) throw new Error("Login not found.");
  return item;
}

function validateId(value: string): string {
  return boundedString(value, "login id", 128, 1);
}

function validateMasterPassword(value: string): void {
  if (typeof value !== "string" || value.length < 12 || value.length > 1024) {
    throw new Error("Use a master password with at least 12 characters.");
  }
}

function boundedString(value: unknown, label: string, maximum: number, minimum: number): string {
  if (typeof value !== "string" || value.length < minimum || value.length > maximum) throw new Error(`Invalid ${label}.`);
  return value;
}

function isWeakPassword(value: string): boolean {
  if (value.length < 12) return true;
  let groups = 0;
  if (/[a-z]/.test(value)) groups += 1;
  if (/[A-Z]/.test(value)) groups += 1;
  if (/\d/.test(value)) groups += 1;
  if (/[^A-Za-z0-9]/.test(value)) groups += 1;
  return groups < 3 || /^(password|qwerty|letmein|admin|welcome|123456)/i.test(value);
}
