import { randomUUID } from "node:crypto";
import { parse } from "csv-parse/sync";
import type { PasswordVaultItem } from "./vault-store";
import { normalizeCredentialOrigin } from "./origin";

export type ParsedPasswordImport = {
  items: PasswordVaultItem[];
  skipped: number;
  failed: number;
};

const MAX_IMPORT_ROWS = 10_000;

export function parsePasswordCsv(value: string, now = Date.now()): ParsedPasswordImport {
  if (typeof value !== "string" || value.length === 0 || value.length > 5 * 1024 * 1024) {
    throw new Error("The password CSV must be between 1 byte and 5 MB.");
  }
  let records: Record<string, string>[];
  try {
    records = parse(value, {
      bom: true,
      columns: (headers: string[]) => headers.map(normalizeHeader),
      relax_column_count: true,
      skip_empty_lines: true,
      trim: true,
      max_record_size: 32 * 1024,
      to: MAX_IMPORT_ROWS + 1,
    }) as Record<string, string>[];
  } catch {
    throw new Error("The selected file is not a valid password CSV.");
  }
  if (records.length > MAX_IMPORT_ROWS) throw new Error("The password CSV contains too many rows.");

  const items: PasswordVaultItem[] = [];
  let skipped = 0;
  let failed = 0;
  const seen = new Set<string>();
  for (const record of records) {
    try {
      const rawOrigin = field(record, ["url", "origin", "website", "site", "login_uri"]);
      const password = field(record, ["password", "pass"]);
      if (!rawOrigin || !password) {
        skipped += 1;
        continue;
      }
      if (password.length > 4096) throw new Error("Password is too long.");
      const origin = normalizeCredentialOrigin(rawOrigin);
      const username = field(record, ["username", "login", "email", "user"]).slice(0, 512);
      const dedupeKey = `${origin}\n${username}\n${password}`;
      if (seen.has(dedupeKey)) {
        skipped += 1;
        continue;
      }
      seen.add(dedupeKey);
      const title = field(record, ["name", "title"]) || new URL(origin).hostname;
      const notes = field(record, ["note", "notes", "extra"]).slice(0, 16_384);
      const tags = field(record, ["tags", "folder"])
        .split(/[;,]/)
        .map((tag) => tag.trim())
        .filter(Boolean)
        .slice(0, 30)
        .map((tag) => tag.slice(0, 64));
      items.push({
        id: randomUUID(),
        type: "login",
        title: title.slice(0, 256),
        origins: [origin],
        username,
        password,
        notes: notes || undefined,
        favorite: /^(1|true|yes)$/i.test(field(record, ["favorite", "favourite"])),
        tags,
        createdAt: now,
        updatedAt: now,
        passwordChangedAt: now,
      });
    } catch {
      failed += 1;
    }
  }
  return { items, skipped, failed };
}

function normalizeHeader(value: string): string {
  return String(value).trim().toLowerCase().replace(/[\s-]+/g, "_").slice(0, 80);
}

function field(record: Record<string, string>, names: string[]): string {
  for (const name of names) {
    const value = record[name];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}
