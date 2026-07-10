export function normalizeHttpOrigin(value: unknown, defaultToHttps = false): string {
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  const candidate = defaultToHttps && !/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? `https://${trimmed}`
    : trimmed;

  try {
    const parsed = new URL(candidate);
    if (
      (parsed.protocol !== "https:" && parsed.protocol !== "http:") ||
      parsed.username ||
      parsed.password ||
      parsed.origin === "null"
    ) {
      return "";
    }
    return parsed.origin;
  } catch {
    return "";
  }
}
