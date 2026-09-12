import { lengthOf } from "../measure.ts";
import { isClosed } from "../sentence-shape.ts";
import type { Detector, Finding, ProseDocument, Section, Sentence, Token } from "../plugin.ts";

const PER = 1000;

/** これより短い文書では密度が暴れる。1 語で「1000 語あたり 100」になる。 */
const MIN_WORDS = 200;

const wordsIn = (doc: ProseDocument): number => doc.sentences.reduce((sum, sentence) => sum + lengthOf(sentence, "word"), 0);

const isLyAdverb = (token: Token): boolean => token.pos === "ADV" && token.surface.toLowerCase().endsWith("ly");

/**
 * -ly 副詞は、動詞が弱いことの目印になる。「walked quickly」より「hurried」。
 * 1 つずつは正しいので、件数ではなく密度で見る（bold-density と同じ）。
 */
export const adverbDensity: Detector = (doc, options): Finding[] => {
  const words = wordsIn(doc);
  const hits = doc.sentences.flatMap((sentence) => (sentence.tokens ?? []).filter(isLyAdverb).map((token) => ({ sentence, token })));
  const density = words === 0 ? 0 : Math.round((hits.length / words) * PER);
  const first = hits[0];
  if (words < MIN_WORDS || first === undefined || density <= options.limit) return [];
  return [
    {
      rule: "adverb-overuse",
      severity: "info",
      line: 0,
      column: 0,
      quote: first.sentence.text.trim(),
      values: { count: hits.length, density, words, limit: options.limit, offset: first.token.span.start },
    },
  ];
};

const BE = new Set(["be", "is", "are", "was", "were"]);

/**
 * There is / It is ... that は、主語を後ろへ押しやって誰が何をするのかを消す。
 * 「There is a need to review」は、誰が必要としているのかを言っていない。
 */
const expletiveAt = (tokens: readonly Token[]): Token | undefined => {
  const head = tokens.find((token) => token.pos !== "PUNCT");
  if (head === undefined) return undefined;
  const lead = head.surface.toLowerCase();
  if (lead !== "there" && lead !== "it") return undefined;
  const next = tokens.find((token) => token.span.start >= head.span.end && token.pos !== "PUNCT");
  if (next === undefined || !BE.has(next.lemma ?? next.surface.toLowerCase())) return undefined;
  // "it is" は "it is raining" のような正当な用法があるので、that 節を伴うときだけ数える。
  if (lead === "it" && !tokens.some((token) => token.surface.toLowerCase() === "that")) return undefined;
  return head;
};

export const expletive: Detector = (doc, options): Finding[] => {
  const hits = doc.sentences.flatMap((sentence) => {
    const at = expletiveAt(sentence.tokens ?? []);
    return at === undefined ? [] : [{ sentence, at }];
  });
  if (hits.length <= options.limit) return [];
  return hits.map(({ sentence, at }) => ({
    rule: "expletive-construction",
    severity: "info",
    line: 0,
    column: 0,
    quote: sentence.text.trim(),
    values: { word: at.surface, count: hits.length, limit: options.limit, offset: at.span.start },
  }));
};

const firstWord = (sentence: Sentence): string =>
  sentence.text
    .trim()
    .split(/\s+/u)[0]
    ?.replace(/[^A-Za-z]/gu, "") ?? "";

/**
 * 接続詞で始まる文が続く。1 つなら効くが、続くと文が前の文の付け足しに見えて、
 * 何が主張なのかが分からなくなる。
 */
export const conjunctionRun: Detector = (doc, options): Finding[] => {
  const heads = (options.lexicon ?? []).map((entry) => entry.pattern.toLowerCase());
  const runs = doc.sentences.filter(isClosed).reduce<Sentence[][]>(
    (acc, sentence) => {
      const last = acc.at(-1) ?? [];
      if (!heads.includes(firstWord(sentence).toLowerCase())) return [...acc.slice(0, -1), last, []];
      return [...acc.slice(0, -1), [...last, sentence]];
    },
    [[]],
  );
  return runs
    .filter((run) => run.length > options.limit)
    .flatMap((run) => {
      const first = run[0];
      return first === undefined
        ? []
        : [
            {
              rule: "sentence-initial-conjunction-run",
              severity: "info" as const,
              line: 0,
              column: 0,
              quote: run.map((sentence) => sentence.text.trim()).join(" "),
              values: { count: run.length, limit: options.limit, offset: first.span.start },
            },
          ];
    });
};

