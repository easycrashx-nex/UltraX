import type { WebFrameMain } from "electron";
import { normalizeCredentialOrigin } from "./origin";

type CredentialFrame = Pick<WebFrameMain, "url" | "executeJavaScript">;

export async function executeInBoundCredentialFrame<T>(
  frame: CredentialFrame,
  expectedOrigin: string,
  javaScript: string,
): Promise<T> {
  assertCredentialFrameOrigin(frame, expectedOrigin);
  const result = await frame.executeJavaScript(javaScript, true) as T;
  assertCredentialFrameOrigin(frame, expectedOrigin);
  return result;
}

export function assertCredentialFrameOrigin(
  frame: Pick<WebFrameMain, "url">,
  expectedOrigin: string,
): void {
  const actualOrigin = normalizeCredentialOrigin(frame.url);
  if (!actualOrigin || actualOrigin !== expectedOrigin) {
    throw new Error("The active website navigated during password fill.");
  }
}
