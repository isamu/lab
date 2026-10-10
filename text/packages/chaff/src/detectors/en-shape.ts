import { lengthOf } from "../measure.ts";
import { isClosed } from "../sentence-shape.ts";
import { isTitleCase, minorityCase, pageTitleOf } from "./heading-case.ts";
import type { Detector, Finding, Lexicon, ProseDocument, Section, Sentence, Token } from "../plugin.ts";
import { entryOpens } from "./lexicon-match.ts";

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

/** A head written as one Latin word ("And") is read off the first word; any other (しかし) off the tokens, since Japanese has no spaces. */
const LATIN_WORD = /^[A-Za-z]+$/u;

type Heads = { readonly latin: ReadonlySet<string>; readonly other: Lexicon };

const headsOf = (lexicon: Lexicon): Heads => ({
  latin: new Set(lexicon.filter((entry) => LATIN_WORD.test(entry.pattern)).map((entry) => entry.pattern.toLowerCase())),
  other: lexicon.filter((entry) => !LATIN_WORD.test(entry.pattern)),
});

const opensWithHead = (sentence: Sentence, heads: Heads): boolean =>
  heads.latin.has(firstWord(sentence).toLowerCase()) || (sentence.tokens !== undefined && heads.other.some((entry) => entryOpens(sentence, entry)));

const headRuns = (sentences: readonly Sentence[], heads: Heads): Sentence[][] =>
  sentences.filter(isClosed).reduce<Sentence[][]>(
    (acc, sentence) => {
      const last = acc.at(-1) ?? [];
      if (!opensWithHead(sentence, heads)) return [...acc.slice(0, -1), last, []];
      return [...acc.slice(0, -1), [...last, sentence]];
    },
    [[]],
  );

/**
 * 接続詞で始まる文が続く。1 つなら効くが、続くと文が前の文の付け足しに見えて、
 * 何が主張なのかが分からなくなる。
 */
export const conjunctionRun: Detector = (doc, options): Finding[] => {
  const joiner = doc.lengthUnit === "char" ? "" : " ";
  return headRuns(doc.sentences, headsOf(options.lexicon ?? []))
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
              quote: run.map((sentence) => sentence.text.trim()).join(joiner),
              values: { count: run.length, limit: options.limit, offset: first.span.start },
            },
          ];
    });
};

/** Weekday and month names, capitalised in either style (the list leaves out May, March and August, also ordinary words). */
const FIXED_CASE_LISTS = ["calendar-name"] as const;

const headingsOf = (sections: readonly Section[], fixedCase: ReadonlySet<string>): { readonly section: Section; readonly title: boolean }[] =>
  sections.flatMap((section) => {
    const title = isTitleCase(section.heading, fixedCase);
    return title === undefined ? [] : [{ section, title }];
  });

/**
 * 見出しの大文字化が混ざっている。どちらの流儀が正しいかは決めない。spec §12.3。
 * 見るのは文書の中で揃っているかだけで、少数派のほうを指摘する。題名は指摘しない（minorityCase）。
 */
export const titleCaseMix: Detector = (doc, options): Finding[] => {
  const fixedCase = new Set(FIXED_CASE_LISTS.flatMap((id) => (doc.lexicons[id] ?? []).map((entry) => entry.pattern)));
  const pageTitle = pageTitleOf(doc.sections);
  const judged = headingsOf(
    doc.sections.filter((section) => section !== pageTitle),
    fixedCase,
  );
  const titleCase = judged.filter((entry) => entry.title).length;
  const pageTitleCase = pageTitle === undefined ? undefined : isTitleCase(pageTitle.heading, fixedCase);
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
