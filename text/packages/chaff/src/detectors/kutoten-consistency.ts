import type { Detector, Finding, ProseDocument, Sentence, Span } from "../plugin.ts";
import { latinCompanyFormRegExp, latinCompanyFormSpans } from "../latin-company-form.ts";
import { minorityOf } from "../orthography.ts";
import { isWithinAny, quotedSpans } from "../quoted-span.ts";

/** 日本語の読点と句点の、二つの書き方。「、。」と、横書きの論文や公用文に多い「，．」。どちらが正しいかは決めない。 */
type Kind = { readonly id: "comma" | "period"; readonly usual: string; readonly western: string };

const KINDS: readonly Kind[] = [
  { id: "comma", usual: "、", western: "，" },
  { id: "period", usual: "。", western: "．" },
];

const MARKS = /[、，。．]/gu;

const DIGIT = /[\d０-９]/u;

/**
 * 番号の印（行の頭や読点・空白・括弧の後ろの「１．」「２．」）。文の中の数の後ろの点（締切は10．）は文の終わり。
 */
const LIST_NUMBER = /(?:^|[\s、，,（(])[\d０-９]{1,3}$/u;
const LIST_NUMBER_REACH = 4;

/** 一、二文字の英字だけの印（Ｑ．、No．）。「API．」のような語の後ろの点は文の終わり。 */
const LATIN_LABEL = /(?:^|[^A-Za-zＡ-Ｚａ-ｚ])[A-Za-zＡ-Ｚａ-ｚ]{1,2}$/u;
const LATIN_LABEL_REACH = 3;

/** 片仮名の印（イ．ロ．ハ．）。語彙表 item-number の 1 字の片仮名で、前が片仮名でないとき（データ．の タ は語の終わり）。 */
const KATAKANA = /^[ァ-ヺー]$/u;

/** 句読点として数えない印と名前。kana は片仮名の項目の印、companyForms は英字の会社の形（CO.，LTD.）。 */
export type MarkExceptions = { readonly kana: ReadonlySet<string>; readonly companyForms: RegExp | undefined };

/**
 * 印の点の後ろには、同じ行に項目の本文が続く。行の終わりの点（対象はロ．、締切は（予定）10．）は句点。
 * 文は「イ．」の点で割れることがあるので、文ではなく文書の行の続きを見る。
 */
const isFollowed = (source: string, offset: number): boolean => (source.slice(offset + 1).split("\n", 1)[0] ?? "").trim() !== "";

type Place = { readonly text: string; readonly at: number; readonly source: string; readonly offset: number };

const isKanaLabel = ({ text, at, source, offset }: Place, kana: ReadonlySet<string>): boolean =>
  kana.has(text.charAt(at - 1)) && !KATAKANA.test(text.charAt(at - 2)) && isFollowed(source, offset);

/** 括弧や句点の後ろの番号（(注)１．、事項）１．）。数の後ろに本文が続くときだけ印と読む。 */
const CLOSED_NUMBER = /[。）)】］\]][\d０-９]{1,3}$/u;

const FULLWIDTH_OFFSET = 0xfee0;
const TRAILING_NUMBER = /[\d０-９]{1,3}$/u;
const asNumber = (digits: string): number => Number(digits.replace(/[０-９]/gu, (char) => String.fromCharCode(char.charCodeAt(0) - FULLWIDTH_OFFSET)));

/**
 * 行が改行を失って続いた注（…持株会２．株式分割…３．有償…）の番号。同じ行の前に一つ前の番号の印（１．）があり、後ろに本文が続く。
 * 文の中の数の後ろの句点（締切は10．）は、前に「９．」が無い。
 */
const isNextInRun = ({ source, offset }: Place): boolean => {
  const lineStart = source.lastIndexOf("\n", offset) + 1;
  const before = source.slice(lineStart, offset);
  const digits = TRAILING_NUMBER.exec(before)?.[0];
  if (digits === undefined || !isFollowed(source, offset)) return false;
  const previous = asNumber(digits) - 1;
  const earlier = before.slice(0, -digits.length);
  return previous > 0 && [...earlier.matchAll(/(?<![\d０-９])([\d０-９]{1,3})[．.](?![\d０-９])/gu)].some((match) => asNumber(match[1] ?? "") === previous);
};

const isInsideNumber = (text: string, at: number): boolean => DIGIT.test(text.charAt(at - 1)) && DIGIT.test(text.charAt(at + 1));

const isLabelPeriod = (place: Place, kana: ReadonlySet<string>): boolean => {
  const { text, at } = place;
  const beforeNumber = text.slice(Math.max(0, at - LIST_NUMBER_REACH), at);
  return (
    isKanaLabel(place, kana) ||
    (CLOSED_NUMBER.test(beforeNumber) && isFollowed(place.source, place.offset)) ||
    isNextInRun(place) ||
    LIST_NUMBER.test(beforeNumber) ||
    LATIN_LABEL.test(text.slice(Math.max(0, at - LATIN_LABEL_REACH), at))
  );
};

