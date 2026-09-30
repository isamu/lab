// 表記のそろい。書き方の決まりのうち、文字だけで決まるもの。

export const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

/**
 * 字に挟まれた ’ と、どこにあっても ʼ を ' にする（don’t → don't）。語彙表は ' で書くので、’ で書いた本文も同じ語に当てるため。
 * 英語アダプタの解析器が同じ決めかたをする（chaff とアダプタは実行時の値を共有しないので、ここにも置く）。一字を一字に置き換えるので位置は変わらない。
 */
const APOSTROPHE = /(?<=[\p{L}\p{N}])’(?=\p{L})|ʼ/gu;

export const straightApostrophes = (text: string): string => text.replace(APOSTROPHE, "'");

/** text の中で word が現れる [始まり, 終わり) を、左から順に。大文字小文字を区別しないときは i で探す（位置は元の文字列のまま）。 */
const spansOf = (text: string, word: string, ignoreCase: boolean): [number, number][] => {
  const pattern = new RegExp(escapeRegExp(word), ignoreCase ? "giu" : "gu");
  const found: [number, number][] = [];
  for (let match = pattern.exec(text); match !== null; match = pattern.exec(text)) {
    found.push([match.index, match.index + match[0].length]);
    // 重なって現れるものも拾う。次は 1 つ先から探す。
    pattern.lastIndex = match.index + 1;
  }
  return found;
};

/**
 * avoid が現れる位置のうち、use の一部として現れたものを除いたもの。
 * 「ユーザ」を避けて「ユーザー」と書く決まりのとき、「ユーザー」の中の「ユーザ」は指摘しない。
 * 大文字小文字は区別しない（文頭の「E-mail」も「e-mail」）。ただし二つが大文字小文字だけ違う組
 * （「Javascript」→「JavaScript」）は、それ自体が大文字小文字の決まりなので区別して探す。
 */
export const occurrencesOutside = (text: string, avoid: string, use: string): number[] => {
  if (avoid === "") return [];
  const ignoreCase = avoid.toLowerCase() !== use.toLowerCase();
  const covered = use === "" ? [] : spansOf(text, use, ignoreCase);
  const found: number[] = [];
  // covered は始まりの順に並ぶ。始まりが at 以前のものの終わりの最大が end 以上なら、どれかに収まっている。
  let next = 0;
  let reach = -1;
  let at = 0;
  for (const [start, end] of spansOf(text, avoid, ignoreCase)) {
    if (start < at) continue;
    while (next < covered.length && (covered[next]?.[0] ?? Infinity) <= start) {
      reach = Math.max(reach, covered[next]?.[1] ?? -1);
      next += 1;
    }
    if (reach < end) found.push(start);
    at = end;
  }
  return found;
};

export type SpacingKind = "letter" | "before-digit" | "after-digit";
export type Boundary = { readonly offset: number; readonly kind: SpacingKind; readonly spaced: boolean };

const JAPANESE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー]/u;
const LETTER = /[A-Za-z]/u;
const DIGIT = /\d/u;

/** Latin 側の字の種類。digitSide は、その数字が日本語の右（前に日本語）か左（後ろに日本語）か。 */
const kindOf = (char: string | undefined, digitSide: "before-digit" | "after-digit"): SpacingKind | undefined => {
  if (char === undefined) return undefined;
  if (LETTER.test(char)) return "letter";
  return DIGIT.test(char) ? digitSide : undefined;
};

export const isJapanese = (char: string | undefined): boolean => char !== undefined && JAPANESE.test(char);

/** japanese が日本語の字のとき、other の英字・数字の種類。 */
const latinBeside = (japanese: string | undefined, other: string | undefined, digitSide: "before-digit" | "after-digit"): SpacingKind | undefined =>
  isJapanese(japanese) ? kindOf(other, digitSide) : undefined;

/** 日本語の字の隣にある英字・数字との境目。間が半角空白 1 つなら「空けている」、何も無ければ「詰めている」。 */
// 「confidence=0」のような設定の書き方も、= を含めて一つの並びとして読む。
const ALPHANUMERIC = /[A-Za-z0-9.=]/u;
// 名前の語は英数字だけ。「API = 0」の空白で囲んだ = は式の記号で、名前の一部ではない。
const WORD_CHAR = /[A-Za-z0-9.]/u;

