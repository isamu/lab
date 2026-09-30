// Seeded mistakes of punctuation marks for `yarn bench`: a bracket left unclosed, a mark typed twice, and a Japanese
// comma written the other way. Pure and deterministic, like scripts/bench-mutations.ts.
import { isJapanese, isProse, rewriteFirst, type Mutation, type Plant } from "./bench-text.ts";

// --- unbalanced-bracket ---

const ROUND_PAIR = /[（(][^（()）]*[）)]/u;

/** 丸括弧で閉じた最初の組の、閉じ括弧を消す。書き換えの途中で消えた閉じ。 */
export const dropClosingBracket = (source: string): Plant | undefined =>
  rewriteFirst(
    source,
    (line) => isProse(line) && ROUND_PAIR.test(line),
    (line) => line.replace(ROUND_PAIR, (pair) => pair.slice(0, -1)),
  );

// --- doubled-punctuation ---

/** 最初の文の終わりの句点を二つにする。打ち直しで残った印。 */
export const doublePeriod = (source: string): Plant | undefined =>
  rewriteFirst(
    source,
    (line) => isProse(line) && /[^.。][。.]$/u.test(line.trimEnd()) && !line.startsWith("|"),
    (line) => {
      const trimmed = line.trimEnd();
      return `${trimmed}${trimmed.slice(-1)}`;
    },
  );

// --- kutoten-consistency ---

/** 読点を「、」で書いた文書の、最初の「、」を「，」にする。論文から貼り付けた文。 */
export const westernComma = (source: string): Plant | undefined =>
  rewriteFirst(
    source,
    (line) => isProse(line) && isJapanese(line) && line.includes("、") && !line.includes("「"),
    (line) => line.replace("、", "，"),
  );

export const MARK_MUTATIONS: readonly Mutation[] = [
  { id: "bracket-unclosed", rule: "unbalanced-bracket", languages: ["ja", "en"], plant: dropClosingBracket },
  { id: "period-doubled", rule: "doubled-punctuation", languages: ["ja", "en"], plant: doublePeriod },
  { id: "comma-western", rule: "kutoten-consistency", languages: ["ja"], plant: westernComma },
];
