// Seeded mistakes of orthography for `yarn bench`: spacing around Latin text and the final ー of katakana words. Pure.
import { isProse, linesOf, proseAt, replaceLine, rewriteFirst, type Plant } from "./bench-text.ts";
import { moraCount } from "../packages/chaff/src/long-vowel.ts";

// --- latin-spacing ---

const JA_CHAR = "[ぁ-んァ-ヶー一-龠々]";
const UNSPACED_LATIN = new RegExp(`(${JA_CHAR})([A-Za-z][A-Za-z0-9]*)(?=${JA_CHAR})`, "u");
const UNSPACED_LATIN_ALL = new RegExp(UNSPACED_LATIN.source, "gu");
const SPACED_LATIN = new RegExp(`${JA_CHAR} [A-Za-z][A-Za-z0-9]* ${JA_CHAR}`, "u");
const MIN_LATIN_WORDS = 3;

/** 英字の前後を空けない文書で、一語だけ前後を空ける。空けない書き方が三つ以上あるときだけ。 */
export const spaceLatin = (source: string): Plant | undefined => {
  const body = linesOf(source).filter(isProse);
  const unspaced = body.flatMap((line) => [...line.matchAll(UNSPACED_LATIN_ALL)]).length;
  if (unspaced < MIN_LATIN_WORDS || body.some((line) => SPACED_LATIN.test(line))) return undefined;
  return rewriteFirst(
    source,
    (line) => isProse(line) && UNSPACED_LATIN.test(line),
    (line) => line.replace(UNSPACED_LATIN, "$1 $2 "),
  );
};

// --- katakana-long-vowel ---

const KATAKANA_RUN = /[ァ-ヺー]+/gu;

/** The morae the rule counts: the word with its final ー. */
const MIN_MORAE = 3;

/** Long words of three morae or more, and the number of times each is written in the prose. */
const longWordCounts = (lines: readonly string[], prose: (index: number) => boolean): Map<string, number> => {
  const counts = new Map<string, number>();
  lines.forEach((line, index) => {
    if (!prose(index)) return;
    [...line.matchAll(KATAKANA_RUN)].forEach(([word]) => {
      if (word.endsWith("ー") && moraCount(word) >= MIN_MORAE) counts.set(word, (counts.get(word) ?? 0) + 1);
    });
  });
  return counts;
};

/**
 * One word written both ways: the last time the sample writes a word it writes more than once (サーバー), drop its final ー.
 * The last, so the form the document used first stays the usual one and the planted form is the one reported.
 */
export const dropOneLongVowel = (source: string): Plant | undefined => {
  const lines = linesOf(source);
  const prose = proseAt(lines);
  const repeated = [...longWordCounts(lines, prose)].find(([, count]) => count >= 2)?.[0];
  if (repeated === undefined) return undefined;
  const index = lines.findLastIndex((line, at) => prose(at) && line.includes(repeated));
  const line = lines[index];
  if (line === undefined) return undefined;
  const at = line.lastIndexOf(repeated);
  const dropped = `${line.slice(0, at)}${repeated.slice(0, -1)}${line.slice(at + repeated.length)}`;
  return { source: replaceLine(lines, index, dropped), line: index + 1 };
};
