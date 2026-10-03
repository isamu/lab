// The plugin API: everything a team's rule or a plugin package may rely on, and nothing else. A detector sees the
// document only through these shapes, so chaff can change how it reads a document without breaking a plugin. Raise
// API_VERSION when a change here would break a plugin written against the current one.

/** The plugin API this chaff implements. A plugin says which one it was written for; chaff refuses any other. */
export const API_VERSION = 1;

/** A place in doc.source: UTF-16 offsets, end exclusive. */
export type Span = { readonly start: number; readonly end: number };

/** One word as the language adapter read it. pos is a Universal Dependencies UPOS tag (NOUN, VERB, ADP…). */
export type Token = {
  readonly span: Span;
  readonly surface: string;
  readonly pos: string;
  readonly lemma?: string;
  /** How the word is read (katakana for Japanese). Only adapters that can read it give it. */
  readonly reading?: string;
  /** Universal Dependencies FEATS the adapter folded in (Voice=Pass). */
  readonly features?: Readonly<Record<string, string>>;
};

/** tokens is there only when the rule asked for parts of speech (requires: [pos]) and the adapter could give them. */
export type Sentence = { readonly span: Span; readonly text: string; readonly tokens?: readonly Token[] };

export type Paragraph = { readonly span: Span; readonly sentences: readonly Sentence[] };

/** A heading and what follows it, up to the next heading. The text before the first heading is a section of depth 0. */
export type Section = { readonly depth: number; readonly heading: string; readonly span: Span; readonly sentences: readonly Sentence[] };

/** One bulleted or numbered list, with the length of each item in characters. */
export type List = { readonly span: Span; readonly itemLengths: readonly number[] };

/** One entry of a word list. instead_of is another way to write the same thing, for rules that check a document is consistent. */
export type LexiconEntry = { readonly pattern: string; readonly instead_of?: string };

export type Lexicon = readonly LexiconEntry[];

export type MarkupHeading = { readonly depth: number; readonly text: string; readonly span: Span };

/** alt is undefined for an HTML <img> with no alt attribute. */
export type MarkupImage = { readonly alt: string | undefined; readonly span: Span };

export type MarkupLink = { readonly destination: string; readonly span: Span };

/** The document's markup. A plain-text document has markdown: false and no headings, images or links. */
export type Markup = {
  readonly markdown: boolean;
  readonly headings: readonly MarkupHeading[];
  readonly images: readonly MarkupImage[];
  readonly links: readonly MarkupLink[];
  /** The in-page names the writer gave ({#id} on a heading, HTML id and name), sorted. */
  readonly ids: readonly string[];
  /** What the reader sees as text: everything outside links. */
  readonly texts: readonly Span[];
};

/** What a detector reads. Every span is a place in source. It is frozen: a detector cannot change what other rules see. */
export type RuleDocument = {
  readonly path: string;
  readonly source: string;
  /** The language the document is checked as: "ja", "en". */
  readonly language: string;
  /** What a length counts: characters (ja) or words (en). */
  readonly lengthUnit: "char" | "word";
  readonly sentences: readonly Sentence[];
  readonly paragraphs: readonly Paragraph[];
  readonly sections: readonly Section[];
  readonly lists: readonly List[];
  /** Each list item, wherever it is. */
  readonly listItems: readonly Span[];
  /** Each link, as written (`[text](url)`, `<https://…>`). */
  readonly links: readonly Span[];
  /** The word lists for the document's language: the adapter's, the team's and the plugins'. */
  readonly lexicons: Readonly<Record<string, Lexicon>>;
  readonly markup: Markup;
};

/** What a detector is given besides the document. lexicon is the rule's word_list for the document's language. */
export type DetectorOptions = { readonly lexicon: Lexicon | undefined };

/**
 * One place a rule found. start (and end) are offsets in doc.source. values fill the rule's message: {matched} is
 * source from start to end unless values gives it.
 */
export type Finding = {
  readonly start: number;
  readonly end?: number;
  readonly values?: Readonly<Record<string, string | number>>;
};

/** A rule's check. It must be pure and deterministic: no files, network, clock or randomness, the same findings every time. */
export type Detector = (doc: RuleDocument, options: DetectorOptions) => readonly Finding[];

/** Words a reader sees: one string for every language, or one per language ({ ja, en }). */
export type Text = string | Readonly<Record<string, string>>;

