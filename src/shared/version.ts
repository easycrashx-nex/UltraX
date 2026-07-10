export const INTERNAL_RELEASE_VERSION = "1.1.10";
export const VISIBLE_RELEASE_VERSION = "1.1.10-DevU";

export function formatVisibleVersion(version: string): string {
  const normalized = version.trim();
  if (/^1\.1\.10$/i.test(normalized)) return VISIBLE_RELEASE_VERSION;
  if (/^1\.1\.9-fix(?:\.\d+)?$/i.test(normalized)) return "1.1.9-Fix";
  return version;
}

export function isNewerVersion(candidate: string, current: string): boolean {
  const candidateParts = parseVersion(candidate);
  const currentParts = parseVersion(current);
  if (!candidateParts || !currentParts) return false;

  for (let index = 0; index < 3; index += 1) {
    if (candidateParts[index] !== currentParts[index]) {
      return candidateParts[index] > currentParts[index];
    }
  }
  return false;
}

function parseVersion(value: string): [number, number, number] | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(value.trim());
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}
