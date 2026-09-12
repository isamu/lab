import type { Detector, Finding, LengthUnit, Sentence } from "../plugin.ts";

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

type Run = { readonly head: string; readonly members: readonly Sentence[] };

const runsOf = (sentences: readonly Sentence[], unit: LengthUnit): Run[] =>
  sentences.reduce<Run[]>((acc, sentence) => {
    const head = headOf(sentence, unit);
    const last = acc.at(-1);
    // 短すぎる書き出しは「同じ」と言えない。単位ぶん揃って初めて連なりと見る。
    const full = unit === "char" ? head.length === HEAD_CHARS : head.split(" ").length === HEAD_WORDS;
    if (last !== undefined && last.head === head && full) {
      return [...acc.slice(0, -1), { head, members: [...last.members, sentence] }];
    }
    return [...acc, { head, members: [sentence] }];
  }, []);

export const repeatedHead: Detector = (doc, options): Finding[] =>
  runsOf(doc.sentences, doc.lengthUnit)
    .filter((run) => run.members.length > options.limit)
    .map((run) => ({
      rule: "repeated-sentence-head",
      severity: "warning",
      line: 0,
      column: 0,
      quote: run.members.map((sentence) => sentence.text.trim()).join(" "),
      values: { head: run.head, count: run.members.length, limit: options.limit, offset: run.members[0]?.span.start ?? 0 },
    }));
