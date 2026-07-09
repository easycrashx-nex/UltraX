import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { ExtensionPanelDescriptor, InstalledExtension } from "../shared/types";
import { resolveBundledExtensionsPath } from "./extension-store";

const MAX_PANEL_HTML_BYTES = 512 * 1024;
const MAX_PANEL_SCRIPT_BYTES = 192 * 1024;

export function createExtensionPanelDescriptor(extension: InstalledExtension): ExtensionPanelDescriptor {
  if (!extension.manifest.panel) {
    throw new Error("This extension does not provide a sidebar panel.");
  }

  const basePath = resolveExtensionBasePath(extension);
  const panelPath = resolveExtensionFile(basePath, extension.manifest.panel);
  const htmlBuffer = fs.readFileSync(panelPath);
  if (htmlBuffer.byteLength > MAX_PANEL_HTML_BYTES) {
    throw new Error("Extension panel is too large.");
  }

  return {
    extensionId: extension.id,
    title: extension.manifest.name,
    html: wrapPanelHtml(extension, basePath, inlineLocalScripts(basePath, htmlBuffer.toString("utf8"))),
    canReload: extension.source === "local" || extension.developerMode,
  };
}

export function resolveExtensionBasePath(extension: InstalledExtension): string {
  if (extension.source === "builtin") {
    return path.join(resolveBundledExtensionsPath(), extension.id);
  }

  if (!extension.installPath) {
    throw new Error("Extension install path is missing.");
  }

  return path.resolve(extension.installPath);
}

function resolveExtensionFile(basePath: string, relativePath: string): string {
  if (path.isAbsolute(relativePath) || relativePath.includes("..")) {
    throw new Error("Extension file path is invalid.");
  }

  const resolvedBase = path.resolve(basePath);
  const resolved = path.resolve(resolvedBase, relativePath);
  if (!resolved.startsWith(`${resolvedBase}${path.sep}`)) {
    throw new Error("Extension file path escapes the extension folder.");
  }

  if (!fs.existsSync(resolved)) {
    throw new Error("Extension panel file is missing.");
  }

  return resolved;
}

function wrapPanelHtml(
  extension: InstalledExtension,
  basePath: string,
  panelHtml: string,
): string {
  const baseUrl = `${pathToFileURL(`${path.resolve(basePath)}${path.sep}`).toString()}`;
  const headInjection = [
    `<base href="${escapeHtmlAttribute(baseUrl)}">`,
    `<script>${createBridgeScript(extension.id)}</script>`,
  ].join("");

  if (/<head[\s>]/i.test(panelHtml)) {
    return panelHtml.replace(/<head([^>]*)>/i, `<head$1>${headInjection}`);
  }

  return `<!doctype html><html><head>${headInjection}</head><body>${panelHtml}</body></html>`;
}

function inlineLocalScripts(basePath: string, html: string): string {
  return html.replace(
    /<script\b([^>]*)\bsrc=["']([^"']+)["']([^>]*)>\s*<\/script>/gi,
    (match, before: string, scriptSource: string, after: string) => {
      if (/^(https?:|data:|blob:|file:)/i.test(scriptSource)) {
        return match;
      }

      try {
        const scriptPath = resolveExtensionFile(basePath, scriptSource);
        const scriptBuffer = fs.readFileSync(scriptPath);
        if (scriptBuffer.byteLength > MAX_PANEL_SCRIPT_BYTES) {
          throw new Error("Extension panel script is too large.");
        }

        const script = scriptBuffer
          .toString("utf8")
          .replace(/<\/script/gi, "<\\/script");
        return `<script${before}${after}>${script}\n//# sourceURL=${escapeScriptSourceUrl(scriptSource)}</script>`;
      } catch {
        return `<script>window.parent.postMessage({type:"ultrax-extension-log",level:"error",message:"Extension panel script could not be loaded."},"*");</script>`;
      }
    },
  );
}

function createBridgeScript(extensionId: string): string {
  const id = JSON.stringify(extensionId);
  return `
(() => {
  const extensionId = ${id};
  let nextRequestId = 1;
  const pending = new Map();

  const request = (method, args = []) => new Promise((resolve, reject) => {
    const requestId = String(nextRequestId++);
    pending.set(requestId, { resolve, reject });
    window.parent.postMessage({
      type: "ultrax-api-request",
      extensionId,
      requestId,
      method,
      args,
    }, "*");
  });

  const log = (level, message) => {
    window.parent.postMessage({
      type: "ultrax-extension-log",
      extensionId,
      level,
      message: String(message || "").slice(0, 280),
    }, "*");
  };

  window.addEventListener("message", (event) => {
    const message = event.data;
    if (!message || message.type !== "ultrax-api-response") {
      return;
    }

    const item = pending.get(String(message.requestId));
    if (!item) {
      return;
    }

    pending.delete(String(message.requestId));
    if (message.ok) {
      item.resolve(message.result);
    } else {
      item.reject(new Error(message.error || "UltraX extension API call failed."));
    }
  });

  window.addEventListener("error", (event) => {
    log("error", event.message || "Unhandled extension panel error.");
  });

  window.addEventListener("unhandledrejection", (event) => {
    log("error", event.reason && event.reason.message ? event.reason.message : event.reason);
  });

  Object.defineProperty(window, "ultrax", {
    value: Object.freeze({
      extensions: Object.freeze({
        getSelf: () => request("extensions.getSelf"),
      }),
      storage: Object.freeze({
        get: (key) => request("storage.get", [key]),
        set: (key, value) => request("storage.set", [key, value]),
        remove: (key) => request("storage.remove", [key]),
        clear: () => request("storage.clear"),
      }),
      tabs: Object.freeze({
        getActive: () => request("tabs.getActive"),
        query: () => request("tabs.query"),
      }),
      notifications: Object.freeze({
        show: (input) => request("notifications.show", [input]),
      }),
      sidebar: Object.freeze({
        open: () => request("sidebar.open"),
        close: () => request("sidebar.close"),
      }),
    }),
    configurable: false,
    enumerable: true,
    writable: false,
  });
})();
`;
}

function escapeHtmlAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function escapeScriptSourceUrl(value: string): string {
  return value.replace(/[\r\n]/g, "").replace(/\\/g, "/");
}
