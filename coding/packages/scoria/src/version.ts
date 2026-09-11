import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { isRecord } from "./package-json.ts";

/**
 * scoria's own version, read from its manifest rather than written in the source.
 *
 * It reaches the SARIF a repository uploads, so a stale constant would misattribute findings to a
 * release that never produced them. Two places to update is one place too many.
 */
const manifest = join(dirname(fileURLToPath(import.meta.url)), "..", "package.json");

const readVersion = (): string => {
  try {
    const parsed: unknown = JSON.parse(readFileSync(manifest, "utf8"));
    const version = isRecord(parsed) ? parsed["version"] : undefined;
    return typeof version === "string" ? version : "0.0.0";
  } catch {
    return "0.0.0";
  }
};

export const SCORIA_VERSION = readVersion();
