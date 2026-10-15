// 平文の契約の見出し。Markdown の見出しを使わない契約（.txt）は、行の頭や文の切れ目に「9. Indemnification.」
// 「Section 2.3   Appraisal Shares.」と番号と題を書く。木は本文の番号と見分けられないのでこれを番地にしないが、
// 参照の行き先としては読める。目次の行（「Section 2.3 Appraisal Shares 4」）は題が点で閉じないので見出しにしない。

/** 書かれた見出し。address は参照の target と同じ形（「6.1」）。start は見出しの位置。 */
export type WrittenHeading = { readonly address: string; readonly start: number };

/** 参照の位置と行き先。木の reference の節点から取る。 */
export type ReferenceSpan = { readonly start: number; readonly end: number; readonly target: string };

/** 題の語の数の上限。見出しの題は短い。 */
const MAX_TITLE_WORDS = 15;
/** 題の語: 文字で始まり、文字・アポストロフィ・アンパサンド・ハイフンが続き、読点やセミコロンで終わってもよい。数字は入らない。 */
const TITLE_WORD = /^\p{L}[\p{L}’'&-]*[,;]?$/u;
const CAPITAL = /^\p{Lu}/u;

/**
 * Title Case の題か（「Effect on Capital Stock of the Company and Merger Sub」）。最初の語が大文字で始まり、語の半分より多くが
 * 大文字で始まり、数字を含まない。文（「The Company shall comply」）は小文字の語が多いので当たらない。Pure.
 */
export const isTitle = (title: string): boolean => {
  const words = title.trim().split(/\s+/u);
  const [first] = words;
  if (first === undefined || first === "" || words.length > MAX_TITLE_WORDS || !words.every((word) => TITLE_WORD.test(word))) return false;
  return CAPITAL.test(first) && words.filter((word) => CAPITAL.test(word)).length * 2 > words.length;
};

/** 点で閉じた題（「Appraisal Shares. As used」の「Appraisal Shares」）。点の後ろは空白か行末。無ければ undefined。 */
const MAX_TITLE_LENGTH = 120;
const titleClosedByDot = (text: string): string | undefined => {
  const dot = text.slice(0, MAX_TITLE_LENGTH).search(/\.(?:\s|$)/u);
  return dot <= 0 ? undefined : text.slice(0, dot);
};

/** 前の語が番号（「Section 8.07. Section 16 Matters」の 8.07.）なら、後ろはその見出しの題で、見出しではない。 */
const NUMBER_BEFORE = /\d[.:]?$/u;
const SENTENCE_END = /[.;:]$/u;
const isSpace = (char: string | undefined): boolean => char === " " || char === "\t";

/** 見出しが始まれる位置: 行の頭、文の終わり（. ; :）の後ろの空白、2 つ以上の空白の後ろ。前が番号なら始まらない。 */
const startsHeading = (source: string, at: number): boolean => {
  const before = source.slice(Math.max(source.lastIndexOf("\n", at - 1) + 1, at - MAX_TITLE_LENGTH), at);
  let spaces = 0;
  while (isSpace(before[before.length - 1 - spaces])) spaces += 1;
  if (spaces === before.length) return true;
  const word =
    before
      .slice(0, before.length - spaces)
      .split(/[ \t]/u)
      .at(-1) ?? "";
  if (NUMBER_BEFORE.test(word)) return false;
  return spaces >= 2 || (spaces >= 1 && SENTENCE_END.test(word));
};

/** 参照のすぐ後ろが題か（「Section 4.12. Compliance with Laws.」「Section 1.1      Closing. The Parties」）。 */
const NUMBER_CLOSE = /^\.?[ \t]+/u;
/** 番号と題のあいだの空白の長さの上限（データセットの契約は十数個の空白を置く）。 */
const MAX_NUMBER_CLOSE = 24;
const titledAfter = (source: string, end: number): boolean => {
  const rest = source.slice(end, end + MAX_TITLE_LENGTH + MAX_NUMBER_CLOSE);
  const close = NUMBER_CLOSE.exec(rest)?.[0];
  const title = close === undefined ? undefined : titleClosedByDot(rest.slice(close.length));
  return title !== undefined && isTitle(title);
};

/** 参照の形で書かれた見出し（「… Effect. Section 4.12. Compliance with Laws.」）。 */
const headingsAtReferences = (references: readonly ReferenceSpan[], source: string): WrittenHeading[] =>
  references
    .filter((reference) => startsHeading(source, reference.start) && titledAfter(source, reference.end))
    .map((reference) => ({ address: reference.target, start: reference.start }));

/** 行の頭の番号（「9. Indemnification.」「4 Intellectual Property. 4.1 Each」「6.1 eGain warrants」「2 Quality and Food Safety」）。 */
const LINE_NUMBER = /^[ \t]{0,3}(?<number>\d{1,3}(?:\.\d{1,3}){0,5})\.?[ \t]+(?<rest>\S.*)$/u;
/** 語のどこかに大文字があるか（「eGain」も名前）。 */
const HAS_CAPITAL = /\p{Lu}/u;

/**
 * 行の頭の番号が見出しか。題が点で閉じ、同じ行に本文が続けば見出し（「9. Indemnification. Each party …」）。題だけの行
 * （「1. Introduction」）は箇条書きと見分けられないので読まない。点を含む番号（6.1）は、最初の語に大文字があり、題より長い
 * 段落が続けば段落の番号（「6.1 eGain warrants …」）。本文の折り返しの「2.5 percent」は小文字、目次の「3.17 Reserves 33」は短いので当たらない。
 */
const isLineHeading = (number: string, rest: string): boolean => {
  const title = titleClosedByDot(rest);
  if (title !== undefined && rest.slice(title.length + 1).trim() !== "" && isTitle(title)) return true;
  const words = rest.split(/\s+/u);
  return number.includes(".") && words.length > MAX_TITLE_WORDS && HAS_CAPITAL.test(words[0] ?? "");
};

const headingsAtLineStarts = (source: string): WrittenHeading[] => {
  const found: WrittenHeading[] = [];
  let start = 0;
  source.split("\n").forEach((line) => {
    const groups = LINE_NUMBER.exec(line)?.groups;
    const number = groups?.["number"];
    if (number !== undefined && isLineHeading(number, groups?.["rest"] ?? "")) found.push({ address: number, start });
    start += line.length + 1;
  });
  return found;
};

/** 文書に平文で書かれた見出しを、文書の順に。Pure. */
export const writtenHeadings = (references: readonly ReferenceSpan[], source: string): WrittenHeading[] =>
  [...headingsAtReferences(references, source), ...headingsAtLineStarts(source)].toSorted((left, right) => left.start - right.start);

/** 括弧の小見出し（「(i)」「(b)」「(3)」）。参照の一部（「Section 2.02(b)」「(a)(i)」）は、前が文字・数字・括弧なので読まない。 */
const SUBDIVISION_LABEL = /(?<![\p{L}\p{N})\]])\((?<label>[a-zA-Z]{1,4}|\d{1,3})\)/gu;

