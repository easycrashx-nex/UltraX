import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { PasswordVaultItemInput } from "../../shared/password-manager";
import {
  createVaultKdf,
  decryptAesGcm,
  deriveMasterKey,
  encryptAesGcm,
  type AesGcmEnvelope,
  type VaultKdf,
} from "./crypto";

const VAULT_FORMAT = "ultrax-password-vault";
const BACKUP_FORMAT = "ultrax-password-backup";
const VAULT_VERSION = 1;
const MAX_VAULT_BYTES = 32 * 1024 * 1024;
const VAULT_KEY_AAD = `${VAULT_FORMAT}:1:vault-key`;
const VAULT_PAYLOAD_AAD = `${VAULT_FORMAT}:1:payload`;
const BACKUP_PAYLOAD_AAD = `${BACKUP_FORMAT}:1:payload`;

export type PasswordVaultItem = PasswordVaultItemInput & {
  id: string;
  type: "login";
  createdAt: number;
  updatedAt: number;
  lastUsedAt?: number;
  passwordChangedAt?: number;
};

export type VaultDocument = {
  format: "ultrax-password-data";
  version: 1;
  items: PasswordVaultItem[];
};

type VaultFileV1 = {
  format: typeof VAULT_FORMAT;
  version: 1;
  kdf: VaultKdf;
  wrappedVaultKey: AesGcmEnvelope;
  osWrappedVaultKey?: string;
  payload: AesGcmEnvelope;
};

type BackupFileV1 = {
  format: typeof BACKUP_FORMAT;
  version: 1;
  kdf: VaultKdf;
  payload: AesGcmEnvelope;
};

export class VaultStore {
  readonly vaultPath: string;
  readonly backupPath: string;

  constructor(directory: string) {
    this.vaultPath = path.join(directory, "vault.ultraxvault");
    this.backupPath = `${this.vaultPath}.bak`;
  }

  async exists(): Promise<boolean> {
    try {
      await fs.access(this.vaultPath);
      return true;
    } catch {
      return false;
    }
  }

  async create(
    masterPassword: string,
    wrapWithOs?: (vaultKey: Buffer) => Promise<string | undefined>,
  ): Promise<Buffer> {
    if (await this.exists()) throw new Error("A password vault already exists.");
    const kdf = createVaultKdf();
    const masterKey = await deriveMasterKey(masterPassword, kdf);
    const vaultKey = randomBytes(32);
    const emptyDocument: VaultDocument = {
      format: "ultrax-password-data",
      version: 1,
      items: [],
    };
    try {
      const osWrappedVaultKey = await wrapWithOs?.(vaultKey);
      const file: VaultFileV1 = {
        format: VAULT_FORMAT,
        version: VAULT_VERSION,
        kdf,
        wrappedVaultKey: encryptAesGcm(masterKey, vaultKey, VAULT_KEY_AAD),
        osWrappedVaultKey,
        payload: encryptDocument(vaultKey, emptyDocument),
      };
      await this.atomicWrite(file, false);
      return Buffer.from(vaultKey);
    } finally {
      masterKey.fill(0);
      vaultKey.fill(0);
    }
  }

  async unlockWithMasterPassword(masterPassword: string): Promise<Buffer> {
    const file = await this.readFile();
    const masterKey = await deriveMasterKey(masterPassword, file.kdf);
    try {
      const vaultKey = decryptAesGcm(masterKey, file.wrappedVaultKey, VAULT_KEY_AAD);
      try {
        decryptDocument(vaultKey, file.payload);
      } catch (error) {
        vaultKey.fill(0);
        throw error;
      }
      return vaultKey;
    } finally {
      masterKey.fill(0);
    }
  }

  async unlockWithOs(
    unwrapWithOs: (wrappedKey: string) => Promise<Buffer>,
  ): Promise<Buffer> {
    const file = await this.readFile();
    if (!file.osWrappedVaultKey) throw new Error("OS quick unlock is not configured.");
    const vaultKey = await unwrapWithOs(file.osWrappedVaultKey);
    if (!Buffer.isBuffer(vaultKey) || vaultKey.length !== 32) {
      vaultKey?.fill(0);
      throw new Error("OS quick unlock failed.");
    }
    try {
      decryptDocument(vaultKey, file.payload);
      return vaultKey;
    } catch (error) {
      vaultKey.fill(0);
      throw error;
    }
  }

