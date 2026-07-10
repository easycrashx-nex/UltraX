import { createHash } from "node:crypto";

export function hashClipboardValue(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function clipboardStillContainsSecret(expectedHash: string | null, currentValue: string): boolean {
  return Boolean(expectedHash) && hashClipboardValue(currentValue) === expectedHash;
}
