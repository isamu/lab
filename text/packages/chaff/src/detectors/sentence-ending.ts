import { endingTokens, isClosed } from "../sentence-shape.ts";
import { enumeratedRuns, enumeratorStarts, numberedStarts } from "./enumerated-runs.ts";
import { continuesThrough, groupOf, majorityOf, registerOf, slipsOf, type Register } from "./register.ts";
import { isRunInLabel } from "./run-in-label.ts";
import { noticeSentences } from "./notice-paragraph.ts";
import { separatePartSentences } from "./register-separate-part.ts";
import { askerSentences } from "./asker-voice.ts";
import { licenceNoticeSentences } from "./licence-notice.ts";
import { chronologyRows } from "../chronology-rows.ts";
import { isNeutralPlainShape } from "./register-neutral-shape.ts";
import { contactBlockSentences, fieldValueSentences, labelledQuoteSentences, referenceNoteSentences, tableCellSentences } from "./register-set-apart.ts";
import { endsInSetGreeting, isDeclaration, isExclamation, isTakenUp } from "./register-voice.ts";
import { entriesForGenre } from "../lexicon-genres.ts";
import type { Detector, Finding, LexiconEntry, ProseDocument, Sentence, Span, Token } from "../plugin.ts";

/**
 * 文末の調子が混ざっているかを見る。日本語の「ですます / である」がこれ。
 *
 * どちらが正しいかは決めない。決めると、方針の違う書き手にそのまま無視される。
 * 見るのは文書の中での一貫性だけで、少数派のほうを指摘する。spec §12.3 の方針を日本語にも。
 * 終止符で終わらないもの（見出しの下の `MaaSサービス` のような名前だけの行）と、項目や段落の頭の太字の札（**速く書ける。**）は文として数えない。
 * 年表の行（1921年信号装置の製作を開始する。）も、文書の文体と揃えない書き方なので数えない。
 * 断り書きの段落（…ご了承ください。）も、本文とは別の声で書く決まり文句なので数えない（notice-paragraph.ts）。
 * 読み手の相談や質問を載せる節（【相談事例等】）の文は尋ねた人の言葉のままなので数えない（asker-voice.ts）。
 * 文書の最後に掲載先が付けた利用条件の断り書き（…ライセンスの下に提供されています。）も数えない（licence-notice.ts）。
 * 札を付けて引いた言葉（例：…。Q: …？）、印を付けた札の行の下の記入欄の値（■ 調査目的\n…とする。）、
 * 〒や電話の行のある問い合わせ先の段落も数えない（register-set-apart.ts）。
 * 一番上の見出しで分けた部分のうち、2 文以上がみな文書の多いほうと違う同じ調子のものは、別の文書として数えない（register-separate-part.ts）。
 */
/**
 * quiet: 常体と読めるが、願い・問い・言いさしの形（register-neutral-shape.ts）の文。どちらの調子の文書にも現れるので指さない。
 * 丁寧な形でしか言わない挨拶（お疲れ様でした。）、演説の決意の言い切り（二度と繰り返さない。）、
 * 次の文が「そんな」「これだけ」で受ける場面の書き出し、「！」で終わる叫び（わかるかっ！）も quiet（register-voice.ts）。
 * ※で始まる行の注記と、行に並べ直した表のセル（制限なし。）は、どちらの調子でも quiet（register-set-apart.ts）。
 * 数には入れる。数から外すと、常体を何度も使う文書（演説）で少数派が閾値を下回り、残りの常体の文が新たに指されてしまう。
 */
type Entry = { readonly sentence: Sentence; readonly register: Register; readonly group: number | undefined; readonly quiet: boolean };

/** 文の調子と quiet を決める語彙表。polite は polite-ending、neutral は neutral-ending、requests は neutral-request、wishes は neutral-wish、
 * greetings は set-polite-phrase、declaration は declaration-particle を文書の genre で絞ったもの、openers は takeup-opener。 */
type EndingWords = {
  readonly polite: readonly LexiconEntry[];
  readonly neutral: readonly LexiconEntry[];
  readonly requests: readonly LexiconEntry[];
  readonly wishes: readonly LexiconEntry[];
  readonly greetings: readonly LexiconEntry[];
  readonly declaration: readonly LexiconEntry[];
  readonly openers: readonly LexiconEntry[];
};

type Read = { readonly register: Register; readonly quiet: boolean };

const endingWords = (doc: ProseDocument, polite: readonly LexiconEntry[], genre: string | undefined): EndingWords => ({
  polite,
  neutral: doc.lexicons["neutral-ending"] ?? [],
  requests: doc.lexicons["neutral-request"] ?? [],
  wishes: doc.lexicons["neutral-wish"] ?? [],
  greetings: doc.lexicons["set-polite-phrase"] ?? [],
  declaration: entriesForGenre(doc.lexicons["declaration-particle"] ?? [], genre),
  openers: doc.lexicons["takeup-opener"] ?? [],
});