  async hasOsWrappedKey(): Promise<boolean> {
    if (!(await this.exists())) return false;
    return Boolean((await this.readFile()).osWrappedVaultKey);
  }

  async readDocument(vaultKey: Buffer): Promise<VaultDocument> {
    return decryptDocument(vaultKey, (await this.readFile()).payload);
  }

  async writeDocument(vaultKey: Buffer, document: VaultDocument): Promise<void> {
    validateDocument(document);
    const file = await this.readFile();
    file.payload = encryptDocument(vaultKey, document);
    await this.atomicWrite(file, true);
  }

  async changeMasterPassword(
    currentMasterPassword: string,
    newMasterPassword: string,
  ): Promise<void> {
    const file = await this.readFile();
    const currentKey = await deriveMasterKey(currentMasterPassword, file.kdf);
    let vaultKey: Buffer | undefined;
    let newMasterKey: Buffer | undefined;
    try {
      vaultKey = decryptAesGcm(currentKey, file.wrappedVaultKey, VAULT_KEY_AAD);
      decryptDocument(vaultKey, file.payload);
      const nextKdf = createVaultKdf();
      newMasterKey = await deriveMasterKey(newMasterPassword, nextKdf);
      file.kdf = nextKdf;
      file.wrappedVaultKey = encryptAesGcm(newMasterKey, vaultKey, VAULT_KEY_AAD);
      await this.atomicWrite(file, true);
    } finally {
      currentKey.fill(0);
      vaultKey?.fill(0);
      newMasterKey?.fill(0);
    }
  }

  async exportEncryptedBackup(vaultKey: Buffer, backupPassword: string): Promise<Buffer> {
    const document = await this.readDocument(vaultKey);
    const kdf = createVaultKdf();
    const backupKey = await deriveMasterKey(backupPassword, kdf);
    const plaintext = Buffer.from(JSON.stringify(document), "utf8");
    try {
      const backup: BackupFileV1 = {
        format: BACKUP_FORMAT,
        version: 1,
        kdf,
        payload: encryptAesGcm(backupKey, plaintext, BACKUP_PAYLOAD_AAD),
      };
      return Buffer.from(JSON.stringify(backup, null, 2), "utf8");
    } finally {
      backupKey.fill(0);
      plaintext.fill(0);
    }
  }

  async importEncryptedBackup(
    vaultKey: Buffer,
    backupBytes: Buffer,
    backupPassword: string,
  ): Promise<VaultDocument> {
    if (backupBytes.length === 0 || backupBytes.length > MAX_VAULT_BYTES) {
      throw new Error("Invalid UltraX backup file.");
    }
    const backup = parseBackupFile(backupBytes.toString("utf8"));
    const backupKey = await deriveMasterKey(backupPassword, backup.kdf);
    let plaintext: Buffer | undefined;
    try {
      plaintext = decryptAesGcm(backupKey, backup.payload, BACKUP_PAYLOAD_AAD);
      const document = parseDocument(plaintext);
      await this.writeDocument(vaultKey, document);
      return document;
    } finally {
      backupKey.fill(0);
      plaintext?.fill(0);
    }
  }

  async deleteVault(): Promise<void> {
    await Promise.allSettled([
      fs.rm(this.vaultPath, { force: true }),
      fs.rm(this.backupPath, { force: true }),
    ]);
  }

  private async readFile(): Promise<VaultFileV1> {
    const stat = await fs.stat(this.vaultPath);
    if (!stat.isFile() || stat.size <= 0 || stat.size > MAX_VAULT_BYTES) {
      throw new Error("The password vault is invalid or too large.");
    }
    return parseVaultFile(await fs.readFile(this.vaultPath, "utf8"));
  }

