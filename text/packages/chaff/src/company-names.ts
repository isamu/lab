import { nameKey } from "./name-variants.ts";
import { escapeRegExp } from "./orthography.ts";

// 会社の名前を、文書の中で二通りに書いた所（株式会社アオバシステム と アオバシステム株式会社、Aoba Systems Inc. と Aoba Systems Ltd.）。
// 会社の形の語（株式会社、Inc）は語彙表 company-form が言う。group が同じ語は同じ形（Inc と Incorporated、株式会社 と (株)）、
// position は名前のどちら側に立つか（無ければどちらにも立つ）。名前の部分は、形の語のすぐ隣の、名前に使う字の連なり。

export type CompanyForm = { readonly pattern: string; readonly group: string; readonly position?: "before" | "after" | undefined };

/** surface は形の語も含めた書いたまま。base は名前の部分、form は形の組、position は形の語が名前のどちら側にあるか。 */
export type CompanyMention = {
  readonly surface: string;
  readonly offset: number;
  readonly base: string;
  readonly form: string;
  readonly position: "before" | "after";
};

/** 二つの書き方の違い。spelling は記号・幅・大小だけ、form は会社の形、position は形の語の側、near は名前の一字違い。 */
type CompanyRelation = "spelling" | "form" | "position" | "near";

type CompanyVariant = { readonly mention: CompanyMention; readonly usual: string; readonly kind: CompanyRelation };

/** 名前の部分が、品詞解析が固有名詞と読んだ語に掛かるか。漢字だけの名前（清算、当該）は、ふつうの語と区別がつかない。 */
export type IsProper = (start: number, end: number) => boolean;

