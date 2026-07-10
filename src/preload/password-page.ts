import { ipcRenderer } from "electron";
import { IPC } from "../shared/ipc";
import type { PasswordPageMessage } from "../shared/password-manager";

// This preload is intentionally one-way. It reports narrowly classified form
// events to the main process and exposes no password API to the website.
if (window.top === window) {
  const isVisible = (element: HTMLInputElement): boolean => {
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0 && !element.disabled;
  };

  const send = (message: PasswordPageMessage): void => {
    ipcRenderer.send(IPC.passwordManagerPageMessage, message);
  };

  const readUsername = (scope: ParentNode): HTMLInputElement | null => {
    const candidates = Array.from(scope.querySelectorAll<HTMLInputElement>(
      'input[autocomplete="username"], input[type="email"], input[name*="user" i], input[name*="email" i], input[type="text"]',
    )).filter(isVisible);
    return candidates.find((input) => !/one-time|otp|code|token/i.test(`${input.name} ${input.autocomplete}`)) ?? null;
  };

  const readPassword = (scope: ParentNode): HTMLInputElement | null => {
    const candidates = Array.from(scope.querySelectorAll<HTMLInputElement>('input[type="password"]')).filter(isVisible);
    return candidates.find((input) => input.autocomplete !== "new-password" && !/confirm|repeat|new-password/i.test(`${input.name} ${input.id} ${input.autocomplete}`)) ?? null;
  };

  const captureCandidate = (form: HTMLFormElement | null, passwordInput?: HTMLInputElement): void => {
    const scope = form ?? document;
    const password = passwordInput ?? readPassword(scope);
    if (!password || !password.value || password.autocomplete === "new-password") return;
    const username = readUsername(form ?? document);
    if (!username?.value.trim()) return;
    let actionOrigin = location.origin;
    try {
      actionOrigin = new URL(form?.action || location.href).origin;
    } catch {
      return;
    }
    send({
      kind: "candidate-submitted",
      origin: location.origin,
      actionOrigin,
      username: username.value.slice(0, 512),
      password: password.value.slice(0, 4096),
    });
    window.setTimeout(() => {
      const visiblePassword = readPassword(document);
      const errorText = document.body?.innerText?.slice(0, 4000) ?? "";
      send({
        kind: "login-transition",
        origin: location.origin,
        likelySuccess: !visiblePassword && !/invalid password|incorrect password|try again|wrong password/i.test(errorText),
      });
    }, 1200);
  };

  document.addEventListener("submit", (event) => {
    const form = event.target instanceof HTMLFormElement ? event.target : null;
    captureCandidate(form);
  }, true);

  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const submit = target?.closest<HTMLButtonElement>('button[type="submit"], input[type="submit"]');
    if (submit) captureCandidate(submit.form, undefined);
  }, true);

  document.addEventListener("focusin", (event) => {
    const input = event.target instanceof HTMLInputElement ? event.target : null;
    if (!input || !isVisible(input)) return;
    const field = input.type === "password" ? "password" : input.autocomplete === "username" || input.type === "email" || /user|email/i.test(`${input.name} ${input.id}`) ? "username" : null;
    if (!field) return;
    send({ kind: "field-focused", origin: location.origin, field });
  }, true);
}
