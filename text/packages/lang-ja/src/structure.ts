import type { Mention, NumberedLine, NumberingContext, StructurePatterns } from "chaffjs/plugin";
import { parseJapaneseNumber, toHalfWidth } from "./numbers.ts";
import { citedDocument } from "./citation.ts";
import { countedAfter, dates, quantities } from "./quantities.ts";

// 契約書・規程・法令の番号の書き方。core は番号の書き方を知らず、ここで読んだものを入れ子にする。

const NUMBER = "[0-9０-９〇一二三四五六七八九十百千]{1,6}";
const SPACE = "[ \\t\\u3000]";

/** 見出しとして読めるのは、番号の直後が空白・括弧・行末のとき。「第3条に定める」は本文。 */
const ARTICLE = new RegExp(`^${SPACE}*第(?<n>${NUMBER})条(?:の(?<sub>${NUMBER}))?(?<rest>(?:${SPACE}|（|\\().*|)$`, "u");
/** 「第四十三条から第五十五条まで 削除」「第五百十六条及び第五百十七条 削除」。削られた条を一行でまとめる法令の書き方。 */
const ARTICLE_RANGE = new RegExp(
  `^${SPACE}*第(?<n>${NUMBER})条(?:の(?<sub>${NUMBER}))?(?:から第(?<m>${NUMBER})条(?:の(?<msub>${NUMBER}))?まで|及び第(?<m2>${NUMBER})条(?:の(?<msub2>${NUMBER}))?)(?<rest>(?:${SPACE}|（|\\().*|)$`,
  "u",
);
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

/**
 * 条の範囲の行は、最初の条の番地を持ち、並びの位置は範囲の最後まで進める。中の条は番地を持たない。
 * 後ろ（「削除」）だけを読むので、範囲の両端を参照として拾わない。
 */
const articleRange = (line: string): NumberedLine | undefined => {
  const groups = ARTICLE_RANGE.exec(line)?.groups;
  const first = numberOf(groups?.["n"]);
  const last = numberOf(groups?.["m"] ?? groups?.["m2"]);
  if (groups === undefined || first === undefined || last === undefined) return undefined;
  const sub = numberOf(groups["sub"]);
  const branched = groups["sub"] !== undefined || (groups["msub"] ?? groups["msub2"]) !== undefined;
  const rest = (groups["rest"] ?? "").trim();
  const label = line
    .trim()
    .slice(0, line.trim().length - rest.length)
    .trim();
  return {
    kind: "article",
    depth: 1,
    number: sub === undefined ? first : `${first}-${sub}`,
    absolute: true,
    label,
    heading: headingOf(rest, true),
    rest,
    ordinal: branched ? undefined : Number(first),
    ordinalTo: branched ? undefined : Number(last),
  };
};

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

/** 項と号の深さ。法令の第 1 項は番号を持たないので、条の直下の号は第 1 項の号。 */
const PARAGRAPH_DEPTH = 2;
const ITEM_DEPTH = 3;

type ItemShape = {
  readonly pattern: RegExp;
  readonly depth: (context: NumberingContext) => number;
  readonly label: (n: string) => string;
  readonly needsArticle: boolean;
};

const ITEM_SHAPES: readonly ItemShape[] = [
  { pattern: PARAGRAPH, depth: () => PARAGRAPH_DEPTH, label: (n) => `第${n}項`, needsArticle: false },
  { pattern: ITEM, depth: () => ITEM_DEPTH, label: (n) => `第${n}号`, needsArticle: false },
  { pattern: BARE_PARAGRAPH, depth: () => PARAGRAPH_DEPTH, label: (n) => n, needsArticle: true },
  { pattern: BARE_FULLWIDTH_PARAGRAPH, depth: () => PARAGRAPH_DEPTH, label: (n) => n, needsArticle: true },
  { pattern: BARE_ITEM, depth: () => ITEM_DEPTH, label: (n) => n, needsArticle: true },
  { pattern: PAREN_ITEM, depth: parenDepth, label: (n) => `（${toHalfWidth(n)}）`, needsArticle: false },
];

/**
 * 号が条の直下に来たら、番号の無い第 1 項の中にある。番地を「条.1.号」にして、「第十二条第一項第一号」（12.1.1）と
 * 「第十二条第二項」（12.2）がぶつからないようにする。
 */
const inFirstParagraph = (context: NumberingContext, depth: number): boolean =>
  depth === ITEM_DEPTH && [...context.open].reverse().find((open) => open.depth < ITEM_DEPTH)?.kind === "article";

