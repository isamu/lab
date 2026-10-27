import { wordsOf } from "./structure.ts";
import { MIN_DOCUMENT_LENGTH } from "./signals.ts";
import { compacted, linkedIn, placeAt } from "./gram-place.ts";
import { charWindows, wordWindows } from "./gram-windows.ts";
import { fieldLabelSpans, fixedEndingSpans, furnitureMask, isFurniture, partReferenceSpans, quotedClosingSpans, quotedSpans } from "./gram-furniture.ts";
import { hasPredicateIn } from "./gram-predicate.ts";
import { gramPassagesOf } from "./gram-passages.ts";
import { entryOpeners, nounFragments, rowEndCells, sectionOpeners } from "./gram-openers.ts";
import { nameSpans, touchesAny } from "../team-names.ts";
import type { Detector, Finding, LengthUnit, ProseDocument, Sentence, Span, StructureNode } from "../plugin.ts";

/**
 * 同じ言い回しの繰り返し。文字の並びで見るので、adapter の語の区切り（wordSplit）が要らない。英語の窓は空白で語の切れ目にそろえる。
 * spec §10 が n-gram を選んだのはこのためで、新しい言語でそのまま動く。
 */
/**
 * 窓の幅は単位で分ける。同じ 8 文字でも、日本語では 4〜5 形態素だが英語では 1 語半にしかならない。
 * 英語の窓は語の切れ目にそろえ、18 文字に届くまで語を足す。文字で切ると " generat" のような語の断片が上位に来る。
 * 18 は、文字で切っていた頃の 20 文字の窓から前後の空白を除いた長さ（" juxtaposed to said "）。
 */
const GRAM = { char: 8, word: 18 };

const windowsOf = (text: string, unit: LengthUnit): Span[] => (unit === "char" ? charWindows(text, GRAM.char) : wordWindows(text, GRAM.word));

/**
 * 名前ではなく言い回しだけを数える。実文書で測ったら、上位は
 * 「AGENTS.m」「シンギュラリティ」のような固有名詞と識別子だった。名前は繰り返して当たり前。
 *
 * 言い回しは、その言語の「つなぎの材料」を含む。日本語ならひらがな、英語なら語の切れ目。
 * どちらを見るかは adapter が宣言する単位で決める。ひらがなを持たない char 単位の言語が
 * 来たら、この見分けは効かなくなる（そのときは adapter 側に判定を移す）。
 */
/**
 * つなぎが 1 つでは足りない。「detectorは」は用語に助詞が 1 つ付いただけで、
 * 繰り返して当たり前の**用語**であって言い回しではない。
 * 実文書で測ると、本物の言い回しはひらがなを 7 つ前後含み、用語＋助詞は 1〜2 だった。
 */
const CONNECTIVE = { char: /[ぁ-ゖ].*[ぁ-ゖ].*[ぁ-ゖ]/u, word: /\S \S.*\S \S/u };

const isPhrasing = (gram: string, unit: LengthUnit): boolean => CONNECTIVE[unit].test(gram);

/** 英語は大文字と小文字を区別せずに数える。文頭の "Proposals submitted via" も文中の "proposals submitted via" も同じ言い回し。 */
const keyOf = (gram: string, unit: LengthUnit): string => (unit === "word" ? gram.toLowerCase() : gram);

/** 文書が定義した語（以下「X」という、「X」とは）。定義した語は言い換えられない名前で、繰り返して当たり前。 */
const definedTerms = (node: StructureNode | undefined): string[] => {
  if (node === undefined) return [];
  const term = node.kind === "definition" ? node.attrs["term"] : undefined;
  return [...(typeof term === "string" ? [term] : []), ...node.children.flatMap(definedTerms)];
};

const namesOf = (doc: ProseDocument): readonly string[] => {
  const names = [...(doc.names ?? []), ...definedTerms(doc.structure)];
  return doc.lengthUnit === "char" ? names.map((name) => name.replace(/\s+/gu, "")) : names;
};

/** 語彙表 ngram-fixed-ending: 項目ごとに同じ形で結ぶ書式の結び（〜ものとすること。）。 */
const fixedEndingsOf = (doc: ProseDocument): string[] => (doc.lexicons["ngram-fixed-ending"] ?? []).map((entry) => entry.pattern);

/** 語句の出現。書かれたままの語句と、文と、文の中の範囲（sentence.text の位置）。 */
type Occurrence = { readonly gram: string; readonly sentence: Sentence; readonly place: Span | undefined };

type Tally = Map<string, Occurrence[]>;

type Context = { readonly doc: ProseDocument; readonly names: readonly string[]; readonly endings: readonly string[] };

/** 数えない範囲: 名前（触れる窓を外す）と、飾り（過半を覆う窓を外す）。 */
const excludedIn = (context: Context, sentence: Sentence, text: string, source: ReturnType<typeof compacted>): { named: Span[]; mask: boolean[] } => {
  const unit = context.doc.lengthUnit;
  const named = [...nameSpans(text, context.names), ...fieldLabelSpans(text, unit), ...partReferenceSpans(text, unit)];
  const mask = furnitureMask(text, linkedIn(context.doc, sentence, source));
  [...fixedEndingSpans(text, context.endings), ...quotedSpans(text), ...quotedClosingSpans(text)].forEach((span) => mask.fill(true, span.start, span.end));
  return { named, mask };
};

