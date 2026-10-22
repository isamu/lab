// A 「」 quotation that holds sentences of its own (「…転落。…入院。」(0歳1か月)): each quoted sentence is read as one, and
// the words around the quotation as another. Pure.

const OPEN = "「";
const CLOSE = "」";
const STOP = /[。！？]/u;
const OPENER = /\p{Ps}/u;
const CLOSER = /\p{Pe}/u;

type Quote = { readonly start: number; readonly end: number };

/** The outermost 「」 pairs, as the offsets of their brackets. An unclosed 「 pairs with nothing. */
const outerQuotes = (chars: readonly string[]): Quote[] => {
  const quotes: Quote[] = [];
  const opens: number[] = [];
  chars.forEach((char, at) => {
    if (char === OPEN) opens.push(at);
    if (char !== CLOSE) return;
    const start = opens.pop();
    if (start !== undefined && opens.length === 0) quotes.push({ start, end: at });
  });
  return quotes;
};

const depthAfter = (depth: number, char: string): number => {
  if (OPENER.test(char)) return depth + 1;
  return CLOSER.test(char) ? Math.max(0, depth - 1) : depth;
};

/** A quotation's sentences, cut after each stop outside any inner bracket (『…。』 stays whole). */
const sentencesIn = (chars: readonly string[]): string[] => {
  const pieces: string[][] = [[]];
  chars.reduce((depth, char) => {
    pieces.at(-1)?.push(char);
    const next = depthAfter(depth, char);
    if (next === 0 && STOP.test(char)) pieces.push([]);
    return next;
  }, 0);
  return pieces.map((piece) => piece.join("")).filter((piece) => piece.trim() !== "");
};

/** Two sentences or more, each closed by its stop: the quotation is made of sentences, not one clause that ends in one. */
const ownSentences = (inner: readonly string[]): readonly string[] | undefined => {
  const sentences = sentencesIn(inner);
  return sentences.length > 1 && sentences.every((sentence) => STOP.test(sentence.trimEnd().slice(-1))) ? sentences : undefined;
};

/**
 * The parts of a sentence to measure one by one: each sentence inside a 「」 that holds two or more whole sentences, and the
 * words outside such quotations. A sentence without one is a single part, itself.
 */
export const quotedSentenceParts = (text: string): readonly string[] => {
  const chars = Array.from(text);
  const split = outerQuotes(chars).flatMap((quote) => {
    const sentences = ownSentences(chars.slice(quote.start + 1, quote.end));
    return sentences === undefined ? [] : [{ quote, sentences }];
  });
  if (split.length === 0) return [text];
  const inside = new Set(split.flatMap(({ quote }) => Array.from({ length: quote.end - quote.start - 1 }, (_unused, index) => quote.start + 1 + index)));
  const outside = chars.filter((_char, at) => !inside.has(at)).join("");
  return [outside, ...split.flatMap(({ sentences }) => sentences)];
};
