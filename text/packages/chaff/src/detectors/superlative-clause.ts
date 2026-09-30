import type { Lexicon, Token } from "../plugin.ts";
import type { TokenRange } from "./lexicon-match.ts";
import { PHRASE_END, PHRASE_START, phraseEnd } from "./superlative-scope.ts";

/** 最上級の名詞句を後ろから限る語。どちらも言語パッケージの語彙表が持つ。 */
export type Restrictors = {
  /** 名詞の後ろで関係節を始める語（that・which）。空の言語は、名詞の後ろに節を置かない。 */
  readonly relatives: Lexicon;
  /** 最上級を手に入る範囲に限る形容詞（possible・available）。 */
  readonly bounds: Lexicon;
  /** 節の主語になる代名詞（we・they）。themselves のような再帰の代名詞は主語にならない。 */
  readonly subjects: Lexicon;
};

const VERBAL = new Set(["VERB", "AUX"]);

const isWord = (token: Token | undefined, words: Lexicon): boolean =>
  token !== undefined && words.some((entry) => entry.pattern.toLowerCase() === token.surface.toLowerCase());

const isVerbal = (token: Token | undefined): boolean => token !== undefined && VERBAL.has(token.pos);

/** 節の主語（we・managers・the team・this）を読み飛ばした先に動詞があるか。主語の無い節（that has defined）は動詞で始まる。 */
const verbAfterSubject = (tokens: readonly Token[], at: number, subjects: Lexicon): boolean => {
  if (isVerbal(tokens[at])) return true;
  if (isWord(tokens[at], subjects)) return isVerbal(tokens[at + 1]);
  if (tokens[at]?.pos === "DET") return isVerbal(tokens[at + 1]) || isVerbal(tokens[phraseEnd(tokens, at + 1)]);
  return isVerbal(tokens[phraseEnd(tokens, at)]);
};

const isArticle = (token: Token | undefined): boolean => token?.features?.["PronType"] === "Art";

/**
 * 関係詞を省いた節の主語は、代名詞（the best we have measured）か冠詞で始まる名詞句（the best option the team selected）。
 * each・all のような限定詞（The best teams all adapt）や、冠詞の無い名詞（The best teams adapt）は節の始まりと読まない。
 */
const contactClause = (tokens: readonly Token[], at: number, subjects: Lexicon): boolean => {
  if (isWord(tokens[at], subjects)) return isVerbal(tokens[at + 1]);
  return isArticle(tokens[at]) && isVerbal(tokens[phraseEnd(tokens, at + 1)]);
};

/** 関係節（the threats that we have seen・the option which we chose）と、関係詞を省いた節。 */
const clause = (tokens: readonly Token[], at: number, restrictors: Restrictors): boolean =>
  isWord(tokens[at], restrictors.relatives) ? verbAfterSubject(tokens, at + 1, restrictors.subjects) : contactClause(tokens, at, restrictors.subjects);

/** 分詞の後ろに文の動詞があるか。and を挟んだ動詞（The best option changed quickly and won）は分詞と並ぶ述語。 */
const mainVerbFollows = (tokens: readonly Token[], at: number): boolean => {
  const rest = tokens.slice(at + 1);
  const verb = rest.findIndex(isVerbal);
  return verb !== -1 && !rest.slice(0, verb).some((token) => token.pos === "CCONJ");
};

/**
 * 名詞の後ろの過去分詞（the most scalable option discussed）。名詞句が動詞の目的語か補語で（We chose the best option discussed）、
 * または分詞の後ろに文の動詞がある（The best results obtained were poor）ときだけ。目的語を取る分詞（The best solution
 * proposed a fix）と、ほかに述語の無い分詞（The best option changed.）は文の動詞。
 */
const participle = (tokens: readonly Token[], range: TokenRange, at: number): boolean => {
  const next = tokens[at + 1];
  if (tokens[at]?.features?.["VerbForm"] !== "Part" || (next !== undefined && PHRASE_START.has(next.pos))) return false;
  return isVerbal(tokens[range.start - 1]) || mainVerbFollows(tokens, at);
};

/** 最上級のすぐ後ろ（the best possible outcome）か、名詞句の後ろ（the best education possible）。 */
const bounded = (tokens: readonly Token[], range: TokenRange, at: number, bounds: Lexicon): boolean =>
  isWord(tokens[range.end], bounds) || isWord(tokens[at], bounds);

/** 修飾の語は名詞の前に来るので、句の後ろで止まった分詞は名詞の後ろにある。 */
const clauseOrParticiple = (tokens: readonly Token[], range: TokenRange, at: number, restrictors: Restrictors): boolean => {
  const last = tokens[at - 1];
  const endsPhrase = at === range.end || (last !== undefined && PHRASE_END.has(last.pos));
  return (endsPhrase && clause(tokens, at, restrictors)) || participle(tokens, range, at);
};

/**
 * 最上級の名詞句を後ろの節か分詞か形容詞が限っているか（the best we have measured・the most scalable option discussed・
 * the best education possible）。何の中で最もなのかを言っているので、限定の無い最上級ではない。
 * 名詞の後ろに節を置かない言語は関係詞の語彙表が空で、節も分詞も読まない。
 */
export const restricted = (tokens: readonly Token[], range: TokenRange, restrictors: Restrictors): boolean => {
  const at = phraseEnd(tokens, range.end);
  return bounded(tokens, range, at, restrictors.bounds) || (restrictors.relatives.length > 0 && clauseOrParticiple(tokens, range, at, restrictors));
};