const item = (line: string, context: NumberingContext): NumberedLine | undefined =>
  ITEM_SHAPES.reduce<NumberedLine | undefined>((found, shape) => {
    if (found !== undefined || (shape.needsArticle && !insideArticle(context))) return found;
    const groups = shape.pattern.exec(line)?.groups;
    const number = numberOf(groups?.["n"]);
    if (groups === undefined || number === undefined) return undefined;
    const rest = (groups["rest"] ?? "").trim();
    const label = shape.label(groups["n"] ?? "");
    const depth = shape.depth(context);
    const address = inFirstParagraph(context, depth) ? `1.${number}` : number;
    return { kind: "item", depth, number: address, absolute: false, label, heading: headingOf(rest, false), rest, ordinal: Number(number) };
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

/**
 * 古い法令は第 2 項以降にも番号を振らず、全角空白で字下げした行を新しい項にする。条の行に本文が続く条の中で、号でもない字下げの行を、
 * 開いている項の次の項（無ければ第 2 項）として読む。番号付きの項（「２」）がある条では、字下げは使われない。
 */
const OLD_STYLE_PARAGRAPH = /^\u3000(?<rest>\S.*)$/u;

const unnumberedParagraph = (line: string, context: NumberingContext): NumberedLine | undefined => {
  if (!insideArticle(context)) return undefined;
  const rest = OLD_STYLE_PARAGRAPH.exec(line)?.groups?.["rest"];
  if (rest === undefined) return undefined;
  // 条の行に本文が続く書き方（「第三十四条 使用者は、…。」）のときだけ。契約書の「第1条（目的）」の次の字下げの行は、第 1 項の本文。
  // 条の行そのものを見る。前の行から付いた見出しは、条の行の書き方を変えない。
  const article = [...context.open].reverse().find((open) => open.kind === "article");
  if (article === undefined || headingOf(article.rest, true) !== "" || article.rest === "") return undefined;
  const previous = [...context.open].reverse().find((open) => open.depth === PARAGRAPH_DEPTH);
  if (previous !== undefined && previous.label !== "") return undefined;
  const number = String((previous === undefined ? 1 : Number(previous.number)) + 1);
  return { kind: "item", depth: PARAGRAPH_DEPTH, number, absolute: false, label: "", heading: "", rest: rest.trim(), ordinal: Number(number) };
};

const numbered = (line: string, context: NumberingContext): NumberedLine | undefined =>
  chapter(line) ?? articleRange(line) ?? article(line) ?? item(line, context) ?? unnumberedParagraph(line, context);

/** 正規表現の一致を Mention にする。g フラグ付きのものだけを渡す。 */
const mentions = (
  pattern: RegExp,
  text: string,
  attrs: (groups: Readonly<Record<string, string | undefined>>, whole: string, start: number) => Mention["attrs"] | undefined,
): Mention[] =>
  [...text.matchAll(pattern)].flatMap((match) => {
    const found = attrs(match.groups ?? {}, match[0], match.index);
    return found === undefined ? [] : [{ start: match.index, end: match.index + match[0].length, attrs: found }];
  });

const DEFINITIONS = [/以下「(?<term>[^「」\n]{1,40})」という/gu, /「(?<term>[^「」\n]{1,40})」とは/gu];

/**
 * 範囲を限った定義。「この条において『X』とは」「前項に規定する『X』とは」は、その条や項の中だけの定義で、
 * 別の条で同じ語を定義し直すのは誤りではない。scope: "local" を付け、重なりの rule に比べさせない。
 */
const THIS_PART = /この[条項号款目節章編](?:及び[^、。]{1,20})?において$/u;
const NEARBY_PART = /[前次同](?:各)?[項条号]に規定する$/u;
const scopedLocally = (before: string): boolean => THIS_PART.test(before) || NEARBY_PART.test(before);

const definitions = (text: string): Mention[] =>
  DEFINITIONS.flatMap((pattern) =>
    mentions(pattern, text, (groups, _whole, start) => {
      if (groups["term"] === undefined) return undefined;
      const local = scopedLocally(text.slice(Math.max(0, start - 30), start));
      return { term: groups["term"], ...(local ? { scope: "local" } : {}) };
    }),
  );

const REFERENCE = new RegExp(`第(?<a>${NUMBER})条(?:の(?<s>${NUMBER}))?(?:第(?<p>${NUMBER})項)?(?:第(?<i>${NUMBER})号)?`, "gu");

/**
 * 「第12条第1項」→ 12.1、「第3条の2」→ 3-2。番地の付け方は木と同じにする。
 * 法令は第 1 項に番号を振らないので、「第4条第1項」は番号付きの 4.1 が無ければ第4条そのものを指す。その行き先を fallback に入れる。
 * 「民法第709条」のように他の文書の名前が前にあれば、その名前を document に入れる。この文書の木では引かない。
 */
/**
 * 他の文書の参照に続く並び（「民事訴訟法第百条第一項、第百一条、第百二条の二」）は、同じ文書の条を指す。
 * 間が読点・接続の語・号や項の断片・括弧書きだけなら、前の参照の文書を引き継ぐ。
 */
const CONNECTORS = /及び|並びに|若しくは|又は|から|まで|ただし書|前段|後段|[、，\s]/gu;
const FRAGMENT = new RegExp(`第${NUMBER}[項号](?:の${NUMBER})*`, "gu");
const PARENTHESES = /（[^（）]*）/gu;

/** 間の文字列が、接続の語・読点・項や号の断片・括弧書きだけでできているか。 */
const isContinuation = (gap: string): boolean => gap.replace(PARENTHESES, "").replace(FRAGMENT, "").replace(CONNECTORS, "") === "";

const SUBSTITUTION = "とあるのは";
const SUBSTITUTED = "（読み替えの中）";

/** 行を一度だけ読んで、位置ごとの括弧の深さと、読み替えの「」の中かどうかを出す。参照ごとに行を読み直さない。 */
type LineMap = { readonly depth: Int32Array; readonly substituted: Uint8Array };

/**
 * 読み替え（「『X』とあるのは『Y』と読み替える」）の「」の中の番地は、読み替える先の法令のもの。
 * ほかの「」（定義した語、引用）はこの文書の言葉なので、その中の参照もこの文書の参照として扱う。
 */
const isSubstitution = (text: string, start: number, end: number): boolean =>
  text.startsWith(SUBSTITUTION, end + 1) || text.slice(Math.max(0, start - SUBSTITUTION.length), start) === SUBSTITUTION;

const lineMapOf = (text: string): LineMap => {
  const depth = new Int32Array(text.length + 1);
  const substituted = new Uint8Array(text.length + 1);
  const opens: number[] = [];
  const open = { parentheses: 0 };
  text.split("").forEach((char, at) => {
    depth[at] = open.parentheses;
    if (char === "「") opens.push(at);
    if (char === "」") {
      const start = opens.pop();
      if (start !== undefined && opens.length === 0 && isSubstitution(text, start, at)) substituted.fill(1, start, at + 1);
    }
    if (char === "（") open.parentheses += 1;
    if (char === "）") open.parentheses = Math.max(0, open.parentheses - 1);
  });
  return { depth, substituted };
};

/**
 * 「第12条第1項」→ 12.1、「第3条の2」→ 3-2。番地の付け方は木と同じにする。
 * 法令は第 1 項に番号を振らないので、「第4条第1項」は番号付きの 4.1 が無ければ第4条そのものを指す。その行き先を fallback に入れる。
 * 「民法第709条」のように他の文書の名前が前にあれば、その名前を document に入れる。この文書の木では引かない。
 */
/** at より前で開いたまま閉じていない括弧の数。 */
/** 間に挟まった括弧書き（中に参照があっても）を外す。入れ子は内側から外す。 */
const withoutClosedParentheses = (gap: string): string => {
  const once = gap.replace(PARENTHESES, "");
  return once === gap ? gap : withoutClosedParentheses(once);
};

/**
 * 「第12条第1項」→ 12.1、「第3条の2」→ 3-2。番地の付け方は木と同じにする。
 * 法令は第 1 項に番号を振らないので、「第4条第1項」は番号付きの 4.1 が無ければ第4条そのものを指す。その行き先を fallback に入れる。
 */
const addressOfReference = (
  groups: Readonly<Record<string, string | undefined>>,
): { readonly target: string; readonly fallback: string | undefined } | undefined => {
  const main = numberOf(groups["a"]);
  if (main === undefined) return undefined;
  const sub = numberOf(groups["s"]);
  const article = sub === undefined ? main : `${main}-${sub}`;
  const item = numberOf(groups["i"]);
  // 「第二条第一号」は第 1 項の号。項を書かずに号を指すのは、項が一つしかない条。
  const paragraph = numberOf(groups["p"]) ?? (item === undefined ? undefined : "1");
  const target = [article, paragraph, item].filter((part) => part !== undefined).join(".");
  return { target, fallback: paragraph === "1" && item === undefined ? article : undefined };
};

const references = (text: string): Mention[] => {
  const map = lineMapOf(text);
  // 括弧書きの中の参照（「（同法第五十九条において準用する場合を含む。）」）は、外の並びを切らない。並びは括弧の深さごとに持つ。
  const chains = new Map<number, { readonly end: number; readonly document: string | undefined }>();
  return [...text.matchAll(REFERENCE)].flatMap((match) => {
    const groups = match.groups ?? {};
    const address = addressOfReference(groups);
    if (address === undefined) return [];
    const { target, fallback } = address;
    const depth = map.depth[match.index] ?? 0;
    const previous = chains.get(depth);
    const inherited =
      previous?.document !== undefined && isContinuation(withoutClosedParentheses(text.slice(previous.end, match.index))) ? previous.document : undefined;
    const inQuote = map.substituted[match.index] === 1 ? SUBSTITUTED : undefined;
    const document = citedDocument(text, match.index) ?? inherited ?? inQuote;
    chains.set(depth, { end: match.index + match[0].length, document });
    const attrs = { target, label: match[0], ...(fallback === undefined ? {} : { fallback }), ...(document === undefined ? {} : { document }) };
    return [{ start: match.index, end: match.index + match[0].length, attrs }];
  });
};

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

/** 「二十二」「２」を数にする。相対の参照（前二項・前条第二項）を core が読むときに使う。 */
const number = (text: string): number | undefined => parseJapaneseNumber(toHalfWidth(text));

export const structure: StructurePatterns = { numbered, definitions, references, obligations, quantities, dates, countedAfter, number };
