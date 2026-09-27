import type { Mention, NumberedLine, NumberingContext, StructurePatterns } from "chaffjs/plugin";

// 契約書・規程・法令の番号の書き方。core は番号の書き方を知らず、ここで読んだものを入れ子にする。

const DIGIT: Readonly<Record<string, number>> = { 〇: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
const PLACE: Readonly<Record<string, number>> = { 十: 10, 百: 100, 千: 1000 };

const FULLWIDTH_ZERO = 0xff10;
const toHalfWidth = (text: string): string => text.replace(/[０-９]/gu, (char) => String(char.charCodeAt(0) - FULLWIDTH_ZERO));

/**
 * 番号を数にする。全角数字は半角に、漢数字は位取りで読む（十二 = 12、二十一 = 21、百五 = 105、一〇 = 10）。
 * 読めないものは undefined。番号を読み違えると番地が変わり、参照先が無いという誤りを作ってしまう。
 */
export const parseJapaneseNumber = (text: string): number | undefined => {
  const half = toHalfWidth(text);
  if (/^\d+$/u.test(half)) return Number(half);
  if (!/^[〇一二三四五六七八九十百千]+$/u.test(text)) return undefined;
  const { total, current } = [...text].reduce(
    (acc, char) => {
      const place = PLACE[char];
      if (place !== undefined) return { total: acc.total + (acc.current === 0 ? 1 : acc.current) * place, current: 0 };
      return { total: acc.total, current: acc.current * 10 + (DIGIT[char] ?? 0) };
    },
    { total: 0, current: 0 },
  );
  return total + current;
};

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
  return bracketed ?? (whole ? trimmed : "");
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
  return { kind: "article", depth: 1, number: sub === undefined ? main : `${main}-${sub}`, absolute: true, label, heading: headingOf(rest, true), rest };
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
    return { kind: "item", depth: shape.depth(context), number, absolute: false, label: shape.label(groups["n"] ?? ""), heading: headingOf(rest, false), rest };
  }, undefined);

const numbered = (line: string, context: NumberingContext): NumberedLine | undefined => article(line) ?? item(line, context);

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

/** 「第12条第1項」→ 12.1、「第3条の2」→ 3-2。番地の付け方は木と同じにする。 */
const references = (text: string): Mention[] =>
  mentions(REFERENCE, text, (groups, whole) => {
    const main = numberOf(groups["a"]);
    if (main === undefined) return undefined;
    const sub = numberOf(groups["s"]);
    const rest = [numberOf(groups["p"]), numberOf(groups["i"])].filter((part) => part !== undefined);
    return { target: [sub === undefined ? main : `${main}-${sub}`, ...rest].join("."), label: whole };
  });

/** 長いものから探し、重なったら先に見つけたものを残す。「しなければならない」を「なければならない」と二重に数えない。 */
const MARKERS: readonly (readonly [string, "must" | "must-not" | "may"])[] = [
  ["しなければならない", "must"],
  ["なければならない", "must"],
  ["してはならない", "must-not"],
  ["てはならない", "must-not"],
  ["義務を負う", "must"],
  ["ものとする", "must"],
  ["禁止する", "must-not"],
  ["することができる", "may"],
  ["ことができる", "may"],
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

/**
 * 数量は「数字の並び」を探してから、直後が単位かを見る。数字と単位を 1 つの正規表現に詰めると、
 * 後戻りが爆発しうる形になる（sonarjs/super-linear-regex）。単位は長いものから当てる。
 */
const NUMBER_RUN = /[0-9０-９][0-9０-９.,]{0,15}|[〇一二三四五六七八九十百千]{1,8}/gu;
const UNITS = ["営業日", "パーセント", "か月", "ヶ月", "カ月", "箇月", "週間", "時間", "万円", "日", "年", "分", "円", "%", "％"];

const valueOf = (run: string): number | undefined => {
  const raw = toHalfWidth(run).replace(/,/gu, "");
  return /^\d+(?:\.\d+)?$/u.test(raw) ? Number(raw) : parseJapaneseNumber(run);
};

const quantities = (text: string): Mention[] =>
  [...text.matchAll(NUMBER_RUN)].flatMap((match) => {
    const after = match.index + match[0].length;
    const unit = UNITS.find((candidate) => text.startsWith(candidate, after));
    const value = valueOf(match[0]);
    return unit === undefined || value === undefined ? [] : [{ start: match.index, end: after + unit.length, attrs: { value, unit } }];
  });

export const structure: StructurePatterns = { numbered, definitions, references, obligations, quantities };
