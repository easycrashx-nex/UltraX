import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import packageJson from "../package.json" with { type: "json" };

const releaseDir = path.resolve("release");
const version = packageJson.version;

function isCurrentReleaseArtifact(name) {
  return (
    (name.startsWith(`UltraX-Browser-Setup-${version}-`) &&
      name.endsWith(".exe")) ||
    (name.startsWith(`UltraX-Browser-${version}-Portable-`) && name.endsWith(".exe"))
  );
}

function collectTargets(directory) {
  return readdirSync(directory)
    .filter(isCurrentReleaseArtifact)
    .map((name) => path.join(directory, name))
    .filter((filePath) => statSync(filePath).isFile())
    .sort((left, right) => path.basename(left).localeCompare(path.basename(right)));
}

function removeOldChecksumFiles(directory) {
  for (const name of readdirSync(directory)) {
    if (name === "SHA256SUMS.txt" || name.endsWith(".sha256")) {
      unlinkSync(path.join(directory, name));
    }
  }
}

function sha256(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

removeOldChecksumFiles(releaseDir);

const targets = collectTargets(releaseDir);

if (targets.length < 2) {
  throw new Error(`Expected current ${version} installer and portable executable before checksums.`);
}

const setupName = `UltraX-Browser-Setup-${version}-x64.exe`;
if (!readdirSync(releaseDir).includes(`${setupName}.blockmap`)) {
  throw new Error(`Missing electron-builder updater blockmap: ${setupName}.blockmap`);
}
if (!readdirSync(releaseDir).includes("latest.yml")) {
  throw new Error("Missing electron-builder updater metadata: latest.yml");
}

const lines = targets.map((target) => {
  const hash = sha256(target);
  const fileName = path.basename(target);
  writeFileSync(path.join(releaseDir, `${fileName}.sha256`), `${hash}  ${fileName}\n`, "utf8");
  return `${hash}  ${fileName}`;
});

writeFileSync(path.join(releaseDir, "SHA256SUMS.txt"), `${lines.join("\n")}\n`, "utf8");

console.log(`Wrote SHA256 checksums for ${targets.length} release artifact(s).`);
