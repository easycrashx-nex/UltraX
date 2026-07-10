const URL_PATTERN = /https?:\/\/[^\s]+/gi;

export function formatUpdateError(error: unknown): string {
  const raw = error instanceof Error ? error.message : "Update operation failed.";
  const normalized = raw.toLowerCase();

  if (normalized.includes("latest.yml") && (normalized.includes("missing") || normalized.includes("cannot find") || normalized.includes("not found"))) {
    return "latest.yml is missing from the official GitHub Release. Use the manual installer fallback or retry after the release is repaired.";
  }

  if (normalized.includes("checksum") || normalized.includes("sha512")) {
    return "Integrity check failed; the downloaded update was not installed. Retry the download or use the manual installer fallback.";
  }

  if (
    normalized.includes("err_internet_disconnected") ||
    normalized.includes("enotfound") ||
    normalized.includes("econnreset") ||
    normalized.includes("network") ||
    normalized.includes("timed out")
  ) {
    return "UltraX could not reach the update service. Check your internet connection and retry.";
  }

  return redactUrls(raw).slice(0, 1000);
}

function redactUrls(value: string): string {
  return value.replace(URL_PATTERN, (candidate) => {
    try {
      const url = new URL(candidate);
      url.username = "";
      url.password = "";
      url.search = "";
      url.hash = "";
      return url.toString();
    } catch {
      return "[redacted update URL]";
    }
  });
}
