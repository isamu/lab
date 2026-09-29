import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * 版は manifest から読む。定数に書くと、上げ忘れたまま古い版を名乗るものが出る。
 * SARIF の tool.version がそれで、指摘を出していない版に指摘が紐づく。
 */
const MANIFEST = join(dirname(fileURLToPath(import.meta.url)), "..", "package.json");

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const versionOf = (raw: unknown): string => (isRecord(raw) && typeof raw["version"] === "string" ? raw["version"] : "0.0.0");

const BUNDLED = /^@chaffjs\/lang-/u;

/**
 * `chaff --version` の行。chaffjs と、同梱の言語パッケージ。chaffjs は言語パッケージをちょうどの版で依存に書くので、manifest がそのまま答え。
 */
export const versionLines = (raw: unknown): string[] => {
  const dependencies = isRecord(raw) && isRecord(raw["dependencies"]) ? raw["dependencies"] : {};
  const bundled = Object.entries(dependencies)
    .filter((entry): entry is [string, string] => BUNDLED.test(entry[0]) && typeof entry[1] === "string")
    .toSorted(([left], [right]) => left.localeCompare(right))
    .map(([name, version]) => `${name} ${version}`);
  return [`chaffjs ${versionOf(raw)}`, ...bundled];
};

const manifest: unknown = JSON.parse(readFileSync(MANIFEST, "utf8"));

export const VERSION = versionOf(manifest);
export const VERSION_LINES = versionLines(manifest);
