import { bareUrls } from "../bare-url.ts";
import { entryIn } from "./lexicon-match.ts";
import type { LexiconEntry, ProseDocument, Sentence } from "../plugin.ts";

/** 利用条件の断り書きとして読む段落の文の数の上限。断り書きは一、二文で、これより長い最後の段落は本文の結び。 */
const MAX_NOTICE_SENTENCES = 3;

/** 段落の中に、そのまま書いた URL かリンクがあるか。 */
const isLinked = (doc: Pick<ProseDocument, "source" | "links">, start: number, end: number): boolean =>
  bareUrls(doc.source.slice(start, end)).length > 0 || doc.links.some((link) => link.start >= start && link.end <= end);

/**
 * 文書の最後に置いた、利用条件の断り書きの段落の文（「本著作は … ライセンスの下に提供されています。内容は https://… でご確認ください。」）。
 * 掲載先が記事ごとに付ける決まり文句で、本文の調子や空け方とは別の書き手のもの。形で読む: 文書の最後の文で終わる短い段落で、
 * 利用条件の名前の語（cues、語彙表 licence-word）を含み、条件の本文へのリンクか URL を持つもの。条件の名前は数えない。
 */
export const licenceNoticeSentences = (
  doc: Pick<ProseDocument, "source" | "links" | "paragraphs" | "sentences">,
  cues: readonly LexiconEntry[],
): ReadonlySet<Sentence> => {
  const last = doc.paragraphs.at(-1);
  const closing = doc.sentences.at(-1);
  if (last === undefined || closing === undefined || doc.paragraphs.length < 2) return new Set();
  const closesDocument = last.sentences.includes(closing);
  const short = last.sentences.length <= MAX_NOTICE_SENTENCES;
  const named = last.sentences.some((sentence) => cues.some((cue) => entryIn(sentence, cue)));
  const notice = closesDocument && short && named && isLinked(doc, last.span.start, last.span.end);
  return new Set(notice ? last.sentences : []);
};