export type Severity = "error" | "warning" | "info";

/**
 * A rule. In a type: module file only detect is read, and chaff.yaml gives the rest. In a plugin, id, name, why,
 * how_to_fix and example are required, as they are for a rule in custom_rules.
 */
export type RuleSpec = {
  readonly detect: Detector;
  readonly id?: string;
  readonly name?: Text;
  readonly why?: Text;
  readonly how_to_fix?: Text;
  /** { before, after }, or one pair per language as chaff's own rules write it: { ja: { before, after }, en: … }. */
  readonly example?: { readonly before: Text; readonly after: Text } | Readonly<Record<string, { readonly before: string; readonly after: string }>>;
  readonly message?: Text;
  /** One severity for normal; strict is one heavier and relaxed one lighter. Or levels, not both. */
  readonly level?: Severity;
  /** A severity for each level, as chaff's rules with nothing to count write them. normal is required. */
  readonly levels?: Readonly<Partial<Record<"strict" | "normal" | "relaxed", Severity>>>;
  /** The genres the rule is for, or their first part (business, business/report). Without it, every genre. */
  readonly use_for?: readonly string[];
  /** Where the rule reference lists it (readability, wording, …). Without it, team. */
  readonly group?: string;
  /** What the rule finds, in one line. Without it, the name. */
  readonly summary?: Text;
  /** How chaff fix-plan rewrites what the rule flags: depth (light / structure / register) and, by language, direction, pairs, keep and avoid. */
  readonly rewrite?: Readonly<Record<string, unknown>>;
  /** The languages the rule checks. Without it, every language. */
  readonly languages?: readonly string[];
  /** A word list by name; the detector gets it as options.lexicon. A plugin's own lists are named without the plugin's prefix. */
  readonly word_list?: string;
  /** "pos" when the detector reads tokens. Without it, sentences have no tokens. */
  readonly requires?: readonly "pos"[];
};

export type Rule = RuleSpec & { readonly apiVersion: number };

/** A rule, stamped with the API version it was written for. */
export const defineRule = (spec: RuleSpec): Rule => ({ ...spec, apiVersion: API_VERSION });

/** A word list in each language it has words for: { ja: [...], en: [...] }. A string is an entry with only a pattern. */
export type LexiconSpec = Readonly<Record<string, readonly (string | LexiconEntry)[]>>;

/** Lines of a genre guide: one line or a list, the same in every language, or by language ({ ja: [...], en: [...] }). */
export type GuideText = string | readonly string[] | Readonly<Record<string, string | readonly string[]>>;

/**
 * Changes to the genre guides chaff prints before the findings, by genre or group (blog/tech, legal): replace sets the
 * lines, add puts lines after them, off leaves the genre with none.
 */
export type GuideSpec = Readonly<Record<string, "off" | { readonly replace?: GuideText; readonly add?: GuideText }>>;

/** A house style a plugin ships: rule levels and options, and the guideline it follows. */
export type StyleSpec = {
  readonly id: string;
  readonly name: Text;
  readonly summary: Text;
  readonly source: { readonly title: Text; readonly url: string };
  readonly rules?: Readonly<Record<string, "strict" | "normal" | "relaxed" | "off">>;
  readonly options?: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  /** Its changes to the genre guides, while the style is chosen. */
  readonly guide?: GuideSpec;
};

/**
 * A plugin package. name is the prefix of every id it ships (name/rule-id); for chaff-plugin-foo it is foo, for
 * @scope/chaff-plugin-foo it is @scope/foo. A rule is a RuleSpec, or a custom_rules entry without code (type: words,
 * pattern or tokens).
 */
export type PluginSpec = {
  readonly name: string;
  readonly rules?: readonly (Rule | RuleSpec | Readonly<Record<string, unknown>>)[];
  readonly lexicons?: Readonly<Record<string, LexiconSpec>>;
  readonly styles?: readonly StyleSpec[];
  /** Its changes to the genre guides, whenever the plugin is loaded. */
  readonly guide?: GuideSpec;
};

export type Plugin = PluginSpec & { readonly apiVersion: number };

/** A plugin, stamped with the API version it was written for. */
export const definePlugin = (spec: PluginSpec): Plugin => ({ ...spec, apiVersion: API_VERSION });
