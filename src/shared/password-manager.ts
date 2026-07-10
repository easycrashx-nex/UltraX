export type PasswordManagerAutoLockMinutes = 0 | 1 | 5 | 15 | 30 | 60;
export type PasswordClipboardClearSeconds = 0 | 15 | 30 | 60;

export type PasswordGeneratorSettings = {
  length: number;
  uppercase: boolean;
  lowercase: boolean;
  digits: boolean;
  symbols: boolean;
  avoidAmbiguous: boolean;
};

export type PasswordManagerSettings = {
  offerToSavePasswords: boolean;
  offerToUpdatePasswords: boolean;
  offerAutofill: boolean;
  autofillUsername: boolean;
  requireUserGestureForPassword: boolean;
  requireVaultUnlock: boolean;
  allowInsecureHttpAutofill: boolean;
  neverSaveOrigins: string[];
  autoLockMinutes: PasswordManagerAutoLockMinutes;
  lockOnAppClose: boolean;
  lockOnAllWindowsClosed: boolean;
  lockOnScreenLock: boolean;
  lockOnSleep: boolean;
  clipboardClearSeconds: PasswordClipboardClearSeconds;
  generator: PasswordGeneratorSettings;
};

export type PasswordManagerStatus = {
  state: "setup-required" | "locked" | "unlocked" | "corrupted";
  quickUnlockAvailable: boolean;
  quickUnlockConfigured: boolean;
  itemCount: number | null;
  retryAfterMs?: number;
};

export type PasswordVaultItemInput = {
  title: string;
  origins: string[];
  username: string;
  password: string;
  notes?: string;
  favorite: boolean;
  tags: string[];
};

export type PasswordVaultItemUpdate = Omit<PasswordVaultItemInput, "password"> & {
  password?: string;
};

export type PasswordVaultItemDisplay = {
  id: string;
  type: "login";
  title: string;
  origins: string[];
  username: string;
  notes?: string;
  favorite: boolean;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  lastUsedAt?: number;
  passwordChangedAt?: number;
  passwordLength: number;
};

export type PasswordHealthSummary = {
  total: number;
  weak: number;
  reused: number;
  duplicateLogins: number;
  old: number;
  insecureOrigins: number;
  missingUsername: number;
  analyzedLocally: true;
};

export type PasswordImportSummary = {
  imported: number;
  skipped: number;
  failed: number;
  sourceFileName: string;
};

export type PasswordBackupResult = {
  path: string;
  itemCount: number;
};

export type PasswordFillRequest = {
  itemId: string;
  tabId: string;
};

export type PasswordFillResult = {
  filledUsername: boolean;
  filledPassword: boolean;
  origin: string;
};

export type PasswordPageMessage =
  | {
      kind: "candidate-submitted";
      origin: string;
      actionOrigin: string;
      username: string;
      password: string;
    }
  | {
      kind: "field-focused";
      origin: string;
      field: "username" | "password";
    }
  | {
      kind: "login-transition";
      origin: string;
      likelySuccess: boolean;
    };

export type PasswordPromptSnapshot = {
  promptId: string;
  action: "save" | "update";
  origin: string;
  username: string;
  passwordLength: number;
  vaultLocked: boolean;
};

export type PasswordAutofillSuggestion = {
  itemId: string;
  title: string;
  username: string;
  origin: string;
};

export type PasswordAutofillSnapshot = {
  tabId: string;
  origin: string;
  vaultLocked: boolean;
  suggestions: PasswordAutofillSuggestion[];
};

export type PasswordPromptAction = "save" | "update" | "dismiss" | "never-save";
