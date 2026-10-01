import type { Mention, NumberedLine, NumberingContext, StructurePatterns } from "chaffjs/plugin";
import { parseJapaneseNumber, toHalfWidth } from "./numbers.ts";
import { citationVocabulary, citedDocument } from "./citation.ts";
import { loadLexicons } from "./lexicons.ts";
import { countedAfter, dates, quantities } from "./quantities.ts";
import { sectionReferences, sectionVocabulary } from "./section-reference.ts";
import { startsWithParticle } from "./particle-after.ts";

// 契約書・規程・法令の番号の書き方。core は番号の書き方を知らず、ここで読んだものを入れ子にする。

const NUMBER = "[0-9０-９〇一二三四五六七八九十百千]{1,6}";
const SPACE = "[ \\t\\u3000]";

/** 見出しとして読めるのは、番号の直後が空白・括弧・行末のとき。「第3条に定める」は本文。 */
const ARTICLE = new RegExp(`^${SPACE}*第(?<n>${NUMBER})条(?:の(?<sub>${NUMBER}))?(?<rest>(?:${SPACE}|（|\\().*|)$`, "u");
/**
 * 見出しの行では、題を詰めて書いた「第7条委託」「第2章概要」も読む。後ろが平仮名（「第3条に定める」「第2章では」）、
 * 次の番号（「第2章第1節」）、並べる語（「第4条及び第5条」「第2条若しくは第3条」「第2条乃至第5条」）なら、番号は題の札でないので読まない。
 */
const TIGHT_TITLE = "(?<rest>[^\\s\\p{Script=Hiragana}0-9０-９第及又並若乃].*)";
const ARTICLE_TIGHT = new RegExp(`^${SPACE}*第(?<n>${NUMBER})条(?:の(?<sub>${NUMBER}))?${TIGHT_TITLE}$`, "u");
/** 「第四十三条から第五十五条まで 削除」「第五百十六条及び第五百十七条 削除」。削られた条を一行でまとめる法令の書き方。 */
const ARTICLE_RANGE = new RegExp(
  `^${SPACE}*第(?<n>${NUMBER})条(?:の(?<sub>${NUMBER}))?(?:から第(?<m>${NUMBER})条(?:の(?<msub>${NUMBER}))?まで|及び第(?<m2>${NUMBER})条(?:の(?<msub2>${NUMBER}))?)(?<rest>(?:${SPACE}|（|\\().*|)$`,
  "u",
);
const PARAGRAPH = new RegExp(`^${SPACE}*第(?<n>${NUMBER})項(?<rest>(?:${SPACE}|（|\\().*|)$`, "u");
const ITEM = new RegExp(`^${SPACE}*第(?<n>${NUMBER})号(?<rest>(?:${SPACE}|（|\\().*|)$`, "u");
/**
 * 法令の項と号は、番号だけを行頭に置き、全角空白で本文と区切る（「２」「一」）。条の中でだけ読み、見出しの行（章の番号）では読まない。
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

const headingGroups = (pattern: RegExp, line: string, context: NumberingContext): Readonly<Record<string, string | undefined>> | undefined =>
  context.isHeading ? pattern.exec(line)?.groups : undefined;

const numberOf = (text: string | undefined): string | undefined => {
  const value = text === undefined ? undefined : parseJapaneseNumber(text);
  return value === undefined ? undefined : String(value);
};

const insideArticle = (context: NumberingContext): boolean => context.open.some((open) => open.kind === "article");

/** 条の行に本文があれば、番号の無い第 1 項がその行で始まっている。見出しだけの条（「第1条（目的）」「第1条 総則」）は違う。 */
const opensFirstParagraph = (open: NumberedLine | undefined): boolean => open?.kind === "article" && open.heading === "" && open.rest !== "";

/**
 * 「（2）」は開いている「（1）」の兄弟。無ければ、開いているものより一段深い。
 * ただし本文のある条の直下なら、番号の無い第 1 項の号。規則の「第3条 …次のとおりとする。」「(1) 学士」「2 …」の (1) は、第 2 項の兄弟ではない。
 */
const PAREN_LABEL = /^（\d+）$/u;
const parenDepth = (context: NumberingContext): number => {
  const sibling = context.open.findLast((open) => PAREN_LABEL.test(open.label));
  if (sibling !== undefined) return sibling.depth;
  const innermost = context.open.at(-1);
  return opensFirstParagraph(innermost) ? ITEM_DEPTH : (innermost?.depth ?? 0) + 1;
};

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

