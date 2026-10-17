import type { Section, Sentence } from "../plugin.ts";

/** A list item or a table row on a line after the sentence: what the sentence leads into. */
const LIST_OR_TABLE_NEXT = /^[ \t]*\n\s*(?:[-*+]\s|\d{1,3}[.)]\s|\|)/u;

/** How far past the sentence to look for that line: blank lines between, never the rest of a long document. */
const LOOKAHEAD = 200;

/**
 * 見出しのある節の最初の文のうち、次の行から箇条書きか表が続くもの。参照用の文書は、節ごとに同じ書き出しで一覧を導く
 * （「…によると以下の制約である。」の後ろに制約の箇条書き）。言い回しがどれもこの文にだけ出るなら節のひな形で、書き手が言い直したのではない。
 * 後ろが本文の文なら、節ごとの口癖（正直なところ、…）と見分けられないので入れない。導入部（見出しの前）は節ではない。
 */
export const sectionOpeners = (sections: readonly Pick<Section, "depth" | "sentences">[], source: string): Set<Sentence> =>
  new Set(
    sections.flatMap((section) => {
      const first = section.sentences[0];
      if (section.depth === 0 || first === undefined) return [];
      return LIST_OR_TABLE_NEXT.test(source.slice(first.span.end, first.span.end + LOOKAHEAD)) ? [first] : [];
    }),
  );
