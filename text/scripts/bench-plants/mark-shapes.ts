// Seeded mistakes of marks for `yarn bench`: a sentence added to the first prose paragraph that mixes quote styles,
// bracket or ！？ widths, or sentence spacing, or holds a hyphen as a dash, a half-dotted "e.g", or words in capitals.
// Each added text carries its own majority, so the planted form is the minority in any sample. Pure and deterministic.
import { isJapanese, isListItem, isProse, rewriteFirst, type Mutation, type Plant } from "../bench-text.ts";

const appendTo =
  (language: string, added: string) =>
  (source: string): Plant | undefined =>
    rewriteFirst(
      source,
      (line) => isProse(line) && !isListItem(line) && !line.includes("`") && (language === "ja") === isJapanese(line) && /[。.]$/u.test(line.trimEnd()),
      (line) => `${line.trimEnd()}${language === "ja" ? "" : " "}${added}`,
    );

const plant = (id: string, rule: string, language: string, added: string): Mutation => ({ id, rule, languages: [language], plant: appendTo(language, added) });

export const MUTATIONS: readonly Mutation[] = [
  plant("quote-curly", "quote-style-consistency", "en", 'The "draft" and the "final" are ready. The “review” is next.'),
  plant("bracket-halfwidth", "bracket-width-consistency", "ja", "会議（定例）と報告（月次）は別です。資料(最新版)を配ります。"),
  plant("question-halfwidth", "exclamation-width-consistency", "ja", "本当ですか？ 来週ですか？ 今日ですか?"),
  plant("spacing-two", "sentence-spacing-consistency", "en", "We met. We talked. We agreed.  We left."),
  plant("hyphen-dash", "hyphen-as-dash", "en", "The release is late - very late."),
  plant("eg-half-dotted", "latin-abbreviation-form", "en", "Bring a document, e.g a passport."),
  plant("caps-shout", "all-caps-shouting", "en", "Do not delete the log. DO NOT DELETE THIS FILE."),
];
