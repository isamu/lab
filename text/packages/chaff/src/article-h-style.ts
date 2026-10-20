// "an" before a sounded h (an hospital, an hereditament) is the usage of older English, and some writers keep it still.
// A document that writes it on purpose writes it more than once, and more often than "a" before such a word: there it is
// the document's style, and chaff takes no side on style. Once, or against a document that mostly writes "a", it is a slip.
// Pure.

/** One article before a word that starts with a sounded h: whether the article is "an". */
export type HArticle = { readonly an: boolean };

/** Fewer uses of "an" than this are a slip, not a style. */
const MIN_STYLE_USES = 2;

/** Whether the document writes "an" before a sounded h as its style: at least twice, and more often than "a". */
export const writesAnBeforeH = (articles: readonly HArticle[]): boolean => {
  const an = articles.filter((article) => article.an).length;
  return an >= MIN_STYLE_USES && an > articles.length - an;
};
