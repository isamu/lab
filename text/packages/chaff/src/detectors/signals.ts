import { proseText } from "../measure.ts";
import { wordsOf } from "./structure.ts";
import type { Detector, Finding, ProseDocument, Sentence } from "../plugin.ts";

const PER = 1000;

/**
 * これより短い文書では密度が暴れる。1 個で「1000 あたり 100」になる。
 * 単位は言語で違うので、床も分ける。英語の 200 語と日本語の 200 文字では長さが桁で違う。
 */
const FLOOR = { word: 200, char: 500 };

const bodyOf = (doc: ProseDocument): string => doc.sentences.map(proseText).join(" ");

type Hit = { readonly sentence: Sentence; readonly offset: number };

const findIn = (doc: ProseDocument, pattern: RegExp): Hit[] =>
  doc.sentences.flatMap((sentence) => [...sentence.text.matchAll(pattern)].map((match) => ({ sentence, offset: sentence.span.start + (match.index ?? 0) })));

const density = (doc: ProseDocument, count: number): number => {
  const length = wordsOf(doc);
  return length === 0 ? 0 : Math.round((count / length) * PER);
};

/**
 * 絵文字と装飾記号。1 つなら親しみだが、並ぶと文字そのものが読めなくなる。
 * 件数ではなく密度で見る。長い文書ほど当たるのを避けるため（bold-density と同じ）。
 */
const EMOJI = /\p{Extended_Pictographic}|[←-⇿☀-➿]/gu;

export const emojiDensity: Detector = (doc, options): Finding[] => {
  const hits = findIn(doc, EMOJI);
  const first = hits[0];
  const rate = density(doc, hits.length);
  if (wordsOf(doc) < FLOOR[doc.lengthUnit] || first === undefined || rate <= options.limit) return [];
  return [
    {
      rule: "emoji-density",
      severity: "info",
      line: 0,
      column: 0,
      quote: first.sentence.text.trim(),
      values: { count: hits.length, density: rate, limit: options.limit, offset: first.offset },
    },
  ];
};

/**
 * 同じ言い回しの繰り返し。character n-gram で見るので、語の区切りが要らない。
 * spec §10 が n-gram を選んだのはこのためで、新しい言語でそのまま動く。
 */
/**
 * 窓の幅は単位で分ける。同じ 8 文字でも、日本語では 4〜5 形態素だが英語では 1 語半にしかならない。
 * 実文書（英語 11 本）で 8 文字にしたら、上位は " generat"（generate）のような**語の断片**だった。
 */
const GRAM = { char: 8, word: 20 };

const countGrams = (text: string, width: number): Map<string, number> => {
  const counts = new Map<string, number>();
  Array.from({ length: Math.max(0, text.length - width + 1) }).forEach((_, index) => {
    const gram = text.slice(index, index + width);
    counts.set(gram, (counts.get(gram) ?? 0) + 1);
  });
  return counts;
};

/**
 * 名前ではなく言い回しだけを数える。実文書で測ったら、上位は
 * 「AGENTS.m」「シンギュラリティ」のような固有名詞と識別子だった。名前は繰り返して当たり前。
 *
 * 言い回しは、その言語の「つなぎの материал」を含む。日本語ならひらがな、英語なら語の切れ目。
 * どちらを見るかは adapter が宣言する単位で決める。ひらがなを持たない char 単位の言語が
 * 来たら、この見分けは効かなくなる（そのときは adapter 側に判定を移す）。
 */
/**
 * つなぎが 1 つでは足りない。「detectorは」は用語に助詞が 1 つ付いただけで、
 * 繰り返して当たり前の**用語**であって言い回しではない。
 * 実文書で測ると、本物の言い回しはひらがなを 7 つ前後含み、用語＋助詞は 1〜2 だった。
 */
const CONNECTIVE = { char: /[ぁ-ゖ].*[ぁ-ゖ].*[ぁ-ゖ]/u, word: /\S \S.*\S \S/u };

const isPhrasing = (gram: string, unit: ProseDocument["lengthUnit"]): boolean => CONNECTIVE[unit].test(gram);

/** 文をまたいで数えない。文の終わりと次の文の始まりが繋がると、固有名詞が言い回しに見える。 */
const gramsOf = (doc: ProseDocument): Map<string, number> => {
  const counts = new Map<string, number>();
  doc.sentences.forEach((sentence) => {
    const text = doc.lengthUnit === "char" ? proseText(sentence).replace(/\s+/gu, "") : proseText(sentence);
    countGrams(text, GRAM[doc.lengthUnit]).forEach((count, gram) => counts.set(gram, (counts.get(gram) ?? 0) + count));
  });
  return counts;
};