/** 調子を持つ文のうち、指さない形か。next は同じ文書の次の文、between はその間の文字列。 */
const isQuiet = (sentence: Sentence, ending: readonly Token[], register: Register, words: EndingWords, next: Sentence | undefined, between: string): boolean =>
  register === "polite"
    ? endsInSetGreeting(sentence, words.greetings)
    : isNeutralPlainShape(sentence, ending, words.requests, words.wishes) ||
      isDeclaration(sentence, ending, words.declaration) ||
      isExclamation(sentence) ||
      isTakenUp(next, between, words.openers);

const registerOfSentence = (doc: ProseDocument, index: number, words: EndingWords): Read | undefined => {
  const sentence = doc.sentences[index];
  if (sentence === undefined) return undefined;
  const ending = endingTokens(sentence);
  const tokens = sentence.tokens ?? [];
  const head = ending[0] === undefined ? -1 : tokens.indexOf(ending[0]);
  const register = registerOf(ending, head > 0 ? tokens.slice(0, head) : [], words.polite, words.neutral);
  if (register === undefined) return undefined;
  const next = doc.sentences[index + 1];
  const between = next === undefined ? "" : doc.source.slice(sentence.span.end, next.span.start);
  return { register, quiet: isQuiet(sentence, ending, register, words, next, between) };
};

/** 番号で始まる段落の並び。木を組むのは高いので、調子が一つだけの文書（混ざりようがない）では組まない。 */
const runsOf = (doc: ProseDocument, registers: readonly Register[]): Span[] => {
  const tree = new Set(registers).size > 1 ? doc.structure : undefined;
  if (tree === undefined) return [];
  return enumeratedRuns(
    doc.paragraphs.map((paragraph) => paragraph.span),
    enumeratorStarts(numberedStarts(tree), doc.sentences, doc.source),
    doc.source,
  );
};

/** 調子を持つ文と、比べ合うまとまり（groupOf）。polite は語彙表 polite-ending。 */
export const judgedSentences = (doc: ProseDocument, polite: readonly LexiconEntry[], genre?: string): Entry[] => {
  const words = endingWords(doc, polite, genre);
  const lists = doc.lists.map((list) => list.span);
  const rows = chronologyRows(doc);
  const asked = askerSentences(doc.sections, doc.lexicons["asker-heading"] ?? []);
  const licence = licenceNoticeSentences(doc, doc.lexicons["licence-word"] ?? []);
  const quoted = labelledQuoteSentences(doc.paragraphs, doc.source, doc.lexicons["quote-label"] ?? []);
  const fields = fieldValueSentences(doc.sentences, doc.source);
  const contact = contactBlockSentences(doc.sentences, doc.source, doc.lexicons["contact-line-opener"] ?? []);
  const asides = new Set([...referenceNoteSentences(doc.sentences, doc.source), ...tableCellSentences(doc.sentences, doc.source)]);
  const all = doc.sentences.flatMap((sentence, index): { sentence: Sentence; register: Register; quiet: boolean }[] => {
    if (
      !isClosed(sentence) ||
      rows.has(sentence) ||
      asked.has(sentence) ||
      licence.has(sentence) ||
      quoted.has(sentence) ||
      fields.has(sentence) ||
      contact.has(sentence) ||
      continuesThrough(doc.sentences, index) ||
      isRunInLabel(doc.source, sentence.span)
    )
      return [];
    const read = registerOfSentence(doc, index, words);
    return read === undefined ? [] : [{ sentence, register: read.register, quiet: read.quiet || asides.has(sentence) }];
  });
  const registers = new Map(all.map((entry) => [entry.sentence, entry.register]));
  const majority = majorityOf(all.map((entry) => ({ register: entry.register, group: undefined })));
  const registerAt = (sentence: Sentence): Register | undefined => registers.get(sentence);
  const notices = noticeSentences(doc.paragraphs, doc.lexicons["notice-phrase"] ?? [], registerAt, majority);
  const parts = separatePartSentences(doc.sections, registerAt, majority);
  const found = all.filter((entry) => !notices.has(entry.sentence) && !parts.has(entry.sentence));
  const runs = runsOf(
    doc,
    found.map((entry) => entry.register),
  );
  return found.map((entry): Entry => ({ ...entry, group: groupOf(entry.sentence.span.start, lists, runs) }));
};

export const sentenceEnding: Detector = (doc, options): Finding[] => {
  const judged = judgedSentences(doc, options.lexicon ?? [], options.genre);
  // 数えたのは文が属するまとまりの中なので、文言もそのまとまりを名指す（本文の中で / この箇条書きの中で）。
  const slips = slipsOf(judged, options.limit).filter(({ entry }) => !entry.quiet);
  return slips.map(({ entry: { sentence, group }, count }) => ({
    rule: "no-mixed-desumasu",
    severity: "warning",
    line: 0,
    column: 0,
    quote: sentence.text.trim(),
    ...(group === undefined ? {} : { variant: "list" }),
    values: { count, limit: options.limit, offset: sentence.span.start },
  }));
};
