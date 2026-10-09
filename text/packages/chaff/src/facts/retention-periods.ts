import type { Span, Token } from "../plugin.ts";
import type { DurationUnit } from "../derived/date-arithmetic.ts";

/**
 * 保存期間。文が、保存の語（保存、keep）か、期間の後に消す語（3年間を経過した…を削除、delete … 3 years after）と、期間を
 * 一つだけ持つとき、その期間を、語の前後の名詞句（個人情報、personal information）の保存期間と読む。文書のどこでも、同じ名詞句に
 * 違う長さが二通り書かれていれば言う。名詞句が違えば別のもの（ログは90日、アカウントの情報は1年）。
 * 上限や下限や目安の長さ（最長、以上、約、up to、at least）は範囲なので比べない。年と月、週と日だけを換算して比べる。
 */
export type RetentionLength = Span & { readonly amount: number; readonly unit: DurationUnit };

/** position: 対象の名詞句が語の前か後ろか。後ろなら、後ろに無いとき前を読む（is retained の受け身）。 */
export type RetentionVerb = { readonly pattern: string; readonly group: string; readonly position: "before" | "after" };

/** その組の語が期間を言うのに、期間の前か後ろに要る語（keep … for、delete … after、経過）。組に語が無ければ要らない。 */
export type LengthMark = { readonly pattern: string; readonly group: string; readonly position: "before" | "after" };

export type WordAt = { readonly pattern: string; readonly position: "before" | "after" };

export type RetentionWords = {
  readonly verbs: readonly RetentionVerb[];
  readonly marks: readonly LengthMark[];
  /** 期間のすぐ後ろにあれば、期間が名詞を修飾している（過去3年間の記録）。 */
  readonly modifiers: readonly string[];
  /** 範囲や目安の印（最長、以上、up to）。 */
  readonly bounds: readonly WordAt[];
  /** 名詞句の中で名詞をつなぐ語（お問い合わせの記録 の の）。 */
  readonly joiners: readonly string[];
  /** 名詞句と、前にある保存の語のあいだの語（を、は）。無い言語は名詞句がすぐ前。 */
  readonly objectMarks: readonly string[];
};

export type RetentionSentence = Span & { readonly tokens: readonly Token[] };

export type RetentionConflict = { readonly object: string; readonly value: RetentionLength; readonly other: RetentionLength };

type Statement = { readonly object: string; readonly length: RetentionLength; readonly base: string; readonly count: number };

const NOUN_PHRASE = new Set(["NOUN", "PROPN", "ADJ"]);
const SKIPPED_BEFORE = new Set(["PUNCT", "AUX", "ADV", "VERB", "PART"]);
const DROPPED = new Set(["DET", "PRON"]);

const MONTHS_PER_YEAR = 12;
const DAYS_PER_WEEK = 7;

const scaled: Readonly<Record<DurationUnit, readonly [string, number]>> = {
  year: ["month", MONTHS_PER_YEAR],
  month: ["month", 1],
  week: ["day", DAYS_PER_WEEK],
  day: ["day", 1],
};

const folded = (text: string): string => text.normalize("NFKC").toLowerCase();

const LATIN = /[a-z]/u;

/** 英字の語は語として（for は form の頭ではない）。 */
const isWordAt = (text: string, at: number, word: string): boolean =>
  text.startsWith(word, at) &&
  !(LATIN.test(word.charAt(0)) && LATIN.test(text.charAt(at - 1))) &&
  !(LATIN.test(word.slice(-1)) && LATIN.test(text.charAt(at + word.length)));

const NEAR = 24;

const before = (source: string, span: Span): string => folded(source.slice(Math.max(0, span.start - NEAR), span.start)).trimEnd();
const after = (source: string, span: Span): string => folded(source.slice(span.end, span.end + NEAR)).trimStart();

const endsWithWord = (text: string, word: string): boolean => {
  const pattern = folded(word);
  return isWordAt(text, text.length - pattern.length, pattern);
};

const startsWithWord = (text: string, word: string): boolean => isWordAt(text, 0, folded(word));

