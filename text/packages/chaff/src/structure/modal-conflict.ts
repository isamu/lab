import type { Sentence, Span, Token } from "../plugin.ts";
import { itemMarkerSpan } from "./list-lead-in.ts";

// 同じ主語と行為に、逆の様相（しなければならない と してはならない、may と must not）を書いた二つの文。
// 主語と行為は、文の中身の語（名詞・固有名詞・動詞・形容詞）の集まりで近似する。様相の語そのものは数えない。

/** 木の義務の節点。type は must / must-not / may。 */
export type Obligation = { readonly start: number; readonly end: number; readonly type: string; readonly marker: string };

export type ModalStatement = { readonly offset: number; readonly type: string; readonly marker: string; readonly key: string };

export type ModalConflict = { readonly statement: ModalStatement; readonly earlier: ModalStatement };

export const CONTENT: ReadonlySet<string> = new Set(["NOUN", "PROPN", "VERB", "ADJ"]);

/** 中身の語がこれより少ない文（"You must not."）は、何を決めているかが文の外にあるので比べない。 */
const MIN_CONTENT_WORDS = 2;

/** 互いに食い違う様相。must と may は食い違わない（しなければならないことは、してよい）。 */
const OPPOSITE: Readonly<Record<string, readonly string[]>> = {
  must: ["must-not"],
  "must-not": ["must", "may"],
  may: ["must-not"],
};

const overlaps = (token: Token, spans: readonly Span[]): boolean => spans.some((span) => token.span.start < span.end && span.start < token.span.end);

/** 文の中身の語を、原形の小文字で、重ねずに並べたもの。様相の語の範囲にかかる語は外す。 */
export const contentKey = (tokens: readonly Token[], markers: readonly Span[]): string =>
  [
    ...new Set(
      tokens
        .filter((token) => CONTENT.has(token.pos) && !overlaps(token, markers))
        .map((token) => (token.lemma !== undefined && token.lemma !== "" ? token.lemma : token.surface).toLowerCase()),
    ),
  ]
    .toSorted((left, right) => left.localeCompare(right, "en"))
    .join(" ");

/** offset を含む文。sentences は start の昇順で、二分探索で引く。 */
const sentenceAt = (sentences: readonly Sentence[], offset: number): Sentence | undefined => {
  let low = 0;
  let high = sentences.length - 1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    const sentence = sentences[middle];
    if (sentence === undefined) return undefined;
    if (offset < sentence.span.start) high = middle - 1;
    else if (offset >= sentence.span.end) low = middle + 1;
    else return sentence;
  }
  return undefined;
};

/** 中身の語の集まりを足し合わせたもの。並べ方は contentKey と同じ。 */
const joinedKey = (keys: readonly string[]): string =>
  [...new Set(keys.flatMap((key) => (key === "" ? [] : key.split(" "))))].toSorted((left, right) => left.localeCompare(right, "en")).join(" ");

/**
 * 様相の語を一つだけ持つ文の、様相と中身。二つ以上持つ文（shall do A and shall not do B）は、どの語がどの行為にかかるかが
 * 中身の語の集まりからは分からないので外す。品詞の無い文も外す。
 * leadIns は箇条書きの項目の文の導入の文（listLeadIns）。項目の中身には導入の中身の語を足す。導入の条件（"If … is made—"）は
 * 項目の行為の条件なので、違う導入の下の項目どうしは、同じ行為を決めていない。
 */
export const modalStatements = (
  obligations: readonly Obligation[],
  sentences: readonly Sentence[],
  leadIns: ReadonlyMap<Sentence, readonly Sentence[]> = new Map(),
): ModalStatement[] => {
  const bySentence = new Map<Sentence, Obligation[]>();
  obligations.forEach((obligation) => {
    const sentence = sentenceAt(sentences, obligation.start);
    if (sentence === undefined) return;
    const found = bySentence.get(sentence);
    if (found === undefined) bySentence.set(sentence, [obligation]);
    else found.push(obligation);
  });
  /** 様相の語と項目の印を除いた中身。 */
  const keyOf = (sentence: Sentence, tokens: readonly Token[], markers: readonly Span[]): string => {
    const item = itemMarkerSpan(sentence);
    return contentKey(tokens, item === undefined ? markers : [...markers, item]);
  };
  const leadInKey = (sentence: Sentence): string => (sentence.tokens === undefined ? "" : keyOf(sentence, sentence.tokens, bySentence.get(sentence) ?? []));
  return [...bySentence].flatMap(([sentence, found]) => {
    const [only] = found;
    if (found.length !== 1 || only === undefined || sentence.tokens === undefined) return [];
    const own = keyOf(sentence, sentence.tokens, [only]);
    if (own.split(" ").length < MIN_CONTENT_WORDS) return [];
    const key = joinedKey([own, ...(leadIns.get(sentence) ?? []).map(leadInKey)]);
    return [{ offset: sentence.span.start, type: only.type, marker: only.marker, key }];
  });
};

/** 前に同じ中身で逆の様相を書いた文がある文。中身と様相の組ごとに、最初の文と比べる。 */
export const modalConflicts = (statements: readonly ModalStatement[]): ModalConflict[] => {
  const firsts = new Map<string, ModalStatement>();
  return statements
    .toSorted((left, right) => left.offset - right.offset)
    .flatMap((statement) => {
      const earlier = (OPPOSITE[statement.type] ?? []).map((type) => firsts.get(`${type}\u0000${statement.key}`)).find((found) => found !== undefined);
      const own = `${statement.type}\u0000${statement.key}`;
      if (!firsts.has(own)) firsts.set(own, statement);
      return earlier === undefined ? [] : [{ statement, earlier }];
    });
};
