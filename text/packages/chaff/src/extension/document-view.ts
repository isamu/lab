import type * as Api from "../api.ts";
import type { BulletList, Lexicon, Markup, Paragraph, ProseDocument, Section, Sentence, Span, Token } from "../plugin.ts";

// The document as the plugin API shows it (api.ts RuleDocument): copies of only the public fields, frozen. A copy, so
// chaff's own shapes can change without breaking a plugin; frozen, so a plugin's rule cannot change what the next rule reads.

const freezeAll = (value: unknown): void => {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return;
  Object.values(value).forEach(freezeAll);
  Object.freeze(value);
};

const deepFreeze = <T>(value: T): T => {
  freezeAll(value);
  return value;
};

const spanOf = (span: Span): Api.Span => ({ start: span.start, end: span.end });

const tokenOf = (token: Token): Api.Token => ({
  span: spanOf(token.span),
  surface: token.surface,
  pos: token.pos,
  ...(token.lemma === undefined ? {} : { lemma: token.lemma }),
  ...(token.reading === undefined ? {} : { reading: token.reading }),
  ...(token.features === undefined ? {} : { features: { ...token.features } }),
});

/** Sentences are shared by the document, its paragraphs and its sections; each is copied once, so they stay one object. */
type SentenceCopies = (sentence: Sentence) => Api.Sentence;

const sentenceCopier = (): SentenceCopies => {
  const copies = new Map<Sentence, Api.Sentence>();
  return (sentence) => {
    const known = copies.get(sentence);
    if (known !== undefined) return known;
    const copy = { span: spanOf(sentence.span), text: sentence.text, ...(sentence.tokens === undefined ? {} : { tokens: sentence.tokens.map(tokenOf) }) };
    copies.set(sentence, copy);
    return copy;
  };
};

const paragraphOf = (paragraph: Paragraph, copy: SentenceCopies): Api.Paragraph => ({
  span: spanOf(paragraph.span),
  sentences: paragraph.sentences.map(copy),
});

const sectionOf = (section: Section, copy: SentenceCopies): Api.Section => ({
  depth: section.depth,
  heading: section.heading,
  span: spanOf(section.span),
  sentences: section.sentences.map(copy),
});

const listOf = (list: BulletList): Api.List => ({ span: spanOf(list.span), itemLengths: [...list.items] });

const lexiconOf = (lexicon: Lexicon): Api.Lexicon =>
  lexicon.map((entry) => ({ pattern: entry.pattern, ...(entry.instead_of === undefined ? {} : { instead_of: entry.instead_of }) }));

const markupOf = (markup: Markup): Api.Markup => ({
  markdown: markup.markdown,
  headings: markup.headings.map((heading) => ({ depth: heading.depth, text: heading.text, span: { start: heading.start, end: heading.end } })),
  images: markup.images.map((image) => ({ alt: image.alt, span: { start: image.start, end: image.end } })),
  links: markup.links.map((link) => ({ destination: link.destination, span: { start: link.start, end: link.end } })),
  ids: [...markup.ids].toSorted((left, right) => left.localeCompare(right, "en")),
  texts: markup.texts.map(spanOf),
});

const EMPTY_MARKUP: Markup = { markdown: false, headings: [], images: [], links: [], ids: new Set(), texts: [] };

const viewOf = (doc: ProseDocument): Api.RuleDocument => {
  const copy = sentenceCopier();
  const fields = deepFreeze({
    path: doc.path,
    source: doc.source,
    language: doc.language,
    lengthUnit: doc.lengthUnit,
    sentences: doc.sentences.map(copy),
    paragraphs: doc.paragraphs.map((paragraph) => paragraphOf(paragraph, copy)),
    sections: doc.sections.map((section) => sectionOf(section, copy)),
    lists: doc.lists.map(listOf),
    listItems: doc.listSpans.map(spanOf),
    links: doc.links.map(spanOf),
    lexicons: Object.fromEntries(Object.entries(doc.lexicons).map(([name, lexicon]) => [name, lexiconOf(lexicon)])),
  });
  // The markup is read from the Markdown tree only when a rule asks for it, as chaff's own rules do.
  const markup: { value: Api.Markup | undefined } = { value: undefined };
  return Object.freeze({
    ...fields,
    get markup(): Api.Markup {
      markup.value ??= deepFreeze(markupOf(doc.markup ?? EMPTY_MARKUP));
      return markup.value;
    },
  });
};

/** A word list as a detector is given it (DetectorOptions.lexicon): public fields only, frozen. */
export const frozenLexiconOf = (lexicon: Lexicon): Api.Lexicon => deepFreeze(lexiconOf(lexicon));

const views = new WeakMap<ProseDocument, Api.RuleDocument>();

/** The document as a plugin's detector sees it. Made once per document, however many plugin rules read it. */
export const ruleDocumentOf = (doc: ProseDocument): Api.RuleDocument => {
  const known = views.get(doc);
  if (known !== undefined) return known;
  const view = viewOf(doc);
  views.set(doc, view);
  return view;
};
