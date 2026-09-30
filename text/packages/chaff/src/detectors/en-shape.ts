import { lengthOf } from "../measure.ts";
import { isClosed } from "../sentence-shape.ts";
import { isTitleCase, minorityCase, pageTitleOf } from "./heading-case.ts";
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
  const heads = new Set((options.lexicon ?? []).map((entry) => entry.pattern.toLowerCase()));
  const runs = doc.sentences.filter(isClosed).reduce<Sentence[][]>(
    (acc, sentence) => {
      const last = acc.at(-1) ?? [];
      if (!heads.has(firstWord(sentence).toLowerCase())) return [...acc.slice(0, -1), last, []];
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

const headingsOf = (sections: readonly Section[]): { readonly section: Section; readonly title: boolean }[] =>
  sections.flatMap((section) => {
    const title = isTitleCase(section.heading);
    return title === undefined ? [] : [{ section, title }];
  });

/**
 * 見出しの大文字化が混ざっている。どちらの流儀が正しいかは決めない。spec §12.3。
 * 見るのは文書の中で揃っているかだけで、少数派のほうを指摘する。題名は指摘しない（minorityCase）。
 */
export const titleCaseMix: Detector = (doc, options): Finding[] => {
  const pageTitle = pageTitleOf(doc.sections);
  const judged = headingsOf(doc.sections.filter((section) => section !== pageTitle));
  const titleCase = judged.filter((entry) => entry.title).length;
  const pageTitleCase = pageTitle === undefined ? undefined : isTitleCase(pageTitle.heading);
  const minorityIsTitle = minorityCase({ titleCase, sentenceCase: judged.length - titleCase }, pageTitleCase);
  const few = minorityIsTitle === undefined ? [] : judged.filter((entry) => entry.title === minorityIsTitle);
  if (few.length > options.limit) return [];
  return few.map(({ section }) => ({
    rule: "title-case-consistency",
    severity: "info",
    line: 0,
    column: 0,
    quote: section.heading,
    values: { count: few.length, limit: options.limit, offset: section.span.start },
  }));
};
