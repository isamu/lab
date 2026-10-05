import { join } from "node:path";
import { parse } from "yaml";
import { japaneseRatio, latinRatio } from "./detect-language.ts";
import { referenceListSpans } from "./reference-lists.ts";
import { withoutSpans } from "./soft-break.ts";
import { languageSample } from "./language-sample.ts";
import { PACKAGE_DIR, readText } from "./package-files.ts";

export type LanguageGuess = { readonly language: string; readonly confidence: number; readonly from: string };

/**
 * 技術文書の日本語は英字を大量に含む（コマンド名、識別子、製品名）。
 * 仮名と漢字が 15% あれば日本語と見る。corpus で測るまでの暫定値。spec §26。
 */
const JAPANESE_FLOOR = 0.15;

const HEADINGS_FILE = join(PACKAGE_DIR, "reference-headings.yaml");

const isStringList = (value: unknown): value is string[] => Array.isArray(value) && value.every((entry) => typeof entry === "string");

const readHeadings = (): string[] => {
  const raw: unknown = parse(readText(HEADINGS_FILE));
  const headings: unknown = typeof raw === "object" && raw !== null && "headings" in raw ? raw.headings : undefined;
  if (!isStringList(headings)) throw new Error(`${HEADINGS_FILE}: headings は文字列の並びであること`);
  return headings;
};

const REFERENCE_HEADINGS = readHeadings();

/** 本文だけ。文献一覧は引いた文献の言語で書かれるので数えない。本文に字が無ければ（文献一覧だけの文書）全体。 */
const bodyOf = (source: string): string => {
  const body = withoutSpans(source, referenceListSpans(source, REFERENCE_HEADINGS));
  return body.trim() === "" ? source : body;
};

/** The body without code, URLs and markup, or the whole body when nothing else is left (a document of only code). */
const proseOf = (body: string): string => {
  const sample = languageSample(body);
  return sample.trim() === "" ? body : sample;
};

export const guessLanguage = (source: string): LanguageGuess => {
  const prose = proseOf(bodyOf(source));
  const japanese = japaneseRatio(prose);
  if (japanese >= JAPANESE_FLOOR) return { language: "ja", confidence: japanese, from: "content" };
  return { language: "en", confidence: latinRatio(prose), from: "content" };
};
