/**
 * 条件の付いた名前（「待機期間（旅行キャンセル費用）」「旅行キャンセル費用の待機期間」"waiting period for cancellation cover"）を
 * 一つの書き方（名前と条件）にする。語彙表の型は * が条件の位置: 「（*）」「*の」"(*)" "for *"。
 * 条件の違う名前（待機期間（疾病）と待機期間（けが））と、条件の無い名前（待機期間）は別の名前のまま。
 * 英語の "cancellation cover waiting period" は、同じ文書が "waiting period (cancellation cover)" とも書いたときだけ同じ名前。
 */
export type QualifierWords = {
  /** 条件を書く型。* が条件。* が頭なら条件は名前の前（*の）、そうでなければ後ろ（（*）、for *）。 */
  readonly templates: readonly string[];
  /** 名前と条件の頭から落とす語（the, our）。 */
  readonly determiners: readonly string[];
};

export type QualifiedLabel = { readonly head: string; readonly qualifier: string };

const PLACEHOLDER = "*";
const LETTER = /\p{L}/u;
const LATIN_WORD = /^[a-z]+(?: [a-z]+)*$/u;

const folded = (text: string): string => text.normalize("NFKC").toLowerCase();

const wordsOf = (text: string): string[] => text.split(/\s+/u).filter((word) => word !== "");

const withoutDeterminers = (text: string, determiners: readonly string[]): string => {
  const words = wordsOf(text);
  const start = words.findIndex((word) => !determiners.includes(word));
  return start === -1 ? "" : words.slice(start).join(" ");
};

const labelOf = (head: string, qualifier: string, words: QualifierWords): QualifiedLabel | undefined => {
  const determiners = words.determiners.map(folded);
  const label = { head: withoutDeterminers(head, determiners), qualifier: withoutDeterminers(qualifier, determiners) };
  return LETTER.test(label.head) && LETTER.test(label.qualifier) ? label : undefined;
};

/** 英字の語の区切り（for、of）は、前後が空白のときだけ。最初のものから後ろが条件。 */
const splitAtWord = (key: string, joiner: string): [string, string] | undefined => {
  const at = key.indexOf(` ${joiner} `);
  return at === -1 ? undefined : [key.slice(0, at), key.slice(at + joiner.length + 2)];
};

/** 記号の区切り（（）は、最後のものから後ろが条件。 */
const splitAtMark = (key: string, open: string): [string, string] | undefined => {
  const at = key.lastIndexOf(open);
  return at <= 0 ? undefined : [key.slice(0, at), key.slice(at + open.length)];
};

/** 条件が名前の後ろの型（（*）、for *）。 */
const qualifierAfter = (key: string, open: string, close: string): [string, string] | undefined => {
  if (!key.endsWith(close)) return undefined;
  const body = key.slice(0, key.length - close.length);
  const trimmed = open.trim();
  return LATIN_WORD.test(trimmed) ? splitAtWord(body, trimmed) : splitAtMark(body, open);
};

/** 条件が名前の前の型（*の）。最後のつなぎの語から後ろが名前。 */
const qualifierBefore = (key: string, joiner: string): [string, string] | undefined => {
  const at = key.lastIndexOf(joiner);
  return at <= 0 ? undefined : [key.slice(at + joiner.length), key.slice(0, at)];
};

const splitBy = (key: string, template: string): [string, string] | undefined => {
  const at = template.indexOf(PLACEHOLDER);
  if (at === -1) return undefined;
  const open = template.slice(0, at);
  const close = template.slice(at + PLACEHOLDER.length);
  if (open === "") return close === "" ? undefined : qualifierBefore(key, close);
  return qualifierAfter(key, open, close);
};

/** 名前の key を、名前と条件に分ける。型に合わなければ undefined。語彙表の順に試す。 */
export const qualifiedLabelOf = (key: string, words: QualifierWords): QualifiedLabel | undefined => {
  const trimmed = folded(key).trim();
  for (const template of words.templates.map(folded)) {
    const parts = splitBy(trimmed, template);
    const label = parts === undefined ? undefined : labelOf(parts[0], parts[1], words);
    if (label !== undefined) return label;
  }
  return undefined;
};

const keyOfLabel = ({ head, qualifier }: QualifiedLabel): string => `${head} (${qualifier})`;

/** 条件の付いた名前は「名前 (条件)」に。条件の無い名前は書いたまま。 */
export const qualifiedKeyOf = (key: string, words: QualifierWords): string => {
  const label = qualifiedLabelOf(key, words);
  return label === undefined ? key : keyOfLabel(label);
};

/** 前に置いた条件（cancellation cover waiting period）として読める条件か。語だけで、冠詞もつなぎの語も含まない。 */
const isPremodifier = (qualifier: string, words: QualifierWords): boolean => {
  const joiners = words.templates.map((template) => folded(template).replace(PLACEHOLDER, "").trim());
  const determiners = words.determiners.map(folded);
  return LATIN_WORD.test(qualifier) && wordsOf(qualifier).every((word) => !determiners.includes(word) && !joiners.includes(word));
};

/** 前に置いた書き方が、二つの名前と条件（claim limit (baggage) と limit (baggage claim)）に読めるものは、どちらにもしない。 */
const unambiguous = (pairs: readonly [string, string][]): Map<string, string> => {
  const targets = new Map<string, Set<string>>();
  pairs.forEach(([surface, key]) => targets.set(surface, (targets.get(surface) ?? new Set<string>()).add(key)));
  return new Map(pairs.filter(([surface]) => targets.get(surface)?.size === 1));
};

/**
 * 文書の名前の key を一つの書き方に。条件を前に置いた名前（"cancellation cover waiting period"）は、同じ文書に同じ名前と条件の
 * 型の書き方があるときだけ、それと同じ key にする。
 */
export const qualifiedKeys = (keys: readonly string[], words: QualifierWords): string[] => {
  const labels = keys.map((key) => qualifiedLabelOf(key, words));
  const premodified = unambiguous(
    labels.flatMap((label): [string, string][] =>
      label === undefined || !isPremodifier(label.qualifier, words) ? [] : [[`${label.qualifier} ${label.head}`, keyOfLabel(label)]],
    ),
  );
  return keys.map((key, index) => {
    const label = labels[index];
    return label === undefined ? (premodified.get(key.trim()) ?? key) : keyOfLabel(label);
  });
};
