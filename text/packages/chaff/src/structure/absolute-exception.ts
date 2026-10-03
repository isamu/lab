import type { Span, Token } from "../plugin.ts";
import { CONTENT } from "./modal-conflict.ts";

// An absolute obligation (すべての〜は…しなければならない, "must always", 「一切…してはならない」) and, later in the same document
// and outside its own article or paragraph, an exception for the same act (「ただし…を除く」, "except"). The absolute
// statement does not carry the exception, so a reader who stops at it applies it to every case.

/** One sentence read for this rule. */
export type Statement = {
  readonly offset: number;
  /** Content words (lemmas, lower case), without the absolute word, the exception word and the modal marker. */
  readonly words: readonly string[];
  /** The absolute word it holds (すべての, always), if any. */
  readonly absolute: string | undefined;
  /** The exception word it holds (ただし, except), if any. */
  readonly exception: string | undefined;
  /** It holds exactly one obligation marker, and that marker requires or forbids (must, must not). */
  readonly obligation: boolean;
  /** The act the obligation binds: the content word next to the marker (comply in "must comply", 負う in 「負わないものとする」). */
  readonly act: string | undefined;
  /** Where its own provisos sit: the start of its article, list or paragraph. */
  readonly unit: number;
};

const lemmaOf = (token: Token): string => (token.lemma !== undefined && token.lemma !== "" ? token.lemma : token.surface).toLowerCase();

const outside = (token: Token, spans: readonly Span[]): boolean => spans.every((span) => token.span.end <= span.start || span.end <= token.span.start);

/**
 * Pure: the act an obligation binds. The content word nearest the marker, by tokens, leaving out light verbs (する, be)
 * and the words in `skip`; on a tie the verb, else the one after the marker (English puts the verb after "must", Japanese
 * before 「なければならない」).
 */
export const actOf = (tokens: readonly Token[], marker: Span, skip: readonly Span[], lightVerbs: ReadonlySet<string>): string | undefined => {
  const first = tokens.findIndex((token) => token.span.end > marker.start);
  const last = tokens.findLastIndex((token) => token.span.start < marker.end);
  if (first === -1 || last === -1) return undefined;
  const candidates = tokens
    .map((token, index) => ({ token, index }))
    .filter(({ token, index }) => (index < first || index > last) && CONTENT.has(token.pos) && outside(token, skip) && !lightVerbs.has(lemmaOf(token)))
    .map(({ token, index }) => ({ token, distance: index < first ? first - index : index - last, after: index > last }));
  const rank = (candidate: (typeof candidates)[number]): number =>
    candidate.distance * 4 + (candidate.token.pos === "VERB" ? 0 : 2) + (candidate.after ? 0 : 1);
  const nearest = candidates.toSorted((left, right) => rank(left) - rank(right))[0];
  return nearest === undefined ? undefined : lemmaOf(nearest.token);
};

export type Contradicted = { readonly absolute: Statement; readonly exception: Statement; readonly shared: readonly string[] };

/** Fewer shared words than this, and the two sentences may be about different things. */
const MIN_SHARED = 2;

/** The share of the absolute statement's content words the exception must repeat to be about the same subject and act. */
const MIN_SHARE_PERCENT = 60;
const PERCENT = 100;

const isAbsolute = (statement: Statement): boolean => statement.absolute !== undefined && statement.exception === undefined && statement.obligation;

const sharedWords = (absolute: Statement, exception: Statement): string[] => {
  const later = new Set(exception.words);
  return absolute.words.filter((word) => later.has(word));
};

/** The exception names the act the rule binds, and repeats most of the rule's other words (its subject and object). */
const isSameAct = (absolute: Statement, exception: Statement, shared: readonly string[]): boolean =>
  absolute.act !== undefined &&
  exception.words.includes(absolute.act) &&
  shared.length >= MIN_SHARED &&
  shared.length * PERCENT >= absolute.words.length * MIN_SHARE_PERCENT;

/**
 * Pure: absolute obligations that a later sentence, outside their own unit, makes an exception to. The absolute statement
 * carries no exception itself, and the exception repeats most of its content words. Each absolute statement once, with
 * the first such exception.
 */
export const contradictedAbsolutes = (statements: readonly Statement[]): Contradicted[] => {
  const byWord = exceptionsByWord(statements);
  return statements
    .filter(isAbsolute)
    .toSorted((left, right) => left.offset - right.offset)
    .flatMap((absolute) => {
      const found = (byWord.get(absolute.act ?? "") ?? [])
        .filter((exception) => exception.offset > absolute.offset && exception.unit !== absolute.unit)
        .map((exception) => ({ exception, shared: sharedWords(absolute, exception) }))
        .find(({ exception, shared }) => isSameAct(absolute, exception, shared));
      return found === undefined ? [] : [{ absolute, exception: found.exception, shared: found.shared }];
    });
};

/** The exceptions in document order, by each of their words: an absolute rule looks only at those naming its act. */
const exceptionsByWord = (statements: readonly Statement[]): ReadonlyMap<string, readonly Statement[]> => {
  const byWord = new Map<string, Statement[]>();
  statements
    .filter((statement) => statement.exception !== undefined)
    .toSorted((left, right) => left.offset - right.offset)
    .forEach((exception) =>
      new Set(exception.words).forEach((word) => {
        const listed = byWord.get(word);
        if (listed === undefined) byWord.set(word, [exception]);
        else listed.push(exception);
      }),
    );
  return byWord;
};