/** chars[last] を末尾とし、pattern の字が続く並びの、先頭の位置。 */
const runStartIndex = (chars: readonly string[], last: number, pattern: RegExp = ALPHANUMERIC): number => {
  let first = last;
  while (first > 0 && pattern.test(chars[first - 1] ?? "")) first -= 1;
  return first;
};

/** 並び first の前に、半角空白 1 つずつで続く英数字の語。「Phase 1」の「Phase」、「JIS X 0301」の「JIS X」。無ければ空。 */
const wordsBefore = (chars: readonly string[], first: number): string => {
  const words: string[] = [];
  let space = first - 1;
  while (chars[space] === " " && WORD_CHAR.test(chars[space - 1] ?? "")) {
    const start = runStartIndex(chars, space - 1, WORD_CHAR);
    words.unshift(chars.slice(start, space).join(""));
    space = start - 1;
  }
  return words.join(" ");
};

// 「1ファイル x 1シート」の x のように、1 字だけの英字は記号か変数で、名前の頭ではない。
const MIN_NAME_LETTERS = 2;

/**
 * 「Phase 1 は」「iOS 17以上」の数字は、英字の語に続く名前の一部。空白は名前の中の空白で、日本語との境目は
 * 「H30 等」と同じく英字の空け方として数える。
 */
const isNameTail = (chars: readonly string[], first: number): boolean => {
  const words = wordsBefore(chars, first);
  return LETTER.test(words[0] ?? "") && (words.match(/[A-Za-z]/gu)?.length ?? 0) >= MIN_NAME_LETTERS;
};

/**
 * 日本語の左にある英数字の並びの種類は、先頭の字で決める。「3GBの」の「GB」は数量の単位で、並びは数字で始まる。
 * そうした並びと日本語の境目は、英字の空け方ではなく数字の後ろの空け方として数える（「3回」と同じ）。
 * 逆に「H30 等」「EC2 で」「v1.2の」は英字で始まる名前で、書き手は英単語と同じに空ける。
 */
const leftRunBeside = (chars: readonly string[], last: number, japanese: string | undefined): SpacingKind | undefined => {
  const kind = latinBeside(japanese, chars[last], "after-digit");
  if (kind === undefined) return undefined;
  const first = runStartIndex(chars, last);
  if (DIGIT.test(chars[first] ?? "") && isNameTail(chars, first)) return "letter";
  return kindOf(chars[first], "after-digit") ?? kind;
};

/**
 * 「第3条」「第4条第2項」の数字は番地の書き方で、空けるか詰めるかの好みではない。数えると、条番号の多い文書では
 * 「2 か所」のような普通の書き方のほうが少数に見えてしまう。「第」のすぐ後ろの数字の並びは、両側とも数えない。
 */
const ORDINAL_PREFIX = "第";

const isOrdinalRun = (chars: readonly string[], index: number): boolean => {
  let first = index;
  while (first > 0 && /[\d.]/u.test(chars[first - 1] ?? "")) first -= 1;
  const before = chars[first - 1] === " " ? first - 2 : first - 1;
  return chars[before] === ORDINAL_PREFIX;
};

/**
 * 「073-489-5909」「2026-06-02」「Ⅰ-4-1-3」「5－1－1」のように - でつないだ 3 組以上の数字は、電話番号・日付・図や項目の番号で
 * 数量ではない。後ろの空白は欄の区切りで、「3回」の空け方とは別のもの。両側とも数えない。
 * 2 組（「1-3ヶ月」「20-30分」）は幅のある数量なので数える。
 */
const MIN_CODE_GROUPS = 3;

// 通達の「5－1－1」は全角の「－」でつなぐ。ハイフン「‐」やマイナス「−」も同じに読む。長音「ー」は仮名の一部なので入れない。
/** 正規表現の文字クラスに入れるハイフンの字。- は範囲の記号にならないよう \ を付ける。 */
export const HYPHEN_CHARS = "\\-‐‑−－";
const HYPHEN = new RegExp(`[${HYPHEN_CHARS}]`, "u");

