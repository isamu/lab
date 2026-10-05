import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Every read of a file this package ships (lexicons, the word list) goes through here, so a build without a file
// system can put its own reads in this module's place.

/** The package's folder: src/ and dist/ both sit right under it. */
export const PACKAGE_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");

/** node:path join, for the paths read here. */
export const joinPath = (...parts: readonly string[]): string => join(...parts);

export const readText = (path: string): string => readFileSync(path, "utf8");

export const readDir = (path: string): string[] => readdirSync(path);
