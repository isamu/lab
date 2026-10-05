import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Every read of a file chaff ships (rules, genres, profiles, styles) goes through here, so a build without a file
// system can put its own reads in this module's place. The functions take any path, as the callers always have.

/** The package's folder: src/ and dist/ both sit right under it. */
export const PACKAGE_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");

export const readText = (path: string): string => readFileSync(path, "utf8");

export const readDir = (path: string): string[] => readdirSync(path);

export const exists = (path: string): boolean => existsSync(path);
