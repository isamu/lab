import type { Paragraph, Sentence } from "./plugin.ts";

/** 段落の頭の注の番号（(1)、（2）、[3]）。 */
const NOTE_LABEL = /^[ \t　]*(?:[(（]\s*(\d{1,3})\s*[)）]|\[(\d{1,3})\])/u;

/** 注の並びと読む最少の数。番号の付いた段落が二つ続くだけなら、本文の (1)(2) の列挙と見分けがつかない。 */
const MIN_NOTES = 3;

/** 出典の印: URL か西暦の年（2020、1998）。注や文献の項目は出典を書き、本文の (1)(2) の列挙はふつう書かない。 */
const SOURCE_MARK = /https?:\/\/|(?<!\d)(?:1[89]|20)\d{2}(?!\d)/u;

/** 項目の半分以上が出典の印を持つ並びだけを、注や文献の一覧と読む。 */
const citesSources = (source: string, run: readonly Paragraph[]): boolean =>
  run.filter((paragraph) => SOURCE_MARK.test(source.slice(paragraph.span.start, paragraph.span.end))).length * 2 >= run.length;

const labelOf = (source: string, paragraph: Paragraph): number | undefined => {
  const match = NOTE_LABEL.exec(source.slice(paragraph.span.start, paragraph.span.end));
  const label = match?.[1] ?? match?.[2];
  return label === undefined ? undefined : Number(label);
};

/** 1 から一つずつ増える番号の付いた段落の並び。番号の無い段落は間に挟まってよく、並びには入れない。 */
const labelledRuns = (source: string, paragraphs: readonly Paragraph[]): Paragraph[][] =>
  paragraphs.reduce<Paragraph[][]>((runs, paragraph) => {
    const label = labelOf(source, paragraph);
    if (label === undefined) return runs;
    const run = runs.at(-1);
    if (label === (run?.length ?? 0) + 1 && run !== undefined) run.push(paragraph);
    else if (label === 1) runs.push([paragraph]);
    return runs;
  }, []);

/**
 * 注や文献の一覧の段落の文（(1) 著者. 題. 誌名. 2020. / (2) …）。項目は名前や題を並べたもので、名詞で止めるのが書き方。
 * 段落の頭に 1 から順に番号を付けた段落が MIN_NOTES 以上続き、その半分以上が出典の印（URL、西暦の年）を持つものだけを、一覧と読む。
 */
export const noteSentences = (source: string, paragraphs: readonly Paragraph[]): ReadonlySet<Sentence> =>
  new Set(
    labelledRuns(source, paragraphs)
      .filter((run) => run.length >= MIN_NOTES && citesSources(source, run))
      .flat()
      .flatMap((paragraph) => paragraph.sentences),
  );
