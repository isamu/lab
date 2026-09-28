// Seeded mistakes of English wording for `yarn bench`: expletive openings, a flipped Oxford comma, a flipped heading
// capitalisation and an agentless passive. Pure and deterministic, like scripts/bench-mutations.ts.
import { isHeading, isProse, linesOf, proseAt, lowerFirst, replaceLine, rewriteFirst, splitSentences, type Plant, type PlantContext } from "./bench-text.ts";

const LIST_PREFIX = /^\s*[-*]\s/u;

/** 箇条書きの記号と、その後の文の並び。 */
const partsOf = (line: string): { readonly prefix: string; readonly sentences: string[] } => {
  const prefix = LIST_PREFIX.exec(line)?.[0] ?? "";
  return { prefix, sentences: splitSentences(line.slice(prefix.length)) };
};

/** 行の中で、最初に書き換えられる文を一つだけ書き換える。 */
const rewriteSentence = (line: string, rewrite: (sentence: string) => string | undefined): string | undefined => {
  const { prefix, sentences } = partsOf(line);
  const at = sentences.findIndex((sentence) => rewrite(sentence) !== undefined);
  return at < 0 ? undefined : `${prefix}${sentences.map((sentence, index) => (index === at ? (rewrite(sentence) ?? sentence) : sentence)).join(" ")}`;
};

// --- expletive-construction ---

const MODAL = /^([A-Z][A-Za-z-]*(?: [A-Za-z][A-Za-z-]*){0,3}) (must|should|will) (.+)$/u;
const OPENING: Readonly<Record<string, string>> = { must: "It is essential that", should: "It is important that", will: "It is expected that" };

/** "The team must review" を "It is essential that the team review" に。will は残す。 */
export const expletiveOf = (sentence: string): string | undefined => {
  const [, subject, modal, rest] = MODAL.exec(sentence) ?? [];
  if (subject === undefined || modal === undefined || rest === undefined || /^(?:It|There)\b/u.test(subject)) return undefined;
  return `${OPENING[modal] ?? ""} ${lowerFirst(subject)} ${modal === "will" ? "will " : ""}${rest}`;
};

/** 上限より一つ多い文を、主語を後ろへ押しやる書き出しにする。足りなければ植えない。 */
export const expletives = (source: string, context: PlantContext): Plant | undefined => {
  const limit = context.limits["expletive-construction"];
  if (limit === undefined) return undefined;
  const lines = linesOf(source);
  const isProseLine = proseAt(lines);
  const targets = lines.flatMap((line, index) =>
    isProseLine(index)
      ? partsOf(line)
          .sentences.filter((sentence) => expletiveOf(sentence) !== undefined)
          .map(() => index)
      : [],
  );
  const chosen = targets.slice(0, limit + 1);
  const first = chosen[0];
  if (first === undefined || chosen.length <= limit) return undefined;
  const rewritten = lines.map((line, index) => {
    const count = chosen.filter((target) => target === index).length;
    return Array.from({ length: count }).reduce<string>((text) => rewriteSentence(text, expletiveOf) ?? text, line);
  });
  return { source: rewritten.join("\n"), line: first + 1 };
};

// --- oxford-comma-consistency ---

const CONJUNCTION = /\b(?:and|or)\b/iu;

/** 並列の最後の and / or の前に読点があるか。読点が一つも無い（並列が二つ）なら判定しない。 */
export const oxfordOf = (sentence: string): boolean | undefined => {
  const at = CONJUNCTION.exec(sentence)?.index;
  const before = at === undefined ? "" : sentence.slice(0, at).trimEnd();
  if (at === undefined || at < 1 || !before.includes(",")) return undefined;
  return before.endsWith(",");
};

const commasIn = (text: string): number => [...text.matchAll(/,/gu)].length;

/** 並列の読点を逆にする。「A, B, and C」は読点が二つある。一つだけの「X, and Y」は並列でなく節をつなぐ読点なので替えない。 */
const flipOxford = (sentence: string): string | undefined => {
  const oxford = oxfordOf(sentence);
  const at = CONJUNCTION.exec(sentence)?.index;
  if (oxford === undefined || at === undefined) return undefined;
  const before = sentence.slice(0, at).trimEnd();
  if (oxford && commasIn(before) < 2) return undefined;
  const head = oxford ? before.slice(0, -1) : [before, ","].join("");
  return `${head} ${sentence.slice(at)}`;
};

const MIN_LISTS = 3;