/**
 * 句読点として数えない「，」「．」。数の中の桁の区切りと小数点（１，０００、３．５）、番号の印の点（１．はじめに、、２．確認、イ．）、
 * 一、二文字の英字の印の後ろの点（Ｑ．、No．）は、日本語の文の区切りではない。
 */
const isNotPunctuation = (place: Place, mark: string, kana: ReadonlySet<string>): boolean => {
  if (mark === "．") return isInsideNumber(place.text, place.at) || isLabelPeriod(place, kana);
  if (mark === "，") return isInsideNumber(place.text, place.at);
  return false;
};

export type Mark = { readonly kind: Kind["id"]; readonly western: boolean; readonly mark: string; readonly offset: number };

/**
 * 文の中の句読点。鉤括弧で引いたものの中は引いた元の書き方、英字の会社の形（CO.，LTD.）の中は名前の一部なので数えない。
 * offset は文書の中の位置。
 */
export const marksIn = (sentence: Sentence, source: string, exceptions: MarkExceptions): Mark[] => {
  const skipped: readonly Span[] = [...quotedSpans(sentence.text), ...latinCompanyFormSpans(sentence.text, exceptions.companyForms)];
  return [...sentence.text.matchAll(MARKS)]
    .filter((match) => {
      const place = { text: sentence.text, at: match.index, source, offset: sentence.span.start + match.index };
      return !isNotPunctuation(place, match[0], exceptions.kana);
    })
    .filter((match) => !isWithinAny(skipped, { start: match.index, end: match.index }))
    .map((match) => {
      const western = match[0] === "，" || match[0] === "．";
      const kind = match[0] === "、" || match[0] === "，" ? "comma" : "period";
      return { kind, western, mark: match[0], offset: sentence.span.start + match.index };
    });
};

/**
 * 注や文献の番号と空白で始まる行（白書の「2 亀田健司，「…」，2018年」、「[1] 山田太郎，…」「注1 …」「※1 …」）。
 * 白書や論文の注と文献は、本文と違う区切り方で書く決まりがある。
 */
const NOTE_NUMBER = /^(?:[\d０-９]{1,3}|[[［][\d０-９]{1,3}[\]］]|注[\d０-９]{1,3}|※[\d０-９]{0,3})[\u3000 ]/u;

const URL_SCHEME = /https?:\/\//u;

/** 文献や出典を挙げた文。注の番号で始まるか、URL を含む。区切りは引いた元や文献の書き方に従う。 */
export const isCitation = (sentence: Sentence, source: string): boolean =>
  NOTE_NUMBER.test(sentence.text.trimStart()) || URL_SCHEME.test(source.slice(sentence.span.start, sentence.span.end));

type Tally = { readonly count: number; readonly of: number; readonly limit: number };

const findingOf = (sentence: Sentence, entry: Mark, kind: Kind, tally: Tally): Finding => ({
  rule: "",
  severity: "warning",
  line: 0,
  column: 0,
  quote: sentence.text.trim(),
  values: { mark: entry.mark, usual: entry.western ? kind.usual : kind.western, ...tally, offset: entry.offset },
  variant: entry.kind,
});

const exceptionsOf = (doc: ProseDocument): MarkExceptions => {
  const patterns = (name: string): string[] => (doc.lexicons[name] ?? []).map((entry) => entry.pattern);
  return {
    kana: new Set(patterns("item-number").filter((pattern) => KATAKANA.test(pattern))),
    companyForms: latinCompanyFormRegExp(patterns("company-form-latin")),
  };
};

/**
 * 読点（、と，）と句点（。と．）を、それぞれ文書の中でどちらかにそろえているか。混ざっていれば少ないほうを指摘する。
 * latin-spacing と同じく、同数なら文書が先に使った書き方をその文書の書き方とする。
 */
export const kutotenConsistency: Detector = (doc, options): Finding[] => {
  const exceptions = exceptionsOf(doc);
  const located = doc.sentences
    .filter((sentence) => !isCitation(sentence, doc.source))
    .flatMap((sentence) => marksIn(sentence, doc.source, exceptions).map((entry) => ({ sentence, entry })));
  return KINDS.flatMap((kind) => {
    const ofKind = located.filter(({ entry }) => entry.kind === kind.id);
    const minority = minorityOf(ofKind.map(({ entry }) => entry.western));
    if (minority === undefined) return [];
    const odd = ofKind.filter(({ entry }) => entry.western === minority);
    if (odd.length < options.limit) return [];
    const tally = { count: odd.length, of: ofKind.length, limit: options.limit };
    return odd.map(({ sentence, entry }) => findingOf(sentence, entry, kind, tally));
  });
};
