import type { Detector, Finding, LengthUnit, Sentence, Span } from "../plugin.ts";

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

type Run = { readonly head: string; readonly container: number; readonly members: readonly Sentence[] };

/**
 * 連なりは同じ入れ物の中でだけ続く。箇条書きの項目どうしは同じ形で並べるのが書き方そのもの（「1. SRE に関する…」「2. SRE に関する…」）で、
 * 項目をまたぐと切る。一つの項目の中の段落や、地の文の中では、これまでどおり数える。箇条書きの前後の地の文も、箇条書きで切れる。
 */
const runsOf = (sentences: readonly Sentence[], unit: LengthUnit, lists: readonly Span[]): Run[] =>
  sentences.reduce<Run[]>((acc, sentence) => {
    const head = headOf(sentence, unit);
    const container = containerOf(sentence, lists);
    const last = acc.at(-1);
    // 短すぎる書き出しは「同じ」と言えない。単位ぶん揃って初めて連なりと見る。
    const full = unit === "char" ? head.length === HEAD_CHARS : head.split(" ").length === HEAD_WORDS;
    if (last !== undefined && last.head === head && last.container === container && full) {
      return [...acc.slice(0, -1), { head, container, members: [...last.members, sentence] }];
    }
    return [...acc, { head, container, members: [sentence] }];
  }, []);

export const repeatedHead: Detector = (doc, options): Finding[] =>
  runsOf(doc.sentences, doc.lengthUnit, doc.listSpans)
    .filter((run) => run.members.length > options.limit)
    .map((run) => ({
      rule: "repeated-sentence-head",
      severity: "warning",
      line: 0,
      column: 0,
      quote: run.members.map((sentence) => sentence.text.trim()).join(" "),
      values: { head: run.head, count: run.members.length, limit: options.limit, offset: run.members[0]?.span.start ?? 0 },
    }));