/**
 * 文をまたいで数えない。文の終わりと次の文の始まりが繋がると、固有名詞が言い回しに見える。
 * 一つの文の中の繰り返しは 1 回と数える。一つの文で項目を並べる（平成25年度に指定が解除された…、平成26年度に指定が解除された…）のは並べ方で、言い直しではない。
 * 並べた名前にかかる語句も数えない。名前が繰り返されれば、その前後（「the …」）も一緒に繰り返されるのは当たり前。
 * 一覧の飾り（gram-furniture.ts）も数えない。項目ごとに繰り返すのはひな形で、書き手ではない。
 */
const tallySentence = (context: Context, sentence: Sentence, tally: Tally): void => {
  const unit = context.doc.lengthUnit;
  const source = compacted(sentence.text, unit);
  const { named, mask } = excludedIn(context, sentence, source.text, source);
  const seen = new Set<string>();
  windowsOf(source.text, unit)
    .filter((window) => !touchesAny(named, window.start, window.end) && !isFurniture(source.text, mask, window))
    .forEach((window) => {
      const gram = source.text.slice(window.start, window.end);
      const key = keyOf(gram, unit);
      if (seen.has(key)) return;
      seen.add(key);
      const occurrence = { gram, sentence, place: placeAt(source, window) };
      const list = tally.get(key);
      if (list === undefined) tally.set(key, [occurrence]);
      else list.push(occurrence);
    });
};

const gramsOf = (context: Context, sentences: readonly Sentence[]): Tally => {
  const tally: Tally = new Map();
  sentences.forEach((sentence) => tallySentence(context, sentence, tally));
  return tally;
};

/**
 * ひな形の文: 参照の項目の説明の段落（`max-age` の節、定義の並びの「: 」）と、句点の無い名詞で終わる一行（表の欄、項目の名前）と、その欄が
 * 2 つ続いた後ろの一行の文（表の行の最後の欄）。
 * ここに出るのは書式の繰り返しで、ここに出たぶんは数えない。
 */
const templatesOf = (doc: ProseDocument): ReadonlySet<Sentence> => {
  const fragments = new Set(nounFragments(doc.sentences, doc.source));
  return new Set([...entryOpeners(doc.sections, doc.source), ...fragments, ...rowEndCells(doc.sentences, fragments, doc.source)]);
};

/** 文書の題（一番上の見出し）。題にある言い回しは文書の主題で、繰り返して当たり前（CCライセンスを付与する際の…）。 */
const titleOf = (doc: ProseDocument): string =>
  keyOf(
    doc.sections
      .filter((section) => section.depth === 1)
      .map((section) => compacted(section.heading, doc.lengthUnit).text)
      .join("\n"),
    doc.lengthUnit,
  );

type Repeat = { readonly key: string; readonly occurrences: readonly Occurrence[] };

/**
 * 範囲（gram-passages.ts）ごとに数える。よくある質問の別々の答えは別の範囲。節の最初の文（gram-openers.ts）にだけ出るものは節のひな形。
 * 節の書き出しは書き手の地の文でもあるので、ほかの所にも出れば書き出しのぶんも数える（節ごとの口癖）。
 */
const repeatsOf = (doc: ProseDocument, limit: number): Repeat[] => {
  const context = { doc, names: namesOf(doc), endings: fixedEndingsOf(doc) };
  const templates = templatesOf(doc);
  const openers = sectionOpeners(doc.sections, doc.source);
  const title = titleOf(doc);
  return gramPassagesOf(doc.sections).flatMap((sentences) =>
    [...gramsOf(context, sentences).entries()].flatMap(([key, all]) => {
      const occurrences = all.filter((occurrence) => !templates.has(occurrence.sentence));
      const opensEverySection = occurrences.every((occurrence) => openers.has(occurrence.sentence));
      return occurrences.length > limit && isPhrasing(key, doc.lengthUnit) && !title.includes(key) && !opensEverySection ? [{ key, occurrences }] : [];
    }),
  );
};

const predicateAt = (occurrence: Occurrence, unit: LengthUnit): boolean | undefined => {
  const { sentence, place } = occurrence;
  if (sentence.tokens === undefined || place === undefined) return undefined;
  const start = sentence.span.start;
  return hasPredicateIn(sentence.tokens, { start: start + place.start, end: start + place.end }, unit);
};

/**
 * 語句が文の中で占める範囲に、述語になる動詞か助動詞があるか（gram-predicate.ts）。出現ごとに見て、半分以上にあれば言い回し。
 * 解析器は同じ語を所によって読み違える（adverse health effects they believe の effects を動詞と読む）。一つの出現では決めない。
 * 品詞が無ければ見分けられないので、これまでどおり言い回しとして数える。
 */
const hasPredicate = (occurrences: readonly Occurrence[], unit: LengthUnit): boolean => {
  const judged = occurrences.map((occurrence) => predicateAt(occurrence, unit)).filter((found) => found !== undefined);
  return judged.length === 0 || judged.filter(Boolean).length * 2 >= judged.length;
};

export const ngramRepetition: Detector = (doc, options): Finding[] => {
  if (wordsOf(doc) < MIN_DOCUMENT_LENGTH[doc.lengthUnit]) return [];
  const worst = repeatsOf(doc, options.limit)
    .toSorted((left, right) => right.occurrences.length - left.occurrences.length)
    .find(({ occurrences }) => hasPredicate(occurrences, doc.lengthUnit));
  if (worst === undefined) return [];
  const first = worst.occurrences.find((occurrence) => occurrence.place !== undefined) ?? worst.occurrences[0];
  const at = first?.sentence;
  return [
    {
      rule: "ngram-repetition",
      severity: "info",
      line: 0,
      column: 0,
      quote: at?.text.trim() ?? worst.key,
      values: { word: first?.gram ?? worst.key, count: worst.occurrences.length, limit: options.limit, offset: at?.span.start ?? 0 },
    },
  ];
};
