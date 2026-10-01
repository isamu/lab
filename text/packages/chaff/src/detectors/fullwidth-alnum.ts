import type { Detector, Finding, Sentence, Span } from "../plugin.ts";
import { minorityWithin } from "../orthography.ts";
import { QUOTATION_MARKS, isWithinAny, quotedSpans } from "../quoted-span.ts";
import { isCitation } from "./kutoten-consistency.ts";

/** 英字と数字の並び。半角（ABC123）と全角（ＡＢＣ１２３）。 */
const ALNUM_RUN = /[A-Za-z0-9Ａ-Ｚａ-ｚ０-９]+/gu;
const FULLWIDTH = /^[Ａ-Ｚａ-ｚ０-９]+$/u;
const HALFWIDTH = /^[A-Za-z0-9]+$/u;
const LETTER = /[A-Za-zＡ-Ｚａ-ｚ]/u;

/**
 * 比べる組。英字と数字を分け、一字だけの並びと二字以上の並びも分ける。「１桁は全角、２桁以上は半角」「一字の英字（Ａ案）は全角」と
 * 決めている文書は、組の中ではそろっている。
 */
export type AlnumKind = "letter" | "letters" | "digit" | "digits";

const kindOf = (run: string): AlnumKind => {
  const single = [...run].length === 1;
  if (LETTER.test(run)) return single ? "letter" : "letters";
  return single ? "digit" : "digits";
};

/** 項目の番号の並び（行の頭や括弧の後ろの「１．」「（１）」「1)」）。項目の印で、本文の数ではない。 */
const LABEL_BEFORE = /(?:^|[\s、，,（(［[])$/u;
const LABEL_AFTER = /^[．.）)］\]]/u;
const LABEL_REACH = 1;

/** 注の印（「※１」「（※３）」）。注どうしで決まった書き方をする。 */
const NOTE_MARK = /[※＊*]$/u;

/** 箇条書きの項目の頭（「- ４「勧告」…」）。目次の番号で、本文の数ではない。 */
const LIST_ITEM_HEAD = /^[ \t]*(?:[-*+]|\d{1,9}[.)])[ \t]+$/u;

const isLabel = (text: string, start: number, end: number): boolean =>
  (LABEL_BEFORE.test(text.slice(Math.max(0, start - LABEL_REACH), start)) && LABEL_AFTER.test(text.slice(end, end + LABEL_REACH))) ||
  NOTE_MARK.test(text.slice(0, start));

/**
 * メールアドレスやドメイン名の一部（support@example.com の support・example・com）。字の幅を変えると宛先が壊れる。
 * 点の向こうが英字のときだけ名前の区切りと見る。数の小数点（39.4）は数として数える。
 */
const LETTER_BESIDE = /[A-Za-zＡ-Ｚａ-ｚ]/u;

const isInAddress = (text: string, start: number, end: number): boolean =>
  text.charAt(start - 1) === "@" ||
  text.charAt(end) === "@" ||
  (text.charAt(start - 1) === "." && LETTER_BESIDE.test(text.charAt(start - 2))) ||
  (text.charAt(end) === "." && LETTER_BESIDE.test(text.charAt(end + 1)));

const isListItemNumber = (source: string, offset: number): boolean => LIST_ITEM_HEAD.test(source.slice(source.lastIndexOf("\n", offset - 1) + 1, offset));

export type AlnumRun = { readonly kind: AlnumKind; readonly fullwidth: boolean; readonly written: string; readonly offset: number };

/**
 * 文の中の英字・数字の並び。全角と半角が混ざった並び、鉤括弧で引いたものの中、項目と注の番号、箇条書きの頭の番号は数えない。
 * offset は文書の中の位置。
 */
export const alnumRunsIn = (sentence: Sentence, source: string): AlnumRun[] => {
  const quoted: readonly Span[] = quotedSpans(sentence.text, QUOTATION_MARKS);
  return [...sentence.text.matchAll(ALNUM_RUN)]
    .filter((match) => FULLWIDTH.test(match[0]) || HALFWIDTH.test(match[0]))
    .filter((match) => !isWithinAny(quoted, { start: match.index, end: match.index + match[0].length }))
    .filter((match) => !isLabel(sentence.text, match.index, match.index + match[0].length))
    .filter((match) => !isListItemNumber(source, sentence.span.start + match.index))
    .filter((match) => !isInAddress(sentence.text, match.index, match.index + match[0].length))
    .map((match) => ({ kind: kindOf(match[0]), fullwidth: FULLWIDTH.test(match[0]), written: match[0], offset: sentence.span.start + match.index }));
};

const KINDS: readonly AlnumKind[] = ["letter", "letters", "digit", "digits"];

/** 半角の英数字を全角に（NFKC の逆）。 */
const FULLWIDTH_OFFSET = 0xfee0;
const toFullwidth = (text: string): string => text.replace(/[A-Za-z0-9]/gu, (char) => String.fromCodePoint((char.codePointAt(0) ?? 0) + FULLWIDTH_OFFSET));

/** 同じ並びの、もう一方の幅の書き方。 */
const otherWidth = (run: AlnumRun): string => (run.fullwidth ? run.written.normalize("NFKC") : toFullwidth(run.written));

type Located = { readonly sentence: Sentence; readonly run: AlnumRun };

const findingOf = ({ sentence, run }: Located, count: number, of: number, limit: number): Finding => ({
  rule: "",
  severity: "warning",
  line: 0,
  column: 0,
  quote: sentence.text.trim(),
  values: { written: run.written, other: otherWidth(run), count, of, limit, offset: run.offset },
  variant: run.fullwidth ? "fullwidth" : "halfwidth",
});

/**
 * 英字・数字を全角で書くか半角で書くか。組（英字一字・英字の語・数字一字・数字の並び）ごとに、文書の中で少ないほうを指摘する。
 * 少ないほうが組の limit パーセントを超えるほど多いなら、文書が使い分けている（数え方の語や見出しの書き方）と見て言わない。
 * どちらが正しいかは決めない。
 */
export const fullwidthAlnum: Detector = (doc, options): Finding[] => {
  const located: Located[] = doc.sentences
    .filter((sentence) => sentence.embeddedLanguage === undefined && !isCitation(sentence, doc.source))
    .flatMap((sentence) => alnumRunsIn(sentence, doc.source).map((run) => ({ sentence, run })));
  return KINDS.flatMap((kind) => {
    const ofKind = located.filter(({ run }) => run.kind === kind);
    const odd = minorityWithin(ofKind, ({ run }) => run.fullwidth, options.limit);
    return odd.map((entry) => findingOf(entry, odd.length, ofKind.length, options.limit));
  });
};
