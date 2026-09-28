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

const isComma = (token: Token): boolean => token.surface === ",";

const commaBefore = (tokens: readonly Token[], at: number): boolean => tokens[at - 1]?.surface === ",";

/** 並列はこれをまたがない。セミコロンの前後は別の節。 */
const CLAUSE_BREAK = new Set([";", ":", "—"]);

/** 各 token の前で閉じていない括弧の数。括弧の中の読点（external users (e.g., guests), and ...）は外の並列を切らない。 */
const PAREN_STEP: Readonly<Record<string, number>> = { "(": 1, ")": -1 };

const depthsOf = (tokens: readonly Token[]): number[] =>
  tokens.reduce<{ depths: number[]; open: number }>(
    (acc, token) => ({ depths: [...acc.depths, acc.open], open: Math.max(0, acc.open + (PAREN_STEP[token.surface] ?? 0)) }),
    { depths: [], open: 0 },
  ).depths;

type Clause = { readonly tokens: readonly Token[]; readonly depths: readonly number[] };

/** 冠詞や引用符を飛ばした、項目の頭の品詞。the parser と an exporter と samples を同じ形と見る。 */
const NOMINAL = new Set(["NOUN", "PROPN", "PRON", "NUM", "ADJ"]);

const isContent = (token: Token): boolean => token.pos !== "DET" && token.pos !== "PUNCT" && token.pos !== "X";

const shapeOf = (item: readonly Token[]): string | undefined => {
  const head = item.find(isContent);
  if (head === undefined) return undefined;
  return NOMINAL.has(head.pos) ? "NOMINAL" : head.pos;
};

const VERBAL = new Set(["VERB", "AUX"]);

/** 主語と述語のある項目。the team fixed the bug / these are crucial。gets us more は述語だけ。 */
const isClause = (item: readonly Token[]): boolean => {
  const first = item.find((token) => token.pos !== "PUNCT" && token.pos !== "X");
  if (first === undefined || !(first.pos === "DET" || NOMINAL.has(first.pos))) return false;
  return item.some((token) => token !== first && VERBAL.has(token.pos));
};

/** 節の頭から and / or の手前までを、同じ深さの読点で項目に切る。Oxford comma の読点のあとは空なので項目にならない。 */
const itemsBefore = (clause: Clause, at: number): Token[][] => {
  const level = clause.depths[at] ?? 0;
  const start = clause.tokens.slice(0, at).findLastIndex((token) => CLAUSE_BREAK.has(token.surface)) + 1;
  return clause.tokens
    .slice(start, at)
    .reduce<Token[][]>(
      (items, token, offset) => {
        if (isComma(token) && clause.depths[start + offset] === level) return [...items, []];
        return [...items.slice(0, -1), [...(items.at(-1) ?? []), token]];
      },
      [[]],
    )
    .filter((item) => item.length > 0);
};

/** and / or の後ろの項目。次の読点か節の切れ目まで。 */
const itemAfter = (tokens: readonly Token[], at: number): Token[] => {
  const end = tokens.findIndex((token, index) => index > at && (isComma(token) || CLAUSE_BREAK.has(token.surface)));
  return tokens.slice(at + 1, end === -1 ? undefined : end);
};

/**
 * 導入の句（After the review, / If it fails, / Finally, / Based on the review,）は並列の項目ではない。
 * 節の最初の項目が前置詞・接続詞・副詞・過去分詞で始まり、次の項目と頭の形が違えば外す。
 * Quickly, quietly and carefully は残る。
 */
const LEAD_POS = new Set(["ADP", "SCONJ", "ADV"]);

const isParticiple = (token: Token): boolean => token.features?.["VerbForm"] === "Part";

const openingOf = (item: readonly Token[]): Token | undefined => item.find((token) => token.pos !== "PUNCT" && token.pos !== "X");

const openingKind = (item: readonly Token[]): string | undefined => {
  const opening = openingOf(item);
  return opening !== undefined && isParticiple(opening) ? "PARTICIPLE" : shapeOf(item);
};

