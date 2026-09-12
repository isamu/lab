import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parse } from "yaml";
import type { Lexicon, LexiconEntry } from "chaffjs/plugin";

const DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "lexicons");

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const toEntry = (raw: unknown): LexiconEntry | undefined => {
  if (!isRecord(raw) || typeof raw["pattern"] !== "string") return undefined;
  const weight = raw["weight"];
  const instead = raw["instead_of"];
  return {
    pattern: raw["pattern"],
    weight: typeof weight === "number" ? weight : undefined,
    instead_of: typeof instead === "string" ? instead : undefined,
  };
};

/**
 * 語彙表はアダプタが持つ。detector は共通で、これだけが言語別。spec §11。
 * 新しい言語のサポートは、ここを書くところから始まる。
 */
export const loadLexicons = (dir: string = DIR): Record<string, Lexicon> =>
  readdirSync(dir)
    .filter((file) => file.endsWith(".yaml"))
    .reduce<Record<string, Lexicon>>((acc, file) => {
      const raw: unknown = parse(readFileSync(join(dir, file), "utf8"));
      if (!isRecord(raw) || typeof raw["id"] !== "string" || !Array.isArray(raw["entries"])) return acc;
      const entries = raw["entries"].map(toEntry).filter((entry) => entry !== undefined);
      return { ...acc, [raw["id"]]: entries };
    }, {});