/** 本文に書かれた括弧の小見出しの札。Pure. */
export const writtenSubdivisions = (body: string): ReadonlySet<string> =>
  new Set([...body.matchAll(SUBDIVISION_LABEL)].flatMap((match) => (match.groups?.["label"] === undefined ? [] : [match.groups["label"]])));

/** 参照の札（「Section 2.1(a)(i)」の a と i）。 */
const LABEL_IN_REFERENCE = /\((?<label>[a-zA-Z]{1,4}|\d{1,3})\)/gu;

/**
 * 参照の番地「2.1.a.i」を、親「2.1」と、参照が括弧で書いた札「a」「i」に分ける。札を括弧で書いていない参照（Section 2.1）や、
 * 番地の末尾が書いた札と合わなければ undefined。Pure.
 */
export const parentAndLabels = (target: string, written: string): { readonly parent: string; readonly labels: readonly string[] } | undefined => {
  const labels = [...written.matchAll(LABEL_IN_REFERENCE)].flatMap((match) => (match.groups?.["label"] === undefined ? [] : [match.groups["label"]]));
  const parts = target.split(".");
  const cut = parts.length - labels.length;
  if (labels.length === 0 || cut <= 0 || parts.slice(cut).join(".") !== labels.join(".")) return undefined;
  return { parent: parts.slice(0, cut).join("."), labels };
};

/** 書かれた見出しごとの範囲（次の書かれた見出しまで）。同じ番地が二度あれば、どちらの範囲もその番地のもの。Pure. */
export const headingRegions = (headings: readonly WrittenHeading[], length: number): ReadonlyMap<string, readonly (readonly [number, number])[]> => {
  const regions = new Map<string, (readonly [number, number])[]>();
  headings.forEach((heading, index) => {
    const end = headings[index + 1]?.start ?? length;
    const found = regions.get(heading.address) ?? [];
    found.push([heading.start, end]);
    regions.set(heading.address, found);
  });
  return regions;
};