const besideLength = (source: string, length: Span, word: WordAt): boolean =>
  word.position === "before" ? endsWithWord(before(source, length), word.pattern) : startsWithWord(after(source, length), word.pattern);

const CLAUSE_COMMA = /^[,、，]\s*/u;

/** 後ろの印は読点の後でもよい（90 days, or longer）。 */
const isBounded = (source: string, length: Span, words: RetentionWords): boolean =>
  words.bounds.some(
    (word) =>
      besideLength(source, length, word) || (word.position === "after" && startsWithWord(after(source, length).replace(CLAUSE_COMMA, ""), word.pattern)),
  );

/** 期間の後ろの印（3年後に、を経過）の終わり。印の語は名詞句ではないので、名詞句を探すとき期間と一緒に飛ばす。 */
const endWithMark = (source: string, length: Span, group: string, words: RetentionWords): number => {
  const gap = /^\s*/u.exec(source.slice(length.end, length.end + NEAR))?.[0].length ?? 0;
  const written = words.marks
    .filter((mark) => mark.group === group && mark.position === "after" && besideLength(source, length, mark))
    .reduce((longest, mark) => Math.max(longest, mark.pattern.length), 0);
  return written === 0 ? length.end : length.end + gap + written;
};

const tokenWord = (token: Token): string => folded(token.lemma ?? token.surface);

const isVerbToken = (token: Token, verb: RetentionVerb): boolean => tokenWord(token) === folded(verb.pattern) || folded(token.surface) === folded(verb.pattern);

/** 組の語に印が要らないか、要る印が期間の前後にある。 */
const marked = (source: string, length: Span, group: string, words: RetentionWords): boolean => {
  const marks = words.marks.filter((mark) => mark.group === group);
  return marks.length === 0 || marks.some((mark) => besideLength(source, length, mark));
};

type VerbAt = { readonly verb: RetentionVerb; readonly index: number; readonly token: Token };

const verbsIn = (tokens: readonly Token[], verbs: readonly RetentionVerb[]): VerbAt[] =>
  tokens.flatMap((token, index) => verbs.filter((verb) => isVerbToken(token, verb)).map((verb) => ({ verb, index, token })));

const inside = (outer: Span, inner: Span): boolean => outer.start <= inner.start && inner.end <= outer.end;
const overlaps = (left: Span, right: Span): boolean => left.start < right.end && right.start < left.end;

const isPhraseToken = (token: Token | undefined, length: Span): boolean => token !== undefined && NOUN_PHRASE.has(token.pos) && !overlaps(token.span, length);

const isJoiner = (token: Token | undefined, words: RetentionWords): boolean =>
  token !== undefined && words.joiners.some((joiner) => folded(joiner) === folded(token.surface));

/** index から前へ、名詞句の始まり。つなぐ語の前の名詞も句に入れる（お問い合わせ の 記録）。 */
const phraseStart = (tokens: readonly Token[], index: number, length: Span, words: RetentionWords): number => {
  let start = index;
  while (start > 0) {
    const previous = tokens[start - 1];
    if (isPhraseToken(previous, length)) start -= 1;
    else if (isJoiner(previous, words) && isPhraseToken(tokens[start - 2], length)) start -= 2;
    else break;
  }
  return start;
};

/** index から後ろへ、名詞句の終わり（含まない）。 */
const phraseEnd = (tokens: readonly Token[], index: number, length: Span, words: RetentionWords): number => {
  let end = index;
  while (end < tokens.length) {
    const next = tokens[end];
    if (isPhraseToken(next, length)) end += 1;
    else if (isJoiner(next, words) && isPhraseToken(tokens[end + 1], length)) end += 2;
    else break;
  }
  return end;
};

const phraseKey = (tokens: readonly Token[]): string => tokens.map(tokenWord).join(tokens.some((token) => LATIN.test(folded(token.surface))) ? " " : "");