const LATIN = /\p{Script=Latin}/u;
const LETTER = /\p{L}/u;
/** 漢字・かなの名前に使う字。ひらがなは名前の頭にだけ立つ（kanaHeadOf）。 */
const CJK_NAME = /[\p{Script=Katakana}\p{Script=Han}\p{Script=Latin}\p{N}ー・&＆]/u;
const NOT_HAN_LETTER = /(?!\p{Script=Han})\p{L}/u;
/** 英字の名前の一語。大文字か数字で始まる。 */
const LATIN_WORD = /^[\p{Lu}\p{N}][\p{L}\p{N}&'’.-]*$/u;
const AMPERSAND = "&";
/** 形の語のすぐあとに空白一つで大文字の語が続けば、形の語は長い名前の一部（Limited Partnership、Corporation Tax）。Inc. のあとの文や行は続きでない。 */
const CONTINUED = /^ \p{Lu}/u;

const occurrencesOf = (source: string, pattern: string): number[] => [...source.matchAll(new RegExp(escapeRegExp(pattern), "gu"))].map((match) => match.index);

/** 英字の語の続き。ハイフンでつないだ語（Limited-time）も一つの語。 */
const WORD_CONTINUES = /[\p{L}\p{N}-]/u;

/** 英字の形の語は、語の続き（Including の Inc、Limited-time の Limited）では形の語と読まない。 */
const standsAsWord = (source: string, pattern: string, at: number): boolean =>
  !LATIN.test(pattern) || (!LETTER.test(source.charAt(at - 1)) && !WORD_CONTINUES.test(source.charAt(at + pattern.length)));

type Span = { readonly start: number; readonly end: number };

/** 英字の名前: 形の語の前の、大文字で始まる語の続き。頭の、固有名詞と読めない語（文頭の Contact）は外す。 */
const latinBaseBefore = (source: string, end: number, isProper: IsProper): Span | undefined => {
  const before = source.slice(0, end).replace(/,?\s$/u, "");
  const words = [...before.matchAll(/\S+/gu)].map((match): Span => ({ start: match.index, end: match.index + match[0].length }));
  const isNameWord = (span: Span): boolean => {
    const word = source.slice(span.start, span.end);
    return LATIN_WORD.test(word) || word === AMPERSAND;
  };
  const run = words.slice(
    words.findLastIndex((span, index) => !isNameWord(span) || before.slice(span.end, words[index + 1]?.start ?? before.length).includes("\n")) + 1,
  );
  const first = run.find((span) => isProper(span.start, span.end));
  return first === undefined ? undefined : { start: first.start, end: before.length };
};

const CJK_BEFORE = new RegExp(`${CJK_NAME.source}+$`, "u");
const CJK_AFTER = new RegExp(`^${CJK_NAME.source}+`, "u");
const SPACES: ReadonlySet<string> = new Set([" ", "\u3000"]);

/**
 * 名前の頭のひらがなを切り分ける語（語彙表 company-name-kana）。particles は前の語に続けて書く語（は、と、における）、openers は
 * 句読点や行の頭に立つ語（また、なお）、ends は名前の頭の終わりに来ない字（の、る、て）。
 */
export type KanaStops = { readonly particles: readonly string[]; readonly openers: readonly string[]; readonly ends: readonly string[] };

/** ひらがなの前に何があるか。word は語や閉じ括弧（当社はこもれび、）により）、form は会社の形の語（株式会社こもれび）、boundary は句読点や行の頭。 */
export type KanaLead = "word" | "form" | "boundary";

const MIN_KANA_HEAD_LENGTH = 2;

const longestPrefix = (text: string, words: readonly string[]): string | undefined =>
  words.filter((word) => text.startsWith(word)).toSorted((left, right) => right.length - left.length)[0];

/**
 * 漢字やカタカナの名前のすぐ前のひらがなのうち、名前の頭と読む所（はこもれび の こもれび）。語のすぐ後ろなら助詞で始まるときだけ、
 * その後ろを読む。形の語のすぐ後ろなら助詞で始まらないときだけ。二字以上で、句読点の後に立つ語で始まらず、助詞や動詞の終わりの字で終わらないもの。
 * 語彙表が無ければ（英語の文書）ひらがなは名前に入れない。
 */
export const kanaHeadOf = (kana: string, lead: KanaLead, stops: KanaStops): string | undefined => {
  if (stops.particles.length === 0) return undefined;
  const particle = longestPrefix(kana, stops.particles);
  if ((lead === "word" && particle === undefined) || (lead === "form" && particle !== undefined)) return undefined;
  const head = lead === "word" ? kana.slice(particle?.length ?? 0) : kana;
  if ([...head].length < MIN_KANA_HEAD_LENGTH || longestPrefix(head, stops.openers) !== undefined) return undefined;
  return stops.ends.some((end) => head.endsWith(end)) ? undefined : head;
};

/** ひらがなをその前の語に続けて読む字。閉じ括弧や数字の後ろのひらがなも助詞（）により、第3条の）。 */
const GLUED = /[\p{L}\p{N}\p{Pe}\p{Pf}]/u;
const HIRAGANA = /\p{Script=Hiragana}/u;
const KANA_AFTER = /^\p{Script=Hiragana}+/u;

/** end の前に続くひらがなの始まり。 */
const kanaRunStart = (source: string, end: number): number => {
  let start = end;
  while (start > 0 && HIRAGANA.test(source.charAt(start - 1))) start -= 1;
  return start;
};

/** 名前の前に続くひらがなのうち、名前の頭と読む所を足した始まり。 */
const withKanaHead = (source: string, start: number, stops: KanaStops): number => {
  const kanaStart = kanaRunStart(source, start);
  if (kanaStart === start) return start;
  const lead = GLUED.test(source.charAt(kanaStart - 1)) ? "word" : "boundary";
  return start - (kanaHeadOf(source.slice(kanaStart, start), lead, stops)?.length ?? 0);
};

/** 漢字・かなの名前: 形の語の隣の、名前に使う字の続き。形の語との間の空白一つは名前の外。 */
const cjkBaseBefore = (source: string, end: number, stops: KanaStops): Span | undefined => {
  const stop = SPACES.has(source.charAt(end - 1)) ? end - 1 : end;
  const match = CJK_BEFORE.exec(source.slice(0, stop));
  return match === null ? undefined : { start: withKanaHead(source, match.index, stops), end: stop };
};

/** 形の語の後ろの名前。ひらがなで始まる名前（株式会社こもれび珈琲）は、ひらがなの後ろに名前に使う字が続くときだけ。 */
const cjkBaseAfter = (source: string, start: number, stops: KanaStops): Span | undefined => {
  const from = SPACES.has(source.charAt(start)) ? start + 1 : start;
  const kana = KANA_AFTER.exec(source.slice(from))?.[0] ?? "";
  const head = kana === "" ? "" : kanaHeadOf(kana, "form", stops);
  if (head === undefined) return undefined;
  const match = CJK_AFTER.exec(source.slice(from + head.length));
  return match === null ? undefined : { start: from, end: from + head.length + match[0].length };
};

/** 名前の部分の字数。一字（法令の項目の印 イ、ロ）は名前と読まない。 */
const MIN_BASE_LENGTH = 2;

/** 名前と読めるか。二字以上で、記号で始まり終わらず、漢字だけなら固有名詞と読めるもの。 */
const isNameBase = (source: string, span: Span, isProper: IsProper): boolean => {
  const base = source.slice(span.start, span.end);
  if ([...base].length < MIN_BASE_LENGTH || /^[・&＆]|[・&＆]$/u.test(base)) return false;
  return NOT_HAN_LETTER.test(base) || isProper(span.start, span.end);
};

const mentionOf = (source: string, base: Span, form: Span, group: string): CompanyMention => {
  const position = form.start < base.start ? "before" : "after";
  const [start, end] = [Math.min(base.start, form.start), Math.max(base.end, form.end)];
  return { surface: source.slice(start, end), offset: start, base: source.slice(base.start, base.end), form: group, position };
};

const baseBefore = (source: string, at: number, latin: boolean, isProper: IsProper, stops: KanaStops): Span | undefined =>
  latin ? latinBaseBefore(source, at, isProper) : cjkBaseBefore(source, at, stops);

/** 形の語の一つの現れから、会社の名前の現れ。名前が前にあればそれを、無ければ後ろを取る。 */
const mentionAt = (source: string, form: CompanyForm, at: number, isProper: IsProper, stops: KanaStops): CompanyMention | undefined => {
  const formSpan = { start: at, end: at + form.pattern.length };
  const latin = LATIN.test(form.pattern);
  if (latin && CONTINUED.test(source.slice(formSpan.end))) return undefined;
  const before = form.position === "before" ? undefined : baseBefore(source, at, latin, isProper, stops);
  if (before !== undefined && isNameBase(source, before, isProper)) return mentionOf(source, before, formSpan, form.group);
  const after = form.position === "after" || latin ? undefined : cjkBaseAfter(source, formSpan.end, stops);
  return after !== undefined && isNameBase(source, after, isProper) ? mentionOf(source, after, formSpan, form.group) : undefined;
};

/** 文書の中の会社の名前の現れ。長い形の語（Co., Ltd）を先に取り、その中の短い語（Ltd）は数えない。 */
export const companyMentionsIn = (source: string, forms: readonly CompanyForm[], isProper: IsProper, stops: KanaStops): CompanyMention[] => {
  const taken: Span[] = [];
  return forms
    .toSorted((left, right) => right.pattern.length - left.pattern.length)
    .flatMap((form) =>
      occurrencesOf(source, form.pattern).flatMap((at) => {
        const end = at + form.pattern.length;
        if (!standsAsWord(source, form.pattern, at) || taken.some((span) => span.start < end && at < span.end)) return [];
        taken.push({ start: at, end });
        const mention = mentionAt(source, form, at, isProper, stops);
        return mention === undefined ? [] : [mention];
      }),
    )
    .toSorted((left, right) => left.offset - right.offset);
};

const MIN_SLIP_LENGTH = 7;

const spliced = (chars: readonly string[], at: number, count: number): string => chars.toSpliced(at, count).join("");
const firstDifference = (left: readonly string[], right: readonly string[]): number => left.findIndex((char, index) => char !== right[index]);

/** 一字の抜けなら、その字。 */
const droppedChars = (longer: readonly string[], shorter: readonly string[]): string[] | undefined => {
  if (longer.length !== shorter.length + 1) return undefined;
  const at = firstDifference(longer, shorter);
  return spliced(longer, at, 1) === shorter.join("") ? [longer[at] ?? ""] : undefined;
};

/** 一字の置き換えか、隣どうしの入れ替えなら、その字。 */
const replacedChars = (left: readonly string[], right: readonly string[]): string[] | undefined => {
  const at = firstDifference(left, right);
  const changed = [left[at] ?? "", right[at] ?? ""];
  if (left.length !== right.length || at < 0) return undefined;
  if (spliced(left, at, 1) === spliced(right, at, 1)) return changed;
  const swapped = left[at] === right[at + 1] && left[at + 1] === right[at] && spliced(left, at, 2) === spliced(right, at, 2);
  return swapped ? changed : undefined;
};

/**
 * 名前の部分が一字違いか（置き換え・抜け・隣どうしの入れ替え）。違う字が漢字なら見ない。漢字の一字違い（日本電気 と 日本電機）
 * は別の会社のことがある。短い名前（Alpha と Alpho）も別の会社のことが多い。
 */
const isSlip = (left: string, right: string): boolean => {
  const [leftChars, rightChars] = [[...left], [...right]];
  if (Math.min(leftChars.length, rightChars.length) < MIN_SLIP_LENGTH) return false;
  const changed = replacedChars(leftChars, rightChars) ?? droppedChars(leftChars, rightChars) ?? droppedChars(rightChars, leftChars);
  return changed !== undefined && changed.every((char) => NOT_HAN_LETTER.test(char));
};

/** 名前の部分が同じ二つ。同じ形の短い書き方と長い書き方（株式会社 と (株)、Inc と Incorporated）は書き分けと見ない。 */
const sameNameRelation = (left: CompanyMention, right: CompanyMention): CompanyRelation | undefined => {
  if (left.form !== right.form) return "form";
  if (left.position !== right.position) return "position";
  return nameKey(left.surface) === nameKey(right.surface) ? "spelling" : undefined;
};

/**
 * 二つの書き方が、同じ会社を二通りに書いたものか。名前の部分が同じ（記号・幅・大小を除いて）なら、形の組か形の語の側の違い、
 * どちらも同じなら記号・幅・大小だけの違い。名前の部分が違うのは、形も側も同じで、漢字でない字の一字違いのときだけ（Aoba Systems と
 * Aoba System）。名前の違う会社（親会社と子会社、別の取引先）は、名前の部分が一字より多く違うので同じと見ない。
 */
export const companyRelation = (left: CompanyMention, right: CompanyMention): CompanyRelation | undefined => {
  if (left.surface === right.surface) return undefined;
  const [leftKey, rightKey] = [nameKey(left.base), nameKey(right.base)];
  if (leftKey === rightKey) return sameNameRelation(left, right);
  return left.form === right.form && left.position === right.position && isSlip(leftKey, rightKey) ? "near" : undefined;
};

type Tally = { readonly first: CompanyMention; readonly count: number };

const talliesOf = (mentions: readonly CompanyMention[]): Tally[] => {
  const tallies = new Map<string, Tally>();
  mentions.forEach((mention) => {
    const tally = tallies.get(mention.surface);
    tallies.set(mention.surface, { first: tally?.first ?? mention, count: (tally?.count ?? 0) + 1 });
  });
  return [...tallies.values()];
};

/** 多いほうが先。同数なら先に書いたほう。 */
const byUsage = (left: Tally, right: Tally): number => right.count - left.count || left.first.offset - right.first.offset;

/** 同じ会社の、少ないほうの書き方。同じ会社と言える相手のうち一番多いものと比べる。書き方ごとに最初の現れを一つ。 */
export const companyVariants = (mentions: readonly CompanyMention[]): CompanyVariant[] => {
  const tallies = talliesOf(mentions);
  return tallies.flatMap((tally) => {
    const [usual] = tallies.filter((other) => other === tally || companyRelation(tally.first, other.first) !== undefined).toSorted(byUsage);
    const kind = usual === undefined || usual === tally ? undefined : companyRelation(tally.first, usual.first);
    return usual === undefined || kind === undefined ? [] : [{ mention: tally.first, usual: usual.first.surface, kind }];
  });
};
