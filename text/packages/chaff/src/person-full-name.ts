import type { NameCue } from "./name-cue.ts";
import type { NameMention } from "./name-variants.ts";
import type { Span, Token } from "./plugin.ts";

// 空白（半角か全角）を挟んで書いた姓と名（田中 裕子）。解析器は空白で名前を切るので、名だけ（裕子）が名前の現れになり、別の人の
// 名（鈴木 祐子 の 祐子）と比べてしまう。姓と名を一つの現れにして、名前まるごとで比べる。

/** 姓と名のあいだの空白（半角、全角）。 */
const NAME_SPACE = /^[ \u3000]$/u;

const nameTypeOf = (token: Token | undefined): string | undefined => (token?.pos === "PROPN" ? token.features?.["NameType"] : undefined);

/** 姓と名を分ける空白の語。前の語を解析器が姓（Sur）、後ろの語を名（Giv）と読む、空白一つ。 */
export const fullNameGaps = (tokens: readonly Token[]): Span[] =>
  tokens.flatMap((token, index) =>
    NAME_SPACE.test(token.surface) && nameTypeOf(tokens[index - 1]) === "Sur" && nameTypeOf(tokens[index + 1]) === "Giv" ? [token.span] : [],
  );

const CUE_STRENGTH: readonly (NameCue | undefined)[] = [undefined, "bare", "slot", "person"];

/** 二つの現れの名前らしさの強いほう。前置き（担当の）は姓の前に、敬称（様）は名の後ろに付く。 */
const strongerCue = (left: NameCue | undefined, right: NameCue | undefined): NameCue | undefined =>
  CUE_STRENGTH.indexOf(left) >= CUE_STRENGTH.indexOf(right) ? left : right;

const joined = (surname: NameMention, given: NameMention): NameMention => {
  const cue = strongerCue(surname.cue, given.cue);
  return {
    ...surname,
    surface: `${surname.surface} ${given.surface}`,
    reading: surname.reading === undefined || given.reading === undefined ? undefined : surname.reading + given.reading,
    words: [...surname.words, ...given.words],
    person: surname.person === true || given.person === true,
    ...(cue === undefined ? {} : { cue }),
  };
};

/** 空白をちょうど挟む、一語の姓と名か。名は解析器が二語に切ることがある（健汰 を 健 と 汰）。 */
const isPair = (surname: NameMention, given: NameMention, gaps: readonly Span[]): boolean =>
  surname.words.length === 1 && gaps.some((gap) => gap.start === surname.offset + surname.surface.length && gap.end === given.offset);

/** 空白を挟んだ一語の姓と名（田中 裕子）を、一つの名前の現れにする。名だけ、姓だけの現れはそのまま。 */
export const joinFullNames = (mentions: readonly NameMention[], gaps: readonly Span[]): NameMention[] => {
  const names: NameMention[] = [];
  mentions
    .toSorted((left, right) => left.offset - right.offset)
    .forEach((mention) => {
      const previous = names.at(-1);
      if (previous !== undefined && isPair(previous, mention, gaps)) names.splice(-1, 1, joined(previous, mention));
      else names.push(mention);
    });
  return names;
};

const LATIN = /\p{Script=Latin}/u;
const withoutSpaces = (surface: string): string => surface.replaceAll(/\s/gu, "");

/**
 * 日本語の名前の、姓と名のあいだの空白だけが違う二つ（田中 裕子 と 田中裕子）。書き方の揺れとしては指さない。英字の名前の空白
 * （Mac OS と MacOS）は名前の書き方の違いなので、ここには入れない。
 */
export const spacedOnly = (left: string, right: string): boolean =>
  left !== right && !LATIN.test(left) && !LATIN.test(right) && withoutSpaces(left) === withoutSpaces(right);
