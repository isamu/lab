import type { Mention, NumberedLine, NumberingContext, StructurePatterns } from "chaffjs/plugin";
import { parseJapaneseNumber, toHalfWidth } from "./numbers.ts";
import { citedDocument } from "./citation.ts";
import { countedAfter, dates, quantities } from "./quantities.ts";

// 契約書・規程・法令の番号の書き方。core は番号の書き方を知らず、ここで読んだものを入れ子にする。

const NUMBER = "[0-9０-９〇一二三四五六七八九十百千]{1,6}";
const SPACE = "[ \\t\\u3000]";

/** 見出しとして読めるのは、番号の直後が空白・括弧・行末のとき。「第3条に定める」は本文。 */
const ARTICLE = new RegExp(`^${SPACE}*第(?<n>${NUMBER})条(?:の(?<sub>${NUMBER}))?(?<rest>(?:${SPACE}|（|\\().*|)$`, "u");
const PARAGRAPH = new RegExp(`^${SPACE}*第(?<n>${NUMBER})項(?<rest>(?:${SPACE}|（|\\().*|)$`, "u");
const ITEM = new RegExp(`^${SPACE}*第(?<n>${NUMBER})号(?<rest>(?:${SPACE}|（|\\().*|)$`, "u");
/**
 * 法令の項と号は、番号だけを行頭に置き、全角空白で本文と区切る（「２」「一」）。条の中でだけ読む。
 * 半角数字や漢数字に半角空白が続くだけなら本文として扱う。「3 人で」「一 人で」を項や号にしない。
 */
const BARE_PARAGRAPH = new RegExp(`^${SPACE}*(?<n>[0-9]{1,3})\\u3000+(?<rest>\\S.*)$`, "u");
const BARE_FULLWIDTH_PARAGRAPH = new RegExp(`^${SPACE}*(?<n>[０-９]{1,3})${SPACE}+(?<rest>\\S.*)$`, "u");
const BARE_ITEM = new RegExp(`^${SPACE}*(?<n>[一二三四五六七八九十]{1,3})\\u3000+(?<rest>\\S.*)$`, "u");
const PAREN_ITEM = new RegExp(`^${SPACE}*[（(](?<n>[0-9０-９]{1,3})[）)]${SPACE}*(?<rest>\\S.*)$`, "u");

/** 「第3条（支払）」の括弧の中が見出し。括弧が無ければ、条は後ろ全部を、項・号は本文なので空を見出しにする。 */
const headingOf = (rest: string, whole: boolean): string => {
  const trimmed = rest.trim();
  const bracketed = /^[（(](?<title>[^）)]{1,40})[）)]\s*$/u.exec(trimmed)?.groups?.["title"];
  // 法令の「第三条 事業者は、…。」は見出しの無い条で、後ろは本文。文を見出しにしない。
  return bracketed ?? (whole && !trimmed.includes("。") ? trimmed : "");
};

const numberOf = (text: string | undefined): string | undefined => {
  const value = text === undefined ? undefined : parseJapaneseNumber(text);
  return value === undefined ? undefined : String(value);
};

const insideArticle = (context: NumberingContext): boolean => context.open.some((open) => open.kind === "article");

/** 「（2）」は開いている「（1）」の兄弟。無ければ、開いているものより一段深い。 */
const PAREN_LABEL = /^（\d+）$/u;
const parenDepth = (context: NumberingContext): number =>
  [...context.open].reverse().find((open) => PAREN_LABEL.test(open.label))?.depth ?? (context.open.at(-1)?.depth ?? 0) + 1;

const article = (line: string): NumberedLine | undefined => {
  const groups = ARTICLE.exec(line)?.groups;
  const main = numberOf(groups?.["n"]);
  if (groups === undefined || main === undefined) return undefined;
  const sub = numberOf(groups["sub"]);
  const branch = groups["sub"] === undefined ? "" : "の" + groups["sub"];
  const label = `第${groups["n"] ?? ""}条${branch}`;
  const rest = (groups["rest"] ?? "").trim();
  // 枝番号の条（第3条の2）は並びの外。第3条の次が第4条であることを乱さない。
  const ordinal = sub === undefined ? Number(main) : undefined;
  return {
    kind: "article",
    depth: 1,
    number: sub === undefined ? main : `${main}-${sub}`,
    absolute: true,
    label,
    heading: headingOf(rest, true),
    rest,
    ordinal,
  };
};