/** 並列の読点が揃った文書（三文以上）で、最初の一文だけ打ちかたを逆にする。 */
export const flipFirstList = (source: string): Plant | undefined => {
  const lines = linesOf(source);
  const isProseLine = proseAt(lines);
  const judged = lines.filter((_, index) => isProseLine(index)).flatMap((line) => partsOf(line).sentences.flatMap((sentence) => oxfordOf(sentence) ?? []));
  if (judged.length < MIN_LISTS || new Set(judged).size !== 1) return undefined;
  return rewriteFirst(
    source,
    (line) => isProse(line) && rewriteSentence(line, flipOxford) !== undefined,
    (line) => rewriteSentence(line, flipOxford),
  );
};

// --- title-case-consistency ---

const WORD = /[A-Za-z][A-Za-z'-]*/gu;
const MINOR = new Set(["a", "an", "the", "and", "or", "but", "of", "in", "on", "at", "to", "for", "with", "as", "by", "from", "is"]);

/** 見出しが Title Case か。大文字化の効く語が二つ未満なら判定しない。 */
export const isTitleCase = (heading: string): boolean | undefined => {
  const words = [...heading.matchAll(WORD)].map((match) => match[0]).filter((word) => !MINOR.has(word.toLowerCase()));
  if (words.length < 2) return undefined;
  return words.every((word) => word.charAt(0) === word.charAt(0).toUpperCase());
};

const isAcronym = (word: string): boolean => /^[A-Z0-9]{2,}$/u.test(word);

const recase = (heading: string, title: boolean): string => {
  const first = heading.search(WORD);
  return heading.replace(WORD, (word, at: number) => {
    if (at === first || isAcronym(word) || MINOR.has(word.toLowerCase())) return word;
    return title ? `${word.charAt(0).toUpperCase()}${word.slice(1)}` : word.toLowerCase();
  });
};

const textOf = (line: string): string => line.replace(/^#+\s*/u, "");

/** 見出しの大文字化を逆にする。逆にしても判定が変わらない見出し（略語ばかり）なら undefined。 */
const flipHeading = (line: string): string | undefined => {
  const title = isTitleCase(textOf(line));
  if (title === undefined) return undefined;
  const flipped = `${line.slice(0, line.length - textOf(line).length)}${recase(textOf(line), !title)}`;
  return isTitleCase(textOf(flipped)) === !title ? flipped : undefined;
};

/** 大文字化の揃った見出し（三つ以上）のうち、最後の一つだけ流儀を逆にする。 */
export const flipLastHeading = (source: string): Plant | undefined => {
  const lines = linesOf(source);
  const judged = lines.filter(isHeading).flatMap((line) => isTitleCase(textOf(line)) ?? []);
  if (judged.length < MIN_LISTS || new Set(judged).size !== 1) return undefined;
  const index = lines.findLastIndex((line) => isHeading(line) && flipHeading(line) !== undefined);
  const flipped = flipHeading(lines[index] ?? "");
  return flipped === undefined ? undefined : { source: replaceLine(lines, index, flipped), line: index + 1 };
};

// --- agentless-passive ---

// "We approved the budget." を "The budget was approved." に。動作主を消す。規則動詞（-ed）だけ。
const ACTIVE = /^(?:We|Our [a-z]+|The [a-z]+) ([a-z]+ed) (the [^.]+)\.$/u;
// 目的語は最初の前置詞の手前まで。前置詞からは受け身の文にそのまま残す。
const PREPOSITION = / (?:on|in|at|for|before|after|during|with) /u;

const upperFirst = (text: string): string => `${text.charAt(0).toUpperCase()}${text.slice(1)}`;
const isPlural = (noun: string): boolean => /[^s]s$/u.test(noun);

const passiveOf = (sentence: string): string | undefined => {
  if (sentence.includes(" by ")) return undefined;
  const [, verb, phrase] = ACTIVE.exec(sentence) ?? [];
  if (verb === undefined || phrase === undefined) return undefined;
  const cut = PREPOSITION.exec(phrase)?.index ?? phrase.length;
  const object = phrase.slice(0, cut);
  return `${upperFirst(object)} ${isPlural(object) ? "were" : "was"} ${verb}${phrase.slice(cut)}.`;
};

/** 「We approved the budget.」を、動作主の無い受け身「The budget was approved.」にする。 */
export const passiveEn = (source: string): Plant | undefined =>
  rewriteFirst(
    source,
    (line) => isProse(line) && rewriteSentence(line, passiveOf) !== undefined,
    (line) => rewriteSentence(line, passiveOf),
  );
