import { randomInt } from "node:crypto";
import type { PasswordGeneratorSettings } from "../../shared/password-manager";

const CHARACTER_GROUPS = {
  uppercase: "ABCDEFGHJKLMNPQRSTUVWXYZ",
  lowercase: "abcdefghijkmnopqrstuvwxyz",
  digits: "23456789",
  symbols: "!@#$%^&*()-_=+[]{};:,.?",
};

const AMBIGUOUS = new Set("Il1O0|`'\"");

export function generatePassword(options: PasswordGeneratorSettings): string {
  const length = Math.trunc(options.length);
  if (length < 8 || length > 128) throw new Error("Password length must be between 8 and 128.");
  const groups = (["uppercase", "lowercase", "digits", "symbols"] as const)
    .filter((key) => options[key])
    .map((key) => CHARACTER_GROUPS[key])
    .map((characters) => options.avoidAmbiguous
      ? [...characters].filter((character) => !AMBIGUOUS.has(character)).join("")
      : characters)
    .filter(Boolean);
  if (groups.length === 0) throw new Error("Select at least one character group.");
  if (length < groups.length) throw new Error("Password length is too short for the selected groups.");

  const result = groups.map((group) => pick(group));
  const alphabet = groups.join("");
  while (result.length < length) result.push(pick(alphabet));
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result.join("");
}

function pick(characters: string): string {
  return characters[randomInt(characters.length)];
}
