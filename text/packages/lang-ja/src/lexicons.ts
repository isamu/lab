import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parse } from "yaml";
import type { Lexicon, LexiconEntry } from "chaffjs/plugin";

const DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "lexicons");

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const POSITIONS = ["before", "after"] as const;

const toEntry = (raw: unknown): LexiconEntry | undefined => {
  if (!isRecord(raw) || typeof raw["pattern"] !== "string") return undefined;
  const weight = raw["weight"];
  const instead = raw["instead_of"];
  const rewrite = raw["rewrite"];
  return {
    pattern: raw["pattern"],
    weight: typeof weight === "number" ? weight : undefined,
    instead_of: typeof instead === "string" ? instead : undefined,
    position: POSITIONS.find((position) => position === raw["position"]),
    rewrite: typeof rewrite === "string" ? rewrite : undefined,
  };
};

/**
 * 語彙表はアダプタが持つ。detector は共通で、これだけが言語別。spec §11。
 * 新しい言語のサポートは、ここを書くところから始まる。
 */
export const loadLexicons = (dir: string = DIR): Record<string, Lexicon> =>
  Object.fromEntries(
    readdirSync(dir)
      .filter((file) => file.endsWith(".yaml"))
      .flatMap((file): [string, Lexicon][] => {
        const raw: unknown = parse(readFileSync(join(dir, file), "utf8"));
        if (!isRecord(raw) || typeof raw["id"] !== "string" || !Array.isArray(raw["entries"])) return [];
        return [[raw["id"], raw["entries"].map(toEntry).filter((entry) => entry !== undefined)]];
      }),
  );
