import type { Detector, Finding, LengthUnit, Paragraph, Section, Sentence, Span } from "../plugin.ts";

const HEAD_CHARS = 6;
const HEAD_WORDS = 3;

/**
 * 書き出しの「同じさ」を測る単位は言語で違う。日本語は文字、英語は語。
 * 文字で切ると "We continued" が "Wecont" になり、引用がそのまま読み手に出る。
 */
const headOf = (sentence: Sentence, unit: LengthUnit): string => {
  const text = sentence.text.trim();
  if (unit === "char") return text.replace(/\s+/gu, "").slice(0, HEAD_CHARS);
  return text.split(/\s+/u).slice(0, HEAD_WORDS).join(" ");
};

/** 文の入れ物。文の始まりを含む、いちばん内側の箇条書きの項目の始まり。地の文なら -1。 */
const containerOf = (sentence: Sentence, lists: readonly Span[]): number =>
  lists.filter((item) => item.start <= sentence.span.start && sentence.span.start < item.end).reduce((innermost, item) => Math.max(innermost, item.start), -1);

/** 文の節。文の始まりを含む節の始まり。見出しを挟めば別の節で、FAQ の答えどうしのように別の話になる。 */
const sectionOf = (sentence: Sentence, sections: readonly Section[]): number =>
  sections
    .filter((section) => section.span.start <= sentence.span.start && sentence.span.start < section.span.end)
    .reduce((innermost, section) => Math.max(innermost, section.span.start), -1);

/** 連なりが続ける範囲: 箇条書きの項目と節の組。 */
type Run = { readonly head: string; readonly container: string; readonly members: readonly Sentence[] };

/** 前の文と今の文のあいだで、箇条書きの項目が始まっているか。文を持たない項目（画像だけの - ![図](a.png)）も連なりを切る。 */
const listBetween = (previous: Sentence | undefined, sentence: Sentence, lists: readonly Span[]): boolean =>
  previous !== undefined && lists.some((item) => item.start >= previous.span.end && item.start < sentence.span.start);

/**
 * 連なりは同じ入れ物の中でだけ続く。箇条書きの項目どうしは同じ形で並べるのが書き方そのもの（「1. SRE に関する…」「2. SRE に関する…」）で、
 * 項目をまたぐと切る。一つの項目の中の段落や、地の文の中では、これまでどおり数える。箇条書きの前後の地の文も、箇条書きで切れる。
 * 見出しを挟んでも切る（FAQ の答えごとの「Learn more about …」）。
 */
const runsOf = (sentences: readonly Sentence[], unit: LengthUnit, lists: readonly Span[], sections: readonly Section[]): Run[] =>
  sentences.reduce<Run[]>((acc, sentence) => {
    const head = headOf(sentence, unit);
    const container = `${String(containerOf(sentence, lists))} ${String(sectionOf(sentence, sections))}`;
    const last = acc.at(-1);
    // 短すぎる書き出しは「同じ」と言えない。単位ぶん揃って初めて連なりと見る。
    const full = unit === "char" ? head.length === HEAD_CHARS : head.split(" ").length === HEAD_WORDS;
    const joins = last !== undefined && last.head === head && last.container === container && !listBetween(last.members.at(-1), sentence, lists);
    if (last !== undefined && joins && full) acc[acc.length - 1] = { head, container, members: [...last.members, sentence] };
    else acc.push({ head, container, members: [sentence] });
    return acc;
  }, []);

/** 一文だけの段落の文か。 */
const standsAlone = (sentence: Sentence, paragraphs: readonly Paragraph[]): boolean =>
  paragraphs.some((paragraph) => paragraph.sentences.length === 1 && paragraph.sentences[0]?.span.start === sentence.span.start);

/**
 * 連なりのどの文も一文だけの段落（「The government's 'How to rent' guide …」を案内ごとに一段落）なら、同じ型で並べた項目で、
 * 印の無い箇条書き。同じ段落の中で続く書き出しだけを言う。
 */
const isEntryList = (run: Run, paragraphs: readonly Paragraph[]): boolean => run.members.every((sentence) => standsAlone(sentence, paragraphs));

export const repeatedHead: Detector = (doc, options): Finding[] =>
  runsOf(doc.sentences, doc.lengthUnit, doc.listSpans, doc.sections)
    .filter((run) => run.members.length > options.limit && !isEntryList(run, doc.paragraphs))
    .map((run) => ({
      rule: "repeated-sentence-head",
      severity: "warning",
      line: 0,
      column: 0,
      quote: run.members.map((sentence) => sentence.text.trim()).join(" "),
      values: { head: run.head, count: run.members.length, limit: options.limit, offset: run.members[0]?.span.start ?? 0 },
    }));