const article = (line: string, context: NumberingContext): NumberedLine | undefined => {
  const groups = ARTICLE.exec(line)?.groups ?? headingGroups(ARTICLE_TIGHT, line, context);
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
  depth === ITEM_DEPTH && context.open.findLast((open) => open.depth < ITEM_DEPTH)?.kind === "article";

const item = (line: string, context: NumberingContext): NumberedLine | undefined =>
  ITEM_SHAPES.reduce<NumberedLine | undefined>((found, shape) => {
    if (found !== undefined || (shape.needsArticle && (context.isHeading || !insideArticle(context)))) return found;
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
const CHAPTER_TIGHT = new RegExp(`^${SPACE}*第(?<n>${NUMBER})(?<unit>[編章節])${TIGHT_TITLE}$`, "u");
const CHAPTER_SHAPES: Readonly<Record<string, { readonly depth: number; readonly prefix: string }>> = {
  編: { depth: -2, prefix: "pt" },
  章: { depth: -1, prefix: "ch" },
  節: { depth: 0, prefix: "" },
};

const chapter = (line: string, context: NumberingContext): NumberedLine | undefined => {
  const groups = CHAPTER.exec(line)?.groups ?? headingGroups(CHAPTER_TIGHT, line, context);
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

const numbered = (line: string, context: NumberingContext): NumberedLine | undefined =>
  chapter(line, context) ?? articleRange(line) ?? article(line, context) ?? item(line, context);

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
/** 「規則第7条に規定する『X』とは」「法第31条第1項第1号の『X』とは」は、その番地で使う X の意味。番地の末尾だけを見る。 */
const ADDRESSED_PART = new RegExp(`第${NUMBER}[条項号](?:の${NUMBER})?(?:に規定する|の)$`, "u");
const scopedLocally = (before: string): boolean => THIS_PART.test(before) || NEARBY_PART.test(before) || ADDRESSED_PART.test(before);

const definitions = (text: string): Mention[] =>
  DEFINITIONS.flatMap((pattern) =>
    mentions(pattern, text, (groups, _whole, start) => {
      if (groups["term"] === undefined) return undefined;
      const local = scopedLocally(text.slice(Math.max(0, start - 30), start));
      return { term: groups["term"], ...(local ? { scope: "local" } : {}) };
    }),
  );

/** 条を数える語。見出しに「1 目的」と番号を振っただけの文書には、この語で数えた条が無い。 */
const ARTICLE_UNIT = "条";

const REFERENCE = new RegExp(`第(?<a>${NUMBER})条(?:の(?<s>${NUMBER}))?(?:第(?<p>${NUMBER})項)?(?:第(?<i>${NUMBER})号)?`, "gu");

/**
 * 「第12条第1項」→ 12.1、「第3条の2」→ 3-2。番地の付け方は木と同じにする。
 * 法令は第 1 項に番号を振らないので、「第4条第1項」は番号付きの 4.1 が無ければ第4条そのものを指す。その行き先を fallback に入れる。
 * 「民法第709条」のように他の文書の名前が前にあれば、その名前を document に入れる。この文書の木では引かない。
 */
/**
 * 他の文書の参照に続く並び（「民事訴訟法第百条第一項、第百一条、第百二条の二」）は、同じ文書の条を指す。
 * 間が読点・接続の語・号や項の断片・括弧書きだけなら、前の参照の文書を引き継ぐ。接続の語は、規約や案内が仮名で書く形（および）も同じ。
 */
const CONNECTORS = /及び|並びに|若しくは|又は|および|ならびに|もしくは|または|から|まで|ただし書|前段|後段|[、，\s]/gu;
const FRAGMENT = new RegExp(`第${NUMBER}[項号](?:の${NUMBER})*`, "gu");
/** 括弧書きの括弧。全角でも半角でもよい（厚生労働省法令等データベースは半角で書く）が、開きと閉じは同じ幅で組む。 */
const OPENER_OF: ReadonlyMap<string, string> = new Map([
  ["）", "（"],
  [")", "("],
]);
const isOpening = (char: string): boolean => char === "（" || char === "(";
const PARENTHESES = /（[^（）()]*）|\([^（）()]*\)/gu;

/** 閉じの括弧が、開いたままの最後の括弧と組になるか。 */
const closes = (char: string, opened: string | undefined): boolean => opened !== undefined && OPENER_OF.get(char) === opened;

/** 間の文字列が、接続の語・読点・項や号の断片・括弧書きだけでできているか。 */
const isContinuation = (gap: string): boolean => gap.replace(PARENTHESES, "").replace(FRAGMENT, "").replace(CONNECTORS, "") === "";

/** 行を一度だけ読んで、位置ごとの括弧の深さを出す。参照ごとに行を読み直さない。 */
const depthsOf = (text: string): Int32Array => {
  const depth = new Int32Array(text.length + 1);
  const opened: string[] = [];
  text.split("").forEach((char, at) => {
    depth[at] = opened.length;
    if (isOpening(char)) opened.push(char);
    else if (closes(char, opened.at(-1))) opened.pop();
  });
  return depth;
};

/**
 * 「第12条第1項」→ 12.1、「第3条の2」→ 3-2。番地の付け方は木と同じにする。
 * 法令は第 1 項に番号を振らないので、「第4条第1項」は番号付きの 4.1 が無ければ第4条そのものを指す。その行き先を fallback に入れる。
 * 「民法第709条」のように他の文書の名前が前にあれば、その名前を document に入れる。この文書の木では引かない。
 */
/** at より前で開いたまま閉じていない括弧の数。 */
/**
 * 間に挟まった括弧書き（中に参照があっても）を外す。入れ子は内側から外れる。閉じない「（」と開かない「）」は残す。
 * 内側を外すのを繰り返すと深さの数だけ読み直すので、組ごと 1 度で外す。
 */
const withoutClosedParentheses = (gap: string): string => {
  const kept: string[] = [];
  const opens: number[] = [];
  for (const char of gap) {
    const last = opens.at(-1);
    if (last !== undefined && closes(char, kept[last])) {
      opens.pop();
      kept.splice(last);
    } else {
      if (isOpening(char)) opens.push(kept.length);
      kept.push(char);
    }
  }
  return kept.join("");
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
  const articleNumber = sub === undefined ? main : `${main}-${sub}`;
  const itemNumber = numberOf(groups["i"]);
  // 「第二条第一号」は第 1 項の号。項を書かずに号を指すのは、項が一つしかない条。
  const paragraph = numberOf(groups["p"]) ?? (itemNumber === undefined ? undefined : "1");
  const target = [articleNumber, paragraph, itemNumber].filter((part) => part !== undefined).join(".");
  return { target, fallback: paragraph === "1" && itemNumber === undefined ? articleNumber : undefined };
};

/** 他の文書の名前を読む語と、章・節の番地でない言い方。語彙表から一度だけ作る。 */
const LEXICONS = loadLexicons();
const CITATION = citationVocabulary(LEXICONS);
const SECTIONS = sectionVocabulary(LEXICONS);
const NOT_MAGNITUDE = (LEXICONS["not-magnitude"] ?? []).map((entry) => entry.pattern);
const MEASURE_UNITS = (LEXICONS["measure-unit"] ?? []).map((entry) => entry.pattern);

/** 記号のすぐ後ろにラテン文字・数字・ハイフンが続けば、単位ではなく語の頭（「2.1 mmap」）。 */
const CONTINUES_WORD = /^[\p{Script=Latin}\p{Nd}_-]/u;

/** 「1.5 mM の塩化マグネシウム」「37.5 ℃で」: 解析器が助数詞と読まない単位の記号。 */
const startsWithMeasureUnit = (rest: string): boolean => MEASURE_UNITS.some((unit) => rest.startsWith(unit) && !CONTINUES_WORD.test(rest.slice(unit.length)));

/** 辞書が桁の語と助数詞に切る一語（「1.5 万葉の世界」）は数量の続きではないので、行頭の番号は節のまま。 */
const countedAfterNumber = (number: string, rest: string): boolean =>
  startsWithMeasureUnit(rest) || (!NOT_MAGNITUDE.some((word) => rest.startsWith(word)) && countedAfter(number, rest));

const sectionsOf = (text: string): Mention[] => sectionReferences(text, SECTIONS);

const articlesOf = (text: string): Mention[] =>
  [...text.matchAll(REFERENCE)].flatMap((match) => {
    const address = addressOfReference(match.groups ?? {});
    if (address === undefined) return [];
    const { target, fallback } = address;
    const attrs = { target, label: match[0], unitWord: ARTICLE_UNIT, ...(fallback === undefined ? {} : { fallback }) };
    return [{ start: match.index, end: match.index + match[0].length, attrs }];
  });

/** 条の参照と章・節の参照を文書の順に並べ、他の文書の名前を付ける。「民法第3章及び第4章」の第4章も民法の章。 */
const references = (text: string): Mention[] => {
  const depths = depthsOf(text);
  // 括弧書きの中の参照（「（同法第五十九条において準用する場合を含む。）」）は、外の並びを切らない。並びは括弧の深さごとに持つ。
  const chains = new Map<number, { readonly end: number; readonly document: string | undefined }>();
  return [...articlesOf(text), ...sectionsOf(text)]
    .toSorted((left, right) => left.start - right.start)
    .map((mention) => {
      const depth = depths[mention.start] ?? 0;
      const previous = chains.get(depth);
      const inherited =
        previous?.document !== undefined && isContinuation(withoutClosedParentheses(text.slice(previous.end, mention.start))) ? previous.document : undefined;
      const document = citedDocument(text, mention.start, CITATION) ?? inherited;
      chains.set(depth, { end: mention.end, document });
      return document === undefined ? mention : { ...mention, attrs: { ...mention.attrs, document } };
    });
};

/** 「3.2節」の 3.2 は節の番地で、節の数ではない。 */
const quantitiesOutsideSections = (text: string): Mention[] => {
  const sections = sectionsOf(text);
  return quantities(text).filter((quantity) => !sections.some((section) => quantity.start < section.end && section.start < quantity.end));
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
  return kept.toSorted((left, right) => left.start - right.start);
};

/** 「二十二」「２」を数にする。相対の参照（前二項・前条第二項）を core が読むときに使う。 */
const number = (text: string): number | undefined => parseJapaneseNumber(toHalfWidth(text));

export const structure: StructurePatterns = {
  numbered,
  definitions,
  references,
  obligations,
  quantities: quantitiesOutsideSections,
  dates,
  countedAfter: countedAfterNumber,
  continuesSentence: startsWithParticle,
  number,
};