const WORD = /[A-Za-z][A-Za-z'-]*/gu;

/** 小さい語は Title Case でも小文字のままなので、大文字化の判定から外す。 */
const MINOR = new Set(["a", "an", "the", "and", "or", "but", "of", "in", "on", "at", "to", "for", "with", "as", "by", "from", "is"]);

const isTitleCase = (heading: string): boolean | undefined => {
  const words = [...heading.matchAll(WORD)].map((match) => match[0]).filter((word) => !MINOR.has(word.toLowerCase()));
  // 1 語の見出しは、どちらの流儀でも先頭が大文字になる。判定できない。
  if (words.length < 2) return undefined;
  const capitalized = words.filter((word) => word[0] === word[0]?.toUpperCase()).length;
  return capitalized === words.length;
};

const headingsOf = (sections: readonly Section[]): { readonly section: Section; readonly title: boolean }[] =>
  sections.flatMap((section) => {
    const title = isTitleCase(section.heading);
    return title === undefined ? [] : [{ section, title }];
  });

/**
 * 見出しの大文字化が混ざっている。どちらの流儀が正しいかは決めない。spec §12.3。
 * 見るのは文書の中で揃っているかだけで、少数派のほうを指摘する。
 */
export const titleCaseMix: Detector = (doc, options): Finding[] => {
  const judged = headingsOf(doc.sections);
  const title = judged.filter((entry) => entry.title).length;
  const minorityIsTitle = title <= judged.length - title;
  const few = minorityIsTitle ? title : judged.length - title;
  // 同数なら少数派は無い。どちらかを「他と違う」と呼ぶのは、選びかたが恣意的になる。
  if (few === 0 || few * 2 === judged.length || few > options.limit) return [];
  return judged
    .filter((entry) => entry.title === minorityIsTitle)
    .map(({ section }) => ({
      rule: "title-case-consistency",
      severity: "info",
      line: 0,
      column: 0,
      quote: section.heading,
      values: { count: few, limit: options.limit, offset: section.span.start },
    }));
};

const LIST_CONJUNCTION = new Set(["and", "or"]);

/**
 * 3 つ以上の並列の最後の and / or の前に読点を打つか。Oxford comma。
 *
 * どちらが正しいかは決めない。スタイルガイドで割れる論点に立場を取ると rule ごと無視される。
 * 見るのは 1 つの文書で揃っているかだけ。spec §12.3。
 */
const oxfordIn = (tokens: readonly Token[]): boolean | undefined => {
  const at = tokens.findIndex((token) => LIST_CONJUNCTION.has(token.surface.toLowerCase()));
  if (at < 1) return undefined;
  const before = tokens.slice(0, at);
  // 並列が 3 つ以上あるときだけ判定できる。読点が 1 つも無ければ 2 つの並列。
  const commas = before.filter((token) => token.surface === ",").length;
  if (commas === 0) return undefined;
  return before.at(-1)?.surface === ",";
};

export const oxfordComma: Detector = (doc, options): Finding[] => {
  const judged = doc.sentences.flatMap((sentence) => {
    const oxford = oxfordIn(sentence.tokens ?? []);
    return oxford === undefined ? [] : [{ sentence, oxford }];
  });
  const withComma = judged.filter((entry) => entry.oxford).length;
  const minorityUsesComma = withComma <= judged.length - withComma;
  const few = minorityUsesComma ? withComma : judged.length - withComma;
  // 同数なら少数派は無い。
  if (few === 0 || few * 2 === judged.length || few > options.limit) return [];
  return judged
    .filter((entry) => entry.oxford === minorityUsesComma)
    .map(({ sentence }) => ({
      rule: "oxford-comma-consistency",
      severity: "info",
      line: 0,
      column: 0,
      quote: sentence.text.trim(),
      values: { count: few, limit: options.limit, offset: sentence.span.start },
    }));
};
