import type { Token } from "./plugin.ts";

// 固有名詞の続きが人の名前と読めるか。解析器の人名の印か、後ろの敬称で決める。

/** 人名と読む解析器の印（UD の NameType: 姓 Sur、名 Giv、どちらとも言えない人名 Prs）。 */
const PERSON_TYPES: ReadonlySet<string> = new Set(["Sur", "Giv", "Prs"]);

/** 行の中の空き（半角・全角の空白、タブ）。名前と敬称のあいだに置く（森下 千尋 様）。改行は越えない。 */
const INLINE_BLANK = /^[\t\p{Zs}]+$/u;

/** 名前の後ろの語。行の中の空きを一つ越える（森下 千尋 様 の 様）。 */
const wordAfter = (tokens: readonly Token[], last: Token): Token | undefined => {
  const at = tokens.indexOf(last) + 1;
  const next = tokens[at];
  return next !== undefined && INLINE_BLANK.test(next.surface) ? tokens[at + 1] : next;
};

/** 語の後ろに敬称（様、さん、氏）が付くか。行の中の空きを挟んでもよい。 */
export const isFollowedBySuffix = (token: Token, tokens: readonly Token[], suffixes: readonly string[]): boolean => {
  const next = wordAfter(tokens, token);
  return next !== undefined && suffixes.includes(next.surface);
};

/**
 * 人の名前か。解析器が人名と読む語を含むか、後ろに敬称が付く。解析器は名を地名と読むことがある（千尋 を Geo）ので、敬称は空白を
 * 挟んでも見る。
 */
export const isPersonRun = (run: readonly Token[], tokens: readonly Token[], suffixes: readonly string[]): boolean => {
  const last = run.at(-1);
  return run.some((token) => PERSON_TYPES.has(token.features?.["NameType"] ?? "")) || (last !== undefined && isFollowedBySuffix(last, tokens, suffixes));
};
