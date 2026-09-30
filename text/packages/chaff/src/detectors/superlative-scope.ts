import type { Lexicon, Token } from "../plugin.ts";
import type { TokenRange } from "./lexicon-match.ts";

/**
 * 最上級が範囲を持っているか。「日本で最も」「国内最大」"the best in the world" は、何の中で最もなのかを言っている。
 * 範囲を示す語は言語で違い、置く側も違う（日本語は最上級の前、英語は後ろ）。どちらの語も言語パッケージの語彙表が持つ。
 */
export type ScopeMarkers = {
  /** 最上級の直前に置く語（で）。その前に固有名詞か地名が要る。 */
  readonly before: Lexicon;
  /** 最上級の名詞句の直後に置く語（in・of）。その後ろに名詞句が要る。 */
  readonly after: Lexicon;
};

/** 語彙表の position で分ける。position の無い語は、どちら側の語か分からないので使わない。 */
export const scopeMarkersOf = (lexicon: Lexicon): ScopeMarkers => ({
  before: lexicon.filter((entry) => entry.position === "before"),
  after: lexicon.filter((entry) => entry.position === "after"),
});

const NOMINAL = new Set(["NOUN", "PROPN"]);

/** 名詞句の始まり。the world・Chicago・our products・the three・all。 */
export const PHRASE_START = new Set(["DET", "NOUN", "PROPN", "PRON", "NUM", "ADJ"]);

/** 名詞の前に来る修飾（most skilled・widely used・stuffed）。名詞が出た後は名詞の連なりだけが続く。 */
const PREMODIFIER = new Set(["ADJ", "ADV", "VERB", "NOUN", "PROPN", "NUM"]);
const NOUN_RUN = new Set(["NOUN", "PROPN", "NUM"]);

/** 範囲の前に置ける語。修飾だけで終わった句（the best is in …）は範囲ではなく述語。 */
export const PHRASE_END = new Set(["NOUN", "PROPN", "NUM", "ADJ"]);

const isMarker = (token: Token | undefined, markers: Lexicon): boolean =>
  token !== undefined && markers.some((entry) => entry.pattern.toLowerCase() === token.surface.toLowerCase());

const isNamed = (token: Token | undefined): boolean => token !== undefined && (token.pos === "PROPN" || token.features?.["NameType"] !== undefined);

/** 空白も助詞も挟まずに名詞が付いた最上級（国内最大・業界最速・世界唯一）。前の名詞が範囲。 */
const compound = (tokens: readonly Token[], range: TokenRange): boolean => {
  const before = tokens[range.start - 1];
  const first = tokens[range.start];
  return before !== undefined && first !== undefined && NOMINAL.has(before.pos) && before.span.end === first.span.start;
};

/** 名前 + 範囲の語 + 最上級（日本で最も・トヨタで最も・東京都で最大）。「費用で最大の効果」の「費用」は名前ではないので範囲にしない。 */
const namedBefore = (tokens: readonly Token[], range: TokenRange, markers: Lexicon): boolean =>
  isMarker(tokens[range.start - 1], markers) && isNamed(tokens[range.start - 2]);

/** 最上級に続く名詞句の終わり。名詞が出るまでは修飾を、出た後は名詞の連なりを読む。 */
export const phraseEnd = (tokens: readonly Token[], at: number, nounSeen = false): number => {
  let end = at;
  let seen = nounSeen;
  for (;;) {
    const token = tokens[end];
    if (token === undefined || !(seen ? NOUN_RUN : PREMODIFIER).has(token.pos)) return end;
    seen ||= NOMINAL.has(token.pos);
    end += 1;
  }
};

/** 最上級 + 名詞句 + 範囲の語 + 名詞句（the best pizza in Chicago・the most famous of the sculptures）。 */
const phraseAfter = (tokens: readonly Token[], range: TokenRange, markers: Lexicon): boolean => {
  const at = phraseEnd(tokens, range.end);
  const last = tokens[at - 1];
  const endsPhrase = at === range.end || (last !== undefined && PHRASE_END.has(last.pos));
  const opens = tokens[at + 1];
  return endsPhrase && isMarker(tokens[at], markers) && opens !== undefined && PHRASE_START.has(opens.pos);
};

export const scoped = (tokens: readonly Token[], range: TokenRange, markers: ScopeMarkers): boolean =>
  compound(tokens, range) || namedBefore(tokens, range, markers.before) || phraseAfter(tokens, range, markers.after);