const withoutLead = (items: readonly Token[][]): readonly Token[][] => {
  const [first, second] = items;
  const opening = first === undefined ? undefined : openingOf(first);
  if (first === undefined || second === undefined || opening === undefined) return items;
  if (!LEAD_POS.has(opening.pos) && !isParticiple(opening)) return items;
  return openingKind(first) === openingKind(second) ? items : items.slice(1);
};

/**
 * 形容詞のあとの読点は、名詞の前で形容詞を重ねているだけのことが多い（the long, winding bridge）。
 * 次の項目が名詞で終わるならつなげ直す。形容詞そのものの並び（quick, cheap and reliable）は切ったまま。
 */
const lastContent = (item: readonly Token[]): Token | undefined => item.findLast(isContent);

const joinAdjectives = (items: readonly Token[][]): Token[][] =>
  items.reduce<Token[][]>((joined, item) => {
    const previous = joined.at(-1);
    const stacked = previous !== undefined && lastContent(previous)?.pos === "ADJ" && lastContent(item)?.pos !== "ADJ";
    return stacked ? [...joined.slice(0, -1), [...previous, ...item]] : [...joined, item];
  }, []);

/**
 * 節を並べるなら、どの項目も節。Additionally, others can learn, and the mistake is rarer. の
 * Additionally は項目ではなく、and の前の読点は節をつなぐ読点。名詞の並びは最初の項目に前置き
 * （We shipped the parser）を抱えるので、この確かめは節の並びだけにする。
 * and の後ろだけが節なのは主語の並び（The parser, the renderer and the exporter shipped.）なので外さない。
 */
const clausesAgree = (items: readonly Token[][], after: readonly Token[]): boolean => {
  const last = items.at(-1);
  if (last === undefined || !isClause(last)) return true;
  return isClause(after) && items.every(isClause);
};

/**
 * 動詞で始まる項目を並べるなら、どの項目にも動詞がある。The scope, in contrast, is larger, and covers ... の
 * The scope は項目ではなく、後ろの述語の主語。
 */
const hasVerb = (item: readonly Token[]): boolean => item.some((token) => VERBAL.has(token.pos));

const predicatesAgree = (items: readonly Token[][], shape: string): boolean => !VERBAL.has(shape) || items.every(hasVerb);

/**
 * 読点で区切った項目が and / or の前に 2 つ以上あり、最後の項目と and の後ろが同じ形のときだけ並列。
 * 導入の読点（After the review, the team fixed the bug and shipped it.）や、節をつなぐ読点
 * （We tested it, and the team shipped it.）は、Oxford comma を打つかどうかの選択を見せない。
 */
const listAt = (clause: Clause, at: number): boolean | undefined => {
  const items = withoutLead(joinAdjectives(itemsBefore(clause, at)));
  const after = itemAfter(clause.tokens, at);
  const last = items.at(-1);
  const shape = last === undefined ? undefined : shapeOf(last);
  if (items.length < 2 || shape === undefined || shape !== shapeOf(after)) return undefined;
  if (!clausesAgree(items, after) || !predicatesAgree(items, shape)) return undefined;
  return commaBefore(clause.tokens, at);
};

/**
 * 3 つ以上の並列の最後の and / or の前に読点を打つか。Oxford comma。
 *
 * どちらが正しいかは決めない。スタイルガイドで割れる論点に立場を取ると rule ごと無視される。
 * 見るのは 1 つの文書で揃っているかだけ。spec §12.3。
 */
const oxfordIn = (tokens: readonly Token[]): boolean | undefined => {
  const clause = { tokens, depths: depthsOf(tokens) };
  return tokens.reduce<boolean | undefined>(
    (found, token, at) => found ?? (at > 0 && LIST_CONJUNCTION.has(token.surface.toLowerCase()) ? listAt(clause, at) : undefined),
    undefined,
  );
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
