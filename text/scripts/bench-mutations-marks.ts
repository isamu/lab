// Seeded mistakes of punctuation marks for `yarn bench`: a bracket left unclosed, a mark typed twice, and a Japanese
// comma written the other way. Pure and deterministic, like scripts/bench-mutations.ts.
import { isProse, rewriteFirst, type Mutation, type Plant } from "./bench-text.ts";

// --- unbalanced-bracket ---

const ROUND_PAIR = /[（(][^（()）]*[）)]/u;

/** 丸括弧で閉じた最初の組の、閉じ括弧を消す。書き換えの途中で消えた閉じ。 */
export const dropClosingBracket = (source: string): Plant | undefined =>
  rewriteFirst(
    source,
    (line) => isProse(line) && ROUND_PAIR.test(line),
    (line) => line.replace(ROUND_PAIR, (pair) => pair.slice(0, -1)),
  );

export const MARK_MUTATIONS: readonly Mutation[] = [{ id: "bracket-unclosed", rule: "unbalanced-bracket", languages: ["ja", "en"], plant: dropClosingBracket }];
