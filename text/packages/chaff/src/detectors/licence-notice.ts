import { bareUrls } from "../bare-url.ts";
import { entryIn } from "./lexicon-match.ts";
import type { LexiconEntry, ProseDocument, Sentence } from "../plugin.ts";

/** 利用条件の断り書きとして読む段落の文の数の上限。断り書きは一、二文で、これより長い最後の段落は本文の結び。 */
const MAX_NOTICE_SENTENCES = 3;

/** 文の中に、そのまま書いた URL かリンクがあるか。文の text では URL は空白に覆われているので、source で見る。 */
const isLinked = (doc: Pick<ProseDocument, "source" | "links">, sentence: Sentence): boolean =>
  bareUrls(doc.source.slice(sentence.span.start, sentence.span.end)).length > 0 ||
  doc.links.some((link) => link.start >= sentence.span.start && link.end <= sentence.span.end);

/** 段落の後ろに、空白のほかに何も無いか（表や箇条書きが続く段落は、文書を閉じていない）。 */
const closesDocument = (doc: Pick<ProseDocument, "source" | "prose">, end: number): boolean => (doc.prose ?? doc.source).slice(end).trim() === "";

/**
 * 文書の最後に置いた、利用条件の断り書きの段落の文（「本著作は … ライセンスの下に提供されています。内容は https://… でご確認ください。」）。
 * 掲載先が記事ごとに付ける決まり文句で、本文の調子や空け方とは別の書き手のもの。形で読む: 後ろに何も続かない短い段落で、
 * 利用条件の名前の語（cues、語彙表 licence-word）と、条件の本文へのリンクか URL とを、同じ文に持つもの。
 * 語と URL が別の文にあるだけの結び（「ライセンスの選び方が要る。詳しくは https://… を参照。」）は、書き手の本文として残す。
 */
export const licenceNoticeSentences = (
  doc: Pick<ProseDocument, "source" | "prose" | "links" | "paragraphs">,
  cues: readonly LexiconEntry[],
): ReadonlySet<Sentence> => {
  const last = doc.paragraphs.at(-1);
  if (last === undefined || doc.paragraphs.length < 2 || last.sentences.length > MAX_NOTICE_SENTENCES) return new Set();
  const names = (sentence: Sentence): boolean => cues.some((cue) => entryIn(sentence, cue)) && isLinked(doc, sentence);
  return new Set(closesDocument(doc, last.span.end) && last.sentences.some(names) ? last.sentences : []);
};
