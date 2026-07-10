const PROTOTYPE_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export function isPrototypePollutionKey(value: string): boolean {
  return PROTOTYPE_KEYS.has(value.toLowerCase());
}

export function isValidExtensionId(value: string): boolean {
  return /^[a-z0-9][a-z0-9-_.]{2,79}$/.test(value) && !isPrototypePollutionKey(value);
}

export function isValidExtensionStorageKey(value: string): boolean {
  return /^[a-zA-Z0-9_.:-]{1,80}$/.test(value) && !isPrototypePollutionKey(value);
}

export function createSafeRecord<T>(): Record<string, T> {
  return Object.create(null) as Record<string, T>;
}
