import { parse } from "yaml";
import type { Lexicon, LexiconEntry } from "chaffjs/plugin";
import { PACKAGE_DIR, joinPath, readDir, readText } from "./package-files.ts";
import type { Era } from "./era-year.ts";

const DIR = joinPath(PACKAGE_DIR, "lexicons");

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const POSITIONS = ["before", "after"] as const;

const toEntry = (raw: unknown): LexiconEntry | undefined => {
  if (!isRecord(raw) || typeof raw["pattern"] !== "string") return undefined;
  const weight = raw["weight"];
  const instead = raw["instead_of"];
  const rewrite = raw["rewrite"];
  const group = raw["group"];
  return {
    pattern: raw["pattern"],
    weight: typeof weight === "number" ? weight : undefined,
    instead_of: typeof instead === "string" ? instead : undefined,
    position: POSITIONS.find((position) => position === raw["position"]),
    rewrite: typeof rewrite === "string" ? rewrite : undefined,
    ...(typeof group === "string" ? { group } : {}),
  };
};

/**
 * 語彙表はアダプタが持つ。detector は共通で、これだけが言語別。spec §11。
 * 新しい言語のサポートは、ここを書くところから始まる。
 */
export const loadLexicons = (dir: string = DIR): Record<string, Lexicon> =>
  Object.fromEntries(
    readDir(dir)
      .filter((file) => file.endsWith(".yaml"))
      .flatMap((file): [string, Lexicon][] => {
        const raw: unknown = parse(readText(joinPath(dir, file)));
        if (!isRecord(raw) || typeof raw["id"] !== "string" || !Array.isArray(raw["entries"])) return [];
        return [[raw["id"], raw["entries"].map(toEntry).filter((entry) => entry !== undefined)]];
      }),
  );

const CALENDAR_ERA = "calendar-era.yaml";

const toEra = (raw: unknown): Era[] =>
  isRecord(raw) && typeof raw["pattern"] === "string" && typeof raw["first_year"] === "number" ? [{ name: raw["pattern"], firstYear: raw["first_year"] }] : [];

/** 語彙表 calendar-era の元号と、その元年の西暦の年。first_year の無い元号は西暦にできないので入れない。 */
export const loadCalendarEras = (dir: string = DIR): Era[] => {
  const raw: unknown = parse(readText(joinPath(dir, CALENDAR_ERA)));
  return isRecord(raw) && Array.isArray(raw["entries"]) ? raw["entries"].flatMap(toEra) : [];
};
