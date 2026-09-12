import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * 版は manifest から読む。定数に書くと、上げ忘れたまま古い版を名乗るものが出る。
 * SARIF の tool.version がそれで、指摘を出していない版に指摘が紐づく。
 */
const MANIFEST = join(dirname(fileURLToPath(import.meta.url)), "..", "package.json");

const versionOf = (raw: unknown): string =>
  typeof raw === "object" && raw !== null && "version" in raw && typeof raw.version === "string" ? raw.version : "0.0.0";

export const VERSION = versionOf(JSON.parse(readFileSync(MANIFEST, "utf8")));
