const REVIEWED_AFFILIATIONS: ReadonlyArray<readonly [string, string]> = [
  ["https://www.youtube.com", "https://accounts.google.com"],
  ["https://youtube.com", "https://accounts.google.com"],
];

export function areCredentialOriginsAffiliated(left: string, right: string): boolean {
  if (left === right) return true;
  return REVIEWED_AFFILIATIONS.some(
    ([service, login]) => (left === service && right === login) || (left === login && right === service),
  );
}