/** 数字をつなぐハイフンか。半角の - のほか、全角・和文のハイフンも。 */
export const isHyphen = (char: string | undefined): boolean => char !== undefined && HYPHEN.test(char);

/** ハイフンで区切った組（空の組は除く）。「5－1－1」は ["5", "1", "1"]。 */
export const hyphenGroups = (text: string): string[] => text.split(HYPHEN).filter((group) => group !== "");

const isCodeChar = (char: string | undefined): boolean => DIGIT.test(char ?? "") || isHyphen(char);

const isCode = (chars: readonly string[], digit: number): boolean => {
  let [first, last] = [digit, digit];
  while (first > 0 && isCodeChar(chars[first - 1])) first -= 1;
  while (last < chars.length - 1 && isCodeChar(chars[last + 1])) last += 1;
  return hyphenGroups(chars.slice(first, last + 1).join("")).length >= MIN_CODE_GROUPS;
};

/** 日本語との境目にある数字が、数えない書き方（「第3条」の番地、「073-489-5909」の符号）か。 */
const isUncountedNumber = (chars: readonly string[], index: number): boolean => {
  const [left, right] = [chars[index], chars[index + 1]];
  if (DIGIT.test(left ?? "")) return isOrdinalRun(chars, index) || isCode(chars, index);
  const next = right === " " ? index + 2 : index + 1;
  if (!DIGIT.test(chars[next] ?? "")) return false;
  return left === ORDINAL_PREFIX || (isJapanese(left) && isCode(chars, next));
};

const candidateAt = (chars: readonly string[], index: number): Omit<Boundary, "offset"> | undefined => {
  const [left, right, after] = [chars[index], chars[index + 1], chars[index + 2]];
  const touching = latinBeside(left, right, "before-digit") ?? leftRunBeside(chars, index, right);
  if (touching !== undefined) return { kind: touching, spaced: false };
  if (right !== " ") return undefined;
  const spaced = latinBeside(left, after, "before-digit") ?? leftRunBeside(chars, index, after);
  return spaced === undefined ? undefined : { kind: spaced, spaced: true };
};

// isUncountedNumber は数字の並びを端まで読む。境目の候補でだけ聞けば、並びの字ごとではなく並びごとに一度で済む。
const boundaryAt = (chars: readonly string[], index: number): Omit<Boundary, "offset"> | undefined => {
  const candidate = candidateAt(chars, index);
  return candidate === undefined || isUncountedNumber(chars, index) ? undefined : candidate;
};

/**
 * 文の中の境目を全部。offset は境目の位置（左の字の直後、UTF-16）。配列を作り直さずに一度なめる。
 * text は本文でないものを空白で覆った文、written は覆う前の同じ範囲。覆ってできた空白（リンクの「[」など）は
 * 書き手が空けたものではないので、「空けている」とは数えない。
 */
export const latinBoundaries = (text: string, written: string = text): Boundary[] => {
  const chars = [...text];
  const found: Boundary[] = [];
  let offset = 0;
  chars.forEach((char, index) => {
    offset += char.length;
    const boundary = boundaryAt(chars, index);
    if (boundary !== undefined && (!boundary.spaced || written[offset] === " ")) found.push({ ...boundary, offset });
  });
  return found;
};

/**
 * 混ざっているとき、そろえるべき少数派。種類（英字・数字の前・数字の後ろ）ごとに数える。
 * 同数なら、文書が先に使った書き方をその文書の書き方とみなし、後から出た書き方を少数派にする。
 */
export const minorityStyle = (boundaries: readonly { readonly spaced: boolean }[]): boolean | undefined => {
  const spaced = boundaries.filter((boundary) => boundary.spaced).length;
  const touching = boundaries.length - spaced;
  if (spaced === 0 || touching === 0) return undefined;
  if (spaced !== touching) return spaced < touching;
  return !(boundaries[0]?.spaced ?? false);
};
