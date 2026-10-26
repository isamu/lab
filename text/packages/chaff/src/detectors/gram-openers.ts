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

/**
 * 識別子だけの見出し（`max-age`、【dict1】、[draft]）。参照の項目の名前で、節は一つの項目の説明。
 * 括弧の中が言葉の札（【アドバイス等】）なら、相談事例ごとに繰り返す欄の名前で、項目の名前ではない。
 */
const IDENTIFIER_HEADING = /^(?:`[^`]+`|【[\w.:/-]+】|\[[\w.:/-]+\])$/u;

/** 定義の並びの説明（「- : …」「: …」）。Markdown の定義の書き方で、項目の名前の下の行が「: 」で始まる。 */
const DEFINITION_LINE = /(?:^|\n)[ \t]*(?:[-*+][ \t]+)?:[ \t]*$/u;
const DEFINITION_REACH = 12;

const opensDefinition = (sentence: Sentence, source: string): boolean =>
  /^\s*:\s/u.test(sentence.text) || DEFINITION_LINE.test(source.slice(Math.max(0, sentence.span.start - DEFINITION_REACH), sentence.span.start));

const BLANK_LINE = /\n[ \t]*\n/u;

/** first から始まる段落（空行まで）の文。 */
const paragraphFrom = (sentences: readonly Sentence[], first: Sentence, source: string): Sentence[] => {
  const blank = source.slice(first.span.start).search(BLANK_LINE);
  const end = blank === -1 ? source.length : first.span.start + blank;
  return sentences.filter((sentence) => sentence.span.start >= first.span.start && sentence.span.start < end);
};

/**
 * 参照の項目の説明の段落: 識別子だけの見出しの節の最初の段落と、定義の並びの説明の段落。参照の項目は同じ枠で書く
 * （…ことを示します、…の有効なソースを指定します、…は冗長な表現です。…を省き簡潔な表現にすると…）。並んだ項目のどれも同じ書き方なのは
 * 書式で、読み手は項目を一つずつ引く。
 */
export const entryOpeners = (sections: readonly Pick<Section, "heading" | "sentences">[], source: string): Sentence[] =>
  sections.flatMap((section) => {
    const first = section.sentences[0];
    const starts = [
      ...(first !== undefined && IDENTIFIER_HEADING.test(section.heading.trim()) ? [first] : []),
      ...section.sentences.filter((sentence) => opensDefinition(sentence, source)),
    ];
    return starts.flatMap((start) => paragraphFrom(section.sentences, start, source));
  });

const FRAGMENT_END = /[\p{P}\p{S}]\s*$/u;
const NOUN_END = new Set(["NOUN", "PROPN", "NUM"]);
const LINE_END_NEXT = /^[ \t]*(?:\n|$)/u;

/**
 * 句点の無い、名詞で終わる一行（「e-Govアカウント仮登録入力画面で入力されたメールアドレス」）。文ではなく、表の欄や項目の名前。
 * 変換が表を段落に崩しても、欄の値は行ごとに同じ言い回しを持つ。品詞が無ければ見分けない。
 */
export const nounFragments = (sentences: readonly Sentence[], source: string): Sentence[] =>
  sentences.filter((sentence) => {
    const last = sentence.tokens?.filter((token) => token.pos !== "PUNCT" && token.pos !== "SYM").at(-1);
    return (
      last !== undefined &&
      NOUN_END.has(last.pos) &&
      !FRAGMENT_END.test(sentence.text) &&
      LINE_END_NEXT.test(source.slice(sentence.span.end, sentence.span.end + LOOKAHEAD))
    );
  });

/** 節のひな形の文: 一覧を導く節の最初の文と、項目ごとの見出し（itemTitles）。 */
export const sectionOpeners = (sections: readonly Pick<Section, "depth" | "sentences">[], source: string): Set<Sentence> =>
  new Set(sections.flatMap((section) => [...leadsIntoList(section, source), ...itemTitles(section.sentences, source)]));
