export function normalizeCredentialOrigin(value: string): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 2048) {
    throw new Error("Enter a valid HTTP or HTTPS website origin.");
  }
  let url: URL;
  try {
    url = new URL(value.includes("://") ? value : `https://${value}`);
  } catch {
    throw new Error("Enter a valid HTTP or HTTPS website origin.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Only HTTP and HTTPS website origins are supported.");
  }
  if (url.username || url.password || !url.hostname) {
    throw new Error("Website origins cannot include credentials.");
  }
  return url.origin;
}

export function originsMatch(savedOrigin: string, currentOrigin: string): boolean {
  try {
    return normalizeCredentialOrigin(savedOrigin) === normalizeCredentialOrigin(currentOrigin);
  } catch {
    return false;
  }
}

export function isSecureCredentialOrigin(origin: string): boolean {
  try {
    return new URL(normalizeCredentialOrigin(origin)).protocol === "https:";
  } catch {
    return false;
  }
}
