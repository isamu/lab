import type { Token } from "../plugin.ts";
import { quotedSpans } from "../quoted-span.ts";

/** 題の付いたものの名前を閉じる語（語彙表 title-ending: 〜要綱、〜試験、〜事業、〜法）。 */
export type TitleWords = { readonly endings: readonly string[] };

/** 題を囲む括弧。鉤括弧と、見出しや分類の名前を囲む隅付き括弧。 */
const TITLE_MARKS = { "「": "」", "『": "』", "【": "】" };
/**
 * 名前のすぐ後ろ（同じ行の空白を挟んでもよい）に付く、その名前の補い（就職氷河期世代、＜創業型＞）、略称（以下「奨励金」という。）、
 * 日付や番号、ファイルの種類と大きさ（[PDFファイル／333KB]）の括弧。角括弧は同じ行で閉じ、Markdown のリンク（[文字](…)）でないもの。
 * 半角の < は HTML の札と見分けられないので読まない。
 */
const QUALIFIER = /^[ \t\u3000]*(?:[（(＜〈［]|\[[^\]\n]*\](?![([]))/u;
/** 閉じる語の前に要る字数。1 字なら、題ではなく普通の語（新法、本事業）。 */
const MIN_BODY_LENGTH = 2;
const BLANK = /^\s*$/u;

const surfaceOf = (tokens: readonly Token[]): string => tokens.map((token) => token.surface).join("");

/**
 * 連なりの語（run: 隙間なく並ぶ語）が、題の名前を閉じる語で終わるか。閉じる語は語の切れ目で始まる
 * （地方自治法の「法」は語、解決方法の「法」は方法の一部）。閉じる語の前に 2 字以上の語が要る。
 */
export const endsInTitle = (run: readonly Token[], words: TitleWords): boolean =>
  run.some((_, at) => {
    const tail = surfaceOf(run.slice(at));
    return words.endings.includes(tail) && [...surfaceOf(run.slice(0, at))].length >= MIN_BODY_LENGTH;
  });

/**
 * 文（text）の start から end までの連なりが、題の名前の置き方をしているか。
 * 括弧の中身の終わりで閉じる（「令和8年度高度統計人材育成強化拠点形成事業」）、すぐ後ろに補いの括弧が付く
 * （国家公務員中途採用者選考試験（就職氷河期世代）、持続化補助金＜創業型＞、登録申込書 [PDFファイル／333KB]）、
 * または文がその連なりだけ（要綱の題を並べた行）。
 */
export const isTitlePosition = (text: string, start: number, end: number): boolean => {
  const closesBracket = quotedSpans(text, TITLE_MARKS).some((span) => span.end === end && span.start <= start);
  const qualified = QUALIFIER.test(text.slice(end));
  const alone = BLANK.test(text.slice(0, start)) && BLANK.test(text.slice(end));
  return closesBracket || qualified || alone;
};

/**
 * 文書の中で題として置かれた名前（titled: 題の置き方をした連なりと、見出しの中の漢字の連なり）に、
 * この連なりの字（text）が名前の終わりとして含まれるか。同じ名前は、文の中で使っても名前（認定職業訓練実施奨励金の支給額）。
 */
export const isTitledName = (text: string, titled: readonly string[]): boolean => titled.some((name) => name.endsWith(text));