type ItemShape = {
  readonly pattern: RegExp;
  readonly depth: (context: NumberingContext) => number;
  readonly label: (n: string) => string;
  readonly needsArticle: boolean;
};

const ITEM_SHAPES: readonly ItemShape[] = [
  { pattern: PARAGRAPH, depth: () => 2, label: (n) => `第${n}項`, needsArticle: false },
  { pattern: ITEM, depth: () => 3, label: (n) => `第${n}号`, needsArticle: false },
  { pattern: BARE_PARAGRAPH, depth: () => 2, label: (n) => n, needsArticle: true },
  { pattern: BARE_FULLWIDTH_PARAGRAPH, depth: () => 2, label: (n) => n, needsArticle: true },
  { pattern: BARE_ITEM, depth: () => 3, label: (n) => n, needsArticle: true },
  { pattern: PAREN_ITEM, depth: parenDepth, label: (n) => `（${toHalfWidth(n)}）`, needsArticle: false },
];

const item = (line: string, context: NumberingContext): NumberedLine | undefined =>
  ITEM_SHAPES.reduce<NumberedLine | undefined>((found, shape) => {
    if (found !== undefined || (shape.needsArticle && !insideArticle(context))) return found;
    const groups = shape.pattern.exec(line)?.groups;
    const number = numberOf(groups?.["n"]);
    if (groups === undefined || number === undefined) return undefined;
    const rest = (groups["rest"] ?? "").trim();
    const label = shape.label(groups["n"] ?? "");
    return { kind: "item", depth: shape.depth(context), number, absolute: false, label, heading: headingOf(rest, false), rest, ordinal: Number(number) };
  }, undefined);

/**
 * 条より外のまとまり。法令は章の番号を編ごとに、節の番号を章ごとに振り直すので、
 * 章と節は親の番地に続ける（第2編第1章 → pt2.ch1、その第3節 → pt2.ch1.3）。条は通し番号のまま。
 */
const CHAPTER = new RegExp(`^${SPACE}*第(?<n>${NUMBER})(?<unit>[編章節])(?<rest>(?:${SPACE}|（|\\().*|)$`, "u");
const CHAPTER_SHAPES: Readonly<Record<string, { readonly depth: number; readonly prefix: string }>> = {
  編: { depth: -2, prefix: "pt" },
  章: { depth: -1, prefix: "ch" },
  節: { depth: 0, prefix: "" },
};

const chapter = (line: string): NumberedLine | undefined => {
  const groups = CHAPTER.exec(line)?.groups;
  const number = numberOf(groups?.["n"]);
  const shape = CHAPTER_SHAPES[groups?.["unit"] ?? ""];
  if (groups === undefined || number === undefined || shape === undefined) return undefined;
  const rest = (groups["rest"] ?? "").trim();
  const label = `第${groups["n"] ?? ""}${groups["unit"] ?? ""}`;
  return {
    kind: "chapter",
    depth: shape.depth,
    number: shape.prefix + number,
    absolute: false,
    label,
    heading: headingOf(rest, true),
    rest,
    ordinal: Number(number),
  };
};

const numbered = (line: string, context: NumberingContext): NumberedLine | undefined => chapter(line) ?? article(line) ?? item(line, context);

/** 正規表現の一致を Mention にする。g フラグ付きのものだけを渡す。 */
const mentions = (
  pattern: RegExp,
  text: string,
  attrs: (groups: Readonly<Record<string, string | undefined>>, whole: string) => Mention["attrs"] | undefined,
): Mention[] =>
  [...text.matchAll(pattern)].flatMap((match) => {
    const found = attrs(match.groups ?? {}, match[0]);
    return found === undefined ? [] : [{ start: match.index, end: match.index + match[0].length, attrs: found }];
  });

