import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scrypt as nodeScrypt,
} from "node:crypto";

export type VaultKdf = {
  name: "scrypt";
  salt: string;
  N: number;
  r: number;
  p: number;
  keyLength: 32;
};

export type AesGcmEnvelope = {
  algorithm: "aes-256-gcm";
  nonce: string;
  ciphertext: string;
  authTag: string;
};

export const DEFAULT_KDF_PARAMETERS = {
  N: 131_072,
  r: 8,
  p: 1,
  keyLength: 32 as const,
};

const MAX_KDF_MEMORY = 192 * 1024 * 1024;

export function createVaultKdf(
  parameters: Partial<Omit<VaultKdf, "name" | "salt">> = {},
): VaultKdf {
  return {
    name: "scrypt",
    salt: randomBytes(16).toString("base64"),
    N: parameters.N ?? DEFAULT_KDF_PARAMETERS.N,
    r: parameters.r ?? DEFAULT_KDF_PARAMETERS.r,
    p: parameters.p ?? DEFAULT_KDF_PARAMETERS.p,
    keyLength: 32,
  };
}

export async function deriveMasterKey(password: string, kdf: VaultKdf): Promise<Buffer> {
  validateKdf(kdf);
  if (typeof password !== "string" || password.length === 0 || password.length > 1024) {
    throw new Error("Invalid vault credentials.");
  }
  const salt = decodeBase64(kdf.salt, 16, "KDF salt");
  try {
    return await new Promise<Buffer>((resolve, reject) => {
      nodeScrypt(password, salt, kdf.keyLength, {
        N: kdf.N,
        r: kdf.r,
        p: kdf.p,
        maxmem: MAX_KDF_MEMORY,
      }, (error, key) => {
        if (error) reject(error);
        else resolve(key);
      });
    });
  } finally {
    salt.fill(0);
  }
}

export function encryptAesGcm(key: Buffer, plaintext: Buffer, aad: string): AesGcmEnvelope {
  validateKey(key);
  const nonce = randomBytes(12);
  try {
    const cipher = createCipheriv("aes-256-gcm", key, nonce, { authTagLength: 16 });
    cipher.setAAD(Buffer.from(aad, "utf8"));
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return {
      algorithm: "aes-256-gcm",
      nonce: nonce.toString("base64"),
      ciphertext: ciphertext.toString("base64"),
      authTag: authTag.toString("base64"),
    };
  } finally {
    nonce.fill(0);
  }
}

export function decryptAesGcm(key: Buffer, envelope: AesGcmEnvelope, aad: string): Buffer {
  validateKey(key);
  validateEnvelope(envelope);
  const nonce = decodeBase64(envelope.nonce, 12, "AES-GCM nonce");
  const authTag = decodeBase64(envelope.authTag, 16, "AES-GCM auth tag");
  const ciphertext = decodeBase64(envelope.ciphertext, undefined, "AES-GCM ciphertext");
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, nonce, { authTagLength: 16 });
    decipher.setAAD(Buffer.from(aad, "utf8"));
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    throw new Error("Vault authentication failed.");
  } finally {
    nonce.fill(0);
    authTag.fill(0);
    ciphertext.fill(0);
  }
}

export function decodeBase64(value: string, expectedLength?: number, label = "value"): Buffer {
  if (typeof value !== "string" || value.length === 0 || value.length > 48 * 1024 * 1024) {
    throw new Error(`Invalid ${label}.`);
  }
  const result = Buffer.from(value, "base64");
  if (result.toString("base64") !== value || (expectedLength !== undefined && result.length !== expectedLength)) {
    result.fill(0);
    throw new Error(`Invalid ${label}.`);
  }
  return result;
}

export function validateKdf(kdf: VaultKdf): void {
  if (
    !kdf ||
    kdf.name !== "scrypt" ||
    kdf.keyLength !== 32 ||
    !Number.isInteger(kdf.N) ||
    kdf.N < 16_384 ||
    kdf.N > 262_144 ||
    (kdf.N & (kdf.N - 1)) !== 0 ||
    !Number.isInteger(kdf.r) ||
    kdf.r < 8 ||
    kdf.r > 16 ||
    !Number.isInteger(kdf.p) ||
    kdf.p < 1 ||
    kdf.p > 4
  ) {
    throw new Error("Unsupported vault KDF parameters.");
  }
  const salt = decodeBase64(kdf.salt, 16, "KDF salt");
  salt.fill(0);
}

function validateEnvelope(envelope: AesGcmEnvelope): void {
  if (!envelope || envelope.algorithm !== "aes-256-gcm") {
    throw new Error("Unsupported encryption envelope.");
  }
}

function validateKey(key: Buffer): void {
  if (!Buffer.isBuffer(key) || key.length !== 32) {
    throw new Error("Invalid encryption key.");
  }
}
