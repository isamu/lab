import type { Section, Sentence } from "../plugin.ts";

/** A list item or a table row on a line after the sentence: what the sentence leads into. */
const LIST_OR_TABLE_NEXT = /^[ \t]*\n\s*(?:[-*+]\s|\d{1,3}[.)]\s|\|)/u;

/** How far past the sentence to look for that line: blank lines between, never the rest of a long document. */
const LOOKAHEAD = 200;

/** 番号の印（（1）、(2)、3．、第4、⑤）。数の点の後ろに数字が続けば小数（3.14）。 */
const ITEM_LABEL = String.raw`(?:[（(][\d０-９一二三四五六七八九十]{1,3}[）)]|[\d０-９]{1,3}[．.)）](?![\d０-９])|第[\d０-９一二三四五六七八九十]{1,3}|[①-⑳])`;
/** 箇条書きの印（- 、1. ）。 */
const LIST_MARKER = String.raw`(?:[-*+]|\d{1,3}[.)])[ \t]+`;
const OPENS_WITH_LABEL = new RegExp(String.raw`^\s*${ITEM_LABEL}`, "u");
const SENTENCE_END = /[。．.!?！？]\s*$/u;
/** 行の頭か、箇条書きの印の後ろ。 */
const LINE_START = new RegExp(String.raw`(?:^|\n)[ \t]*(?:${LIST_MARKER})?$`, "u");
const LINE_START_REACH = 8;
/**
 * 行の終わりの後ろの、次の空でない行が本文であること。次の行も番号の印で始まれば、番号を振った項目の並び（（1）申請書を出す、
 * （2）…）で、見出しではない。
 */
const FOLLOWED_BY_BODY = new RegExp(String.raw`^[ \t]*\n\s*(?!(?:${LIST_MARKER})?${ITEM_LABEL})\S`, "u");

/**
 * 行の頭の番号の印で始まり、句点で終わらず、一行を占め、後ろに本文が続く文（「（1）芸術の振興に係る規定に関する改正（第8条関係）」）。項目ごとの見出しで、
 * 並べた見出しは同じ枠（…に係る規定に関する改正）を繰り返す。言い回しがどれもこの文にだけ出るなら見出しのひな形。
 */
export const itemTitles = (sentences: readonly Sentence[], source: string): Sentence[] =>
  sentences.filter(
    (sentence) =>
      OPENS_WITH_LABEL.test(sentence.text) &&
      !SENTENCE_END.test(sentence.text) &&
      LINE_START.test(source.slice(Math.max(0, sentence.span.start - LINE_START_REACH), sentence.span.start)) &&
      FOLLOWED_BY_BODY.test(source.slice(sentence.span.end, sentence.span.end + LOOKAHEAD)),
  );

/**
 * 見出しのある節の最初の文のうち、次の行から箇条書きか表が続くもの。参照用の文書は、節ごとに同じ書き出しで一覧を導く
 * （「…によると以下の制約である。」の後ろに制約の箇条書き）。言い回しがどれもこの文にだけ出るなら節のひな形で、書き手が言い直したのではない。
 * 後ろが本文の文なら、節ごとの口癖（正直なところ、…）と見分けられないので入れない。導入部（見出しの前）は節ではない。
 */
const leadsIntoList = (section: Pick<Section, "depth" | "sentences">, source: string): Sentence[] => {
  const first = section.sentences[0];
  if (section.depth === 0 || first === undefined) return [];
  return LIST_OR_TABLE_NEXT.test(source.slice(first.span.end, first.span.end + LOOKAHEAD)) ? [first] : [];
};

/** 節のひな形の文: 一覧を導く節の最初の文と、項目ごとの見出し（itemTitles）。 */
export const sectionOpeners = (sections: readonly Pick<Section, "depth" | "sentences">[], source: string): Set<Sentence> =>
  new Set(sections.flatMap((section) => [...leadsIntoList(section, source), ...itemTitles(section.sentences, source)]));
