import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import packageJson from "../package.json" with { type: "json" };

const expectedVersion = packageJson.version;
const tag = process.argv.find((value) => value.startsWith("--tag="))?.slice(6) ?? process.env.GITHUB_REF_NAME;
if (expectedVersion !== "1.1.9") throw new Error(`Release validation requires package version 1.1.9, got ${expectedVersion}.`);
if (tag && tag !== "v1.1.9") throw new Error(`Release validation requires tag v1.1.9, got ${tag}.`);

const releaseDir = path.resolve(process.env.ULTRAX_RELEASE_DIR ?? "release");
const staleArtifacts = readdirNames(releaseDir).filter((name) => /UltraX-Browser-(?:Setup-)?1\.(?:0|1)\.(?:[0-8]|10)-/.test(name));
if (staleArtifacts.length > 0) throw new Error(`Release directory contains artifacts from another version: ${staleArtifacts.join(", ")}`);
const setup = `UltraX-Browser-Setup-${expectedVersion}-x64.exe`;
const portable = `UltraX-Browser-${expectedVersion}-Portable-x64.exe`;
const required = [setup, `${setup}.blockmap`, "latest.yml", portable, `${setup}.sha256`, `${portable}.sha256`, "SHA256SUMS.txt"];
for (const name of required) {
  const filePath = path.join(releaseDir, name);
  if (!existsSync(filePath) || statSync(filePath).size === 0) throw new Error(`Missing or empty release artifact: ${name}`);
}

const latest = readFileSync(path.join(releaseDir, "latest.yml"), "utf8");
if (!/^version:\s*1\.1\.9\s*$/m.test(latest)) throw new Error("latest.yml does not describe v1.1.9.");
const latestUrl = latest.split(/\r?\n/).find((line) => line.includes("url:"))?.match(/url:\s*(\S+)/)?.[1];
if (latestUrl !== setup) throw new Error("latest.yml installer name does not match the NSIS artifact.");
const expectedSha512 = createHash("sha512").update(readFileSync(path.join(releaseDir, setup))).digest("base64");
const metadataSha512 = latest.match(/^\s*sha512:\s*(\S+)\s*$/m)?.[1];
if (metadataSha512 !== expectedSha512) throw new Error("latest.yml SHA-512 does not match the installer.");
if (/1\.1\.8|1\.1\.10|v1\.1\.8|v1\.1\.10/.test(latest)) throw new Error("latest.yml contains a wrong version reference.");

const appUpdatePath = path.join(releaseDir, "win-unpacked", "resources", "app-update.yml");
if (existsSync(appUpdatePath)) {
  const appUpdate = readFileSync(appUpdatePath, "utf8");
  if (!/^provider:\s*github\s*$/m.test(appUpdate) || !/^owner:\s*easycrashx-nex\s*$/m.test(appUpdate) || !/^repo:\s*UltraX\s*$/m.test(appUpdate)) {
    throw new Error("app-update.yml does not point to easycrashx-nex/UltraX.");
  }
}

const sums = readFileSync(path.join(releaseDir, "SHA256SUMS.txt"), "utf8");
for (const name of [setup, portable]) {
  const hash = createHash("sha256").update(readFileSync(path.join(releaseDir, name))).digest("hex");
  const individual = readFileSync(path.join(releaseDir, `${name}.sha256`), "utf8");
  if (!individual.startsWith(`${hash}  ${name}`) || !sums.includes(`${hash}  ${name}`)) throw new Error(`SHA-256 checksum mismatch for ${name}.`);
}

console.log(`Release assets valid for v${expectedVersion}: ${required.join(", ")}`);

function readdirNames(directory) {
  return existsSync(directory) ? readdirSync(directory) : [];
}