  private async atomicWrite(file: VaultFileV1, keepBackup: boolean): Promise<void> {
    const directory = path.dirname(this.vaultPath);
    await fs.mkdir(directory, { recursive: true, mode: 0o700 });
    const temporaryPath = `${this.vaultPath}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`;
    const serialized = Buffer.from(JSON.stringify(file, null, 2), "utf8");
    let movedPrimary = false;
    try {
      const handle = await fs.open(temporaryPath, "wx", 0o600);
      try {
        await handle.writeFile(serialized);
        await handle.sync();
      } finally {
        await handle.close();
      }
      if (keepBackup && await this.exists()) {
        await fs.rm(this.backupPath, { force: true });
        await fs.rename(this.vaultPath, this.backupPath);
        movedPrimary = true;
      }
      await fs.rename(temporaryPath, this.vaultPath);
      await fs.chmod(this.vaultPath, 0o600).catch(() => undefined);
    } catch (error) {
      await fs.rm(temporaryPath, { force: true }).catch(() => undefined);
      if (movedPrimary && !(await this.exists())) {
        await fs.copyFile(this.backupPath, this.vaultPath).catch(() => undefined);
      }
      throw error;
    } finally {
      serialized.fill(0);
    }
  }
}

function encryptDocument(vaultKey: Buffer, document: VaultDocument): AesGcmEnvelope {
  validateDocument(document);
  const plaintext = Buffer.from(JSON.stringify(document), "utf8");
  try {
    return encryptAesGcm(vaultKey, plaintext, VAULT_PAYLOAD_AAD);
  } finally {
    plaintext.fill(0);
  }
}

function decryptDocument(vaultKey: Buffer, payload: AesGcmEnvelope): VaultDocument {
  const plaintext = decryptAesGcm(vaultKey, payload, VAULT_PAYLOAD_AAD);
  try {
    return parseDocument(plaintext);
  } finally {
    plaintext.fill(0);
  }
}

function parseDocument(value: Buffer): VaultDocument {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value.toString("utf8"));
  } catch {
    throw new Error("The authenticated vault payload is invalid.");
  }
  validateDocument(parsed);
  return parsed;
}

function validateDocument(value: unknown): asserts value is VaultDocument {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid vault data.");
  const document = value as Partial<VaultDocument>;
  if (document.format !== "ultrax-password-data" || document.version !== 1 || !Array.isArray(document.items) || document.items.length > 10_000) {
    throw new Error("Unsupported vault data format.");
  }
  const ids = new Set<string>();
  for (const item of document.items) {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("Invalid vault item.");
    const candidate = item as Partial<PasswordVaultItem>;
    if (
      candidate.type !== "login" ||
      !isBoundedString(candidate.id, 128, 1) || ids.has(candidate.id) ||
      !isBoundedString(candidate.title, 256, 1) ||
      !Array.isArray(candidate.origins) || candidate.origins.length === 0 || candidate.origins.length > 20 ||
      candidate.origins.some((origin) => !isBoundedString(origin, 2048, 1)) ||
      !isBoundedString(candidate.username, 512, 0) ||
      !isBoundedString(candidate.password, 4096, 1) ||
      (candidate.notes !== undefined && !isBoundedString(candidate.notes, 16_384, 0)) ||
      typeof candidate.favorite !== "boolean" ||
      !Array.isArray(candidate.tags) || candidate.tags.length > 30 ||
      candidate.tags.some((tag) => !isBoundedString(tag, 64, 1)) ||
      !isTimestamp(candidate.createdAt) || !isTimestamp(candidate.updatedAt)
    ) throw new Error("Invalid vault item.");
    ids.add(candidate.id);
  }
}

function parseVaultFile(value: string): VaultFileV1 {
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { throw new Error("The password vault file is not valid JSON."); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid password vault file.");
  const file = parsed as Partial<VaultFileV1>;
  if (file.format !== VAULT_FORMAT || file.version !== 1 || !file.kdf || !file.wrappedVaultKey || !file.payload) {
    throw new Error("Unsupported password vault format.");
  }
  if (file.osWrappedVaultKey !== undefined && !isBoundedString(file.osWrappedVaultKey, 16_384, 1)) {
    throw new Error("Invalid OS-wrapped vault key.");
  }
  return file as VaultFileV1;
}

function parseBackupFile(value: string): BackupFileV1 {
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { throw new Error("The UltraX backup is not valid JSON."); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid UltraX backup.");
  const backup = parsed as Partial<BackupFileV1>;
  if (backup.format !== BACKUP_FORMAT || backup.version !== 1 || !backup.kdf || !backup.payload) {
    throw new Error("Unsupported UltraX backup format.");
  }
  return backup as BackupFileV1;
}

function isBoundedString(value: unknown, maximum: number, minimum: number): value is string {
  return typeof value === "string" && value.length >= minimum && value.length <= maximum;
}

function isTimestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}