const DEFINITIONS = [/以下「(?<term>[^「」\n]{1,40})」という/gu, /「(?<term>[^「」\n]{1,40})」とは/gu];

const definitions = (text: string): Mention[] =>
  DEFINITIONS.flatMap((pattern) => mentions(pattern, text, (groups) => (groups["term"] === undefined ? undefined : { term: groups["term"] })));

const REFERENCE = new RegExp(`第(?<a>${NUMBER})条(?:の(?<s>${NUMBER}))?(?:第(?<p>${NUMBER})項)?(?:第(?<i>${NUMBER})号)?`, "gu");

/**
 * 「第12条第1項」→ 12.1、「第3条の2」→ 3-2。番地の付け方は木と同じにする。
 * 法令は第 1 項に番号を振らないので、「第4条第1項」は番号付きの 4.1 が無ければ第4条そのものを指す。その行き先を fallback に入れる。
 * 「民法第709条」のように他の文書の名前が前にあれば、その名前を document に入れる。この文書の木では引かない。
 */
const references = (text: string): Mention[] =>
  [...text.matchAll(REFERENCE)].flatMap((match) => {
    const groups = match.groups ?? {};
    const main = numberOf(groups["a"]);
    if (main === undefined) return [];
    const sub = numberOf(groups["s"]);
    const article = sub === undefined ? main : `${main}-${sub}`;
    const paragraph = numberOf(groups["p"]);
    const item = numberOf(groups["i"]);
    const target = [article, paragraph, item].filter((part) => part !== undefined).join(".");
    const fallback = paragraph === "1" ? [article, item].filter((part) => part !== undefined).join(".") : undefined;
    const document = citedDocument(text, match.index);
    const attrs = { target, label: match[0], ...(fallback === undefined ? {} : { fallback }), ...(document === undefined ? {} : { document }) };
    return [{ start: match.index, end: match.index + match[0].length, attrs }];
  });

/** 長いものから探し、重なったら先に見つけたものを残す。「しなければならない」を「なければならない」と二重に数えない。 */
const MARKERS: readonly (readonly [string, "must" | "must-not" | "may"])[] = [
  ["しなければならない", "must"],
  ["なければならない", "must"],
  ["してはならない", "must-not"],
  ["てはならない", "must-not"],
  ["なければなりません", "must"],
  ["てはなりません", "must-not"],
  ["てはいけません", "must-not"],
  ["てはいけない", "must-not"],
  ["義務を負う", "must"],
  ["ものとする", "must"],
  ["禁止する", "must-not"],
  ["することができる", "may"],
  ["ことができる", "may"],
  ["ことができます", "may"],
];

/** 語が現れる位置を全部。再帰や配列の広げ直しをしないので、長い文書でも線形で終わる。 */
const occurrences = (text: string, word: string): number[] => {
  const found: number[] = [];
  for (let at = text.indexOf(word); at !== -1; at = text.indexOf(word, at + word.length)) found.push(at);
  return found;
};

/**
 * 長い語から当て、すでに取った文字に重なるものは捨てる。重なりは文字ごとの印で見る。
 * 見つけたもの同士を総当たりで比べると、同じ語が何万もある文書で二乗に遅くなる。
 */
const obligations = (text: string): Mention[] => {
  const taken = new Uint8Array(text.length);
  const kept: Mention[] = [];
  MARKERS.forEach(([marker, type]) => {
    occurrences(text, marker).forEach((start) => {
      const end = start + marker.length;
      if (taken.subarray(start, end).some((mark) => mark === 1)) return;
      taken.fill(1, start, end);
      kept.push({ start, end, attrs: { marker, type } });
    });
  });
  return kept.sort((left, right) => left.start - right.start);
};

export const structure: StructurePatterns = { numbered, definitions, references, obligations, quantities, dates, countedAfter };
