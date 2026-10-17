import type { Token } from "../plugin.ts";

// 同じ助詞のあいだに括弧の注だけがある（「本利用規約は(以下、本規約)は」）。注を書き足したときに、前の助詞を消し忘れた跡。
// 「AはBは」の対比は、あいだに語があるので当たらない。

const MAX_ASIDE = 80;
/** 注の前後に置ける空白（行の中だけ）。 */
const MAX_SPACES = 2;
const SPACES = `[ \\t\\u3000]{0,${String(MAX_SPACES)}}`;
/** 助詞の後ろの、括弧ひとつの注（入れ子でない）とその前後の空白。 */
const ASIDE = new RegExp(`^${SPACES}[（(][^（()）\\n]{1,${String(MAX_ASIDE)}}[)）]${SPACES}`, "u");
/** 括弧と注と前後の空白が収まる長さ。これより先は読まない。 */
const LOOK_AHEAD = MAX_ASIDE + 2 + MAX_SPACES * 2;

/** 「別表の（1）の欄」の「の」は、括弧の番号を挟んで名前を続ける書き方なので数えない。 */
const JOINS_NAMES = "の";

const isParticle = (token: Token): boolean => token.pos === "ADP" && token.surface !== JOINS_NAMES;

/** 二つの同じ助詞と、そのあいだの括弧の注。 */
export type AsidePair = { readonly first: Token; readonly second: Token };

/** first の後ろが括弧の注だけで、その直後に同じ助詞があれば、その助詞。source は文書全体で、token の span もその座標。 */
const particleAfterAside = (source: string, tokens: readonly Token[], first: Token): Token | undefined => {
  const aside = ASIDE.exec(source.slice(first.span.end, first.span.end + LOOK_AHEAD))?.[0];
  if (aside === undefined) return undefined;
  const second = tokens.find((token) => token.span.start === first.span.end + aside.length);
  return second !== undefined && isParticle(second) && second.surface === first.surface ? second : undefined;
};

/** 文の語のうち、括弧の注を挟んで同じ助詞が二度ある所。Pure. */
export const doubledAcrossAside = (source: string, tokens: readonly Token[]): AsidePair[] =>
  tokens.flatMap((first) => {
    const second = isParticle(first) ? particleAfterAside(source, tokens, first) : undefined;
    return second === undefined ? [] : [{ first, second }];
  });