/** 語の後ろの名詞句（keep your personal information）。冠詞や代名詞は飛ばす。 */
const objectAfter = (tokens: readonly Token[], index: number, length: Span, words: RetentionWords): string => {
  let start = index + 1;
  while (DROPPED.has(tokens[start]?.pos ?? "")) start += 1;
  return phraseKey(tokens.slice(start, phraseEnd(tokens, start, length, words)));
};

const isObjectMark = (token: Token, words: RetentionWords): boolean => words.objectMarks.some((mark) => folded(mark) === folded(token.surface));

/** 語の前の名詞句（個人情報を…保存、Account data is retained）。期間と句読点と助動詞は飛ばし、印のある言語は印の前。 */
const objectBefore = (tokens: readonly Token[], index: number, length: Span, words: RetentionWords): string => {
  let end = index;
  const skipped = (token: Token | undefined): boolean => token !== undefined && (overlaps(token.span, length) || SKIPPED_BEFORE.has(token.pos));
  while (end > 0 && skipped(tokens[end - 1])) end -= 1;
  if (words.objectMarks.length > 0) {
    const mark = tokens[end - 1];
    if (mark === undefined || !isObjectMark(mark, words)) return "";
    end -= 1;
  }
  if (!isPhraseToken(tokens[end - 1], length)) return "";
  return phraseKey(tokens.slice(phraseStart(tokens, end - 1, length, words), end));
};

const objectOf = (tokens: readonly Token[], at: VerbAt, length: Span, words: RetentionWords): string => {
  const following = at.verb.position === "after" ? objectAfter(tokens, at.index, length, words) : "";
  return following === "" ? objectBefore(tokens, at.index, length, words) : following;
};

const distance = (token: Token, length: Span): number => Math.abs(token.span.start - length.start);

/** 文の保存期間の言い方。期間がちょうど一つ、印の揃った組がちょうど一つのときだけ。 */
const statementOf = (source: string, sentence: RetentionSentence, lengths: readonly RetentionLength[], words: RetentionWords): Statement[] => {
  const own = lengths.filter((length) => inside(sentence, length));
  const [length] = own;
  if (own.length !== 1 || length === undefined || isBounded(source, length, words)) return [];
  if (words.modifiers.some((word) => startsWithWord(after(source, length), word))) return [];
  const verbs = verbsIn(sentence.tokens, words.verbs).filter((at) => marked(source, length, at.verb.group, words));
  if (new Set(verbs.map((at) => at.verb.group)).size !== 1) return [];
  const [nearest] = verbs.toSorted((left, right) => distance(left.token, length) - distance(right.token, length));
  if (nearest === undefined) return [];
  const object = objectOf(sentence.tokens, nearest, { start: length.start, end: endWithMark(source, length, nearest.verb.group, words) }, words);
  const [base, factor] = scaled[length.unit];
  return object === "" ? [] : [{ object, length, base, count: length.amount * factor }];
};

const conflictsOf = (statements: readonly Statement[]): RetentionConflict[] => {
  const [first] = statements;
  if (first === undefined) return [];
  const counts = new Set(statements.map((statement) => statement.count));
  if (counts.size !== 2) return [];
  return statements
    .filter((statement) => statement.count !== first.count)
    .map((statement) => ({ object: statement.object, value: statement.length, other: first.length }));
};

const groupedBy = (statements: readonly Statement[]): Statement[][] => [
  ...statements
    .reduce((groups, statement) => {
      const key = `${statement.object}\u0000${statement.base}`;
      groups.set(key, [...(groups.get(key) ?? []), statement]);
      return groups;
    }, new Map<string, Statement[]>())
    .values(),
];

/** 同じ名詞句の保存期間が二通り。三通り以上は一覧として言わない。lengths は期間の単位を持つ数量だけ。 */
export const retentionConflicts = (
  source: string,
  sentences: readonly RetentionSentence[],
  lengths: readonly RetentionLength[],
  words: RetentionWords,
): RetentionConflict[] => groupedBy(sentences.flatMap((sentence) => statementOf(source, sentence, lengths, words))).flatMap(conflictsOf);
