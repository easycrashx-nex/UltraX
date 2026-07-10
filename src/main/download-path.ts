import path from "node:path";

const WINDOWS_DEVICE_NAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;
const MAX_FILENAME_LENGTH = 180;

export function sanitizeDownloadFilename(value: unknown): string {
  const raw = typeof value === "string" ? value : "";
  const leaf = raw.split(/[\\/]/).pop() ?? "";
  let filename = leaf
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/g, "_")
    .replace(/[. ]+$/g, "")
    .trim();

  if (!filename || filename === "." || filename === "..") {
    filename = "download";
  }
  if (WINDOWS_DEVICE_NAME.test(filename)) {
    filename = `_${filename}`;
  }
  if (filename.length > MAX_FILENAME_LENGTH) {
    const extension = path.win32.extname(filename).slice(0, 20);
    filename = `${filename.slice(0, MAX_FILENAME_LENGTH - extension.length)}${extension}`;
  }
  return filename || "download";
}

export function resolveSafeDownloadPath(
  downloadDirectory: string,
  suggestedFilename: unknown,
): { filename: string; savePath: string } {
  const root = path.resolve(downloadDirectory);
  const filename = sanitizeDownloadFilename(suggestedFilename);
  const savePath = path.resolve(root, filename);
  if (path.dirname(savePath).toLowerCase() !== root.toLowerCase()) {
    throw new Error("Download path escapes the configured download folder.");
  }
  return { filename, savePath };
}