export const ngramRepetition: Detector = (doc, options): Finding[] => {
  if (wordsOf(doc) < FLOOR[doc.lengthUnit]) return [];
  const worst = [...gramsOf(doc).entries()]
    .filter(([gram]) => isPhrasing(gram, doc.lengthUnit))
    .reduce<{ gram: string; count: number }>((best, [gram, count]) => (count > best.count ? { gram, count } : best), { gram: "", count: 0 });
  if (worst.count <= options.limit) return [];
  const at = doc.sentences.find((sentence) => sentence.text.includes(worst.gram));
  return [
    {
      rule: "ngram-repetition",
      severity: "info",
      line: 0,
      column: 0,
      quote: at?.text.trim() ?? worst.gram,
      values: { word: worst.gram, count: worst.count, limit: options.limit, offset: at?.span.start ?? 0 },
    },
  ];
};

/**
 * 略語が初出で展開されているか。「CI」だけでは、読む人によって指すものが違う。
 * 展開は「略語の直前か直後の括弧」か「括弧の中の略語」で書かれる。
 */
const ACRONYM = /\b[A-Z]{2,6}\b/gu;

/** 読み手が説明なしで通じると見なしてよい語。展開すると逆に読みにくい。 */
const COMMON = new Set([
  "OK",
  "NG",
  "URL",
  "API",
  "CSS",
  "HTML",
  "JSON",
  "YAML",
  "HTTP",
  "HTTPS",
  "PDF",
  "CPU",
  "GPU",
  "RAM",
  "USB",
  "AI",
  "ID",
  "FAQ",
  "PR",
  "OS",
  "CLI",
  "UI",
  "UX",
  "SQL",
  "CSV",
  "XML",
  "TODO",
  "NOTE",
]);

/**
 * 展開は略語の**すぐ隣**にあるときだけ認める。
 * 60 文字も見ると、同じ文のどこかに括弧があるだけで「説明済み」になり、1 件も出なくなる。
 *
 * 認めるのは 2 つの形。どちらも実際によく書かれる。
 *   CI（継続的インテグレーション）   略語のあとに括弧
 *   Continuous Integration (CI)      括弧の中が略語
 */
const OPENS = /^\s*[(（]/u;
const CLOSES = /^\s*[)）]/u;
const OPENED = /[(（]\s*$/u;

const isExpanded = (body: string, acronym: string): boolean => {
  const at = body.indexOf(acronym);
  if (at === -1) return false;
  const after = body.slice(at + acronym.length, at + acronym.length + 3);
  const before = body.slice(Math.max(0, at - 3), at);
  return OPENS.test(after) || (OPENED.test(before) && CLOSES.test(after));
};

export const undefinedAcronym: Detector = (doc, options): Finding[] => {
  const body = bodyOf(doc);
  const seen = new Map<string, Hit>();
  findIn(doc, ACRONYM).forEach((hit) => {
    const text = /^[A-Z]{2,6}/u.exec(doc.source.slice(hit.offset, hit.offset + 6))?.[0] ?? "";
    if (text.length > 0 && !COMMON.has(text) && !seen.has(text)) seen.set(text, hit);
  });
  const bare = [...seen.entries()].filter(([acronym]) => !isExpanded(body, acronym));
  if (bare.length < options.limit) return [];
  return bare.map(([acronym, hit]) => ({
    rule: "undefined-acronym",
    severity: "info",
    line: 0,
    column: 0,
    quote: hit.sentence.text.trim(),
    values: { word: acronym, count: bare.length, limit: options.limit, offset: hit.offset },
  }));
};

/**
 * 具体物の密度。数値・コード・リンク・引用が 1 つも無い節は、
 * 読み終えても何も持ち帰れない。**少ないほうを指摘する**ので、他の密度 rule と向きが逆。
 */
const CONCRETE = /\d|`|https?:\/\//u;

export const concreteEvidence: Detector = (doc, options): Finding[] => {
  const sections = doc.sections.filter((section) => section.sentences.length >= 3);
  const empty = sections.filter((section) => !CONCRETE.test(doc.source.slice(section.span.start, section.span.end)));
  if (empty.length < options.limit) return [];
  return empty.map((section) => ({
    rule: "concrete-evidence-density",
    severity: "info",
    line: 0,
    column: 0,
    quote: section.heading.length > 0 ? section.heading : (section.sentences[0]?.text.trim() ?? ""),
    values: {
      word: section.heading.length > 0 ? section.heading : "この節",
      count: empty.length,
      total: sections.length,
      limit: options.limit,
      offset: section.span.start,
    },
  }));
};

/**
 * ダッシュの多用。英語では正当な用法が多いが、2026 年時点で最も知られた生成文のシグナルでもある。
 * 日本語の組版ではそもそも扱いが難しい。どちらが正しいかは severity の言語別指定で分ける。spec §12.4。
 */
const DASH = /[\u2014\u2015\u2013]/gu;

export const dashDensity: Detector = (doc, options): Finding[] => {
  const hits = findIn(doc, DASH);
  const first = hits[0];
  const rate = density(doc, hits.length);
  if (wordsOf(doc) < FLOOR[doc.lengthUnit] || first === undefined || rate <= options.limit) return [];
  return [
    {
      rule: "no-em-dash",
      severity: "info",
      line: 0,
      column: 0,
      quote: first.sentence.text.trim(),
      values: { count: hits.length, density: rate, limit: options.limit, offset: first.offset },
    },
  ];
};
