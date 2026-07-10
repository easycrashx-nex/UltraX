import { existsSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";

const releaseDir = path.resolve("release");
if (existsSync(releaseDir)) {
  for (const entry of readdirSync(releaseDir)) rmSync(path.join(releaseDir, entry), { recursive: true, force: true });
}
console.log(`Cleaned generated release output: ${releaseDir}`);
