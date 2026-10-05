import { checkSource, type SourceCheck } from "../check-source.ts";
import { configOf, CONFIG_FILE, EMPTY, type Config } from "../config/load.ts";
import { withStyle } from "../config/style.ts";
import { findingOf } from "../grade/finding.ts";
import type { GradeFinding, NotRunEntry } from "../grade/result.ts";
import type { Finding } from "../plugin.ts";
import { filledText } from "../render/text.ts";
import { loadStyles } from "../style-load.ts";
import { uiLanguageOf, type Texts } from "../ui.ts";

// One text checked as `chaff <file>` checks it, with no files around it: imported by browser.ts once chaff's own files
// are in memory, because the modules below read them as they load.

export type BrowserCheckOptions = {
  /** ja or en. Guessed from the text when left out, as the command line guesses. */
  readonly language?: string | undefined;
  /** A genre (business/report…), as --genre. */
  readonly genre?: string | undefined;
  /** chaff.yaml's contents, already parsed. Without it chaff's defaults apply, as with no chaff.yaml. */
  readonly config?: unknown;
  /** The document's name: rules for Markdown run only on a .md name. document.md when left out. */
  readonly path?: string | undefined;
  /** Run the experimental rules too, as --experimental. */
  readonly experimental?: boolean | undefined;
};

/** A finding as `chaff grade` gives it, with the rule's name and its explanation, filled as the command line fills them. */
export type BrowserFinding = GradeFinding & {
  readonly name: string;
  readonly why: string;
  readonly howToFix: string;
  /** The passage the finding is about. */
  readonly quote: string;
};

export type BrowserCheck = {
  readonly language: string;
  readonly genre: string;
  readonly findings: readonly BrowserFinding[];
  /** Each rule that did not run, and why: so no finding is never read as "checked and fine". */
  readonly notRun: readonly NotRunEntry[];
};

export const DEFAULT_PATH = "document.md";

/** The settings chaff.yaml can hold that name files or code: a browser has neither, so they are reported, not applied. */
const NEEDS_FILES = ["plugins", "include", "by_path"] as const;

const REASON: Texts<string> = {
  ja: "ファイルを読む設定で、ブラウザでは使えないため",
  en: "it reads files, which a browser does not have",
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const configFrom = (raw: unknown): Config => (raw === undefined ? EMPTY : withStyle(configOf(raw, `/${CONFIG_FILE}`), loadStyles()));

const unappliedSettings = (raw: unknown, language: string): NotRunEntry[] =>
  isRecord(raw) ? NEEDS_FILES.filter((key) => raw[key] !== undefined).map((key) => ({ rule: key, reason: REASON[uiLanguageOf(language)] })) : [];

const browserFindingOf = (finding: Finding, check: SourceCheck): BrowserFinding => {
  const rule = check.rules.find((entry) => entry.id === finding.rule);
  const fill = (field: Parameters<typeof filledText>[0] | undefined): string => (field === undefined ? "" : filledText(field, finding, check.language));
  return { ...findingOf(finding, check), name: fill(rule?.name), why: fill(rule?.why), howToFix: fill(rule?.how_to_fix), quote: finding.quote };
};

export const checkText = async (text: string, options: BrowserCheckOptions): Promise<BrowserCheck> => {
  const choice = { language: options.language, genre: options.genre, experimental: options.experimental ?? false };
  const check = await checkSource(options.path ?? DEFAULT_PATH, text, configFrom(options.config), choice);
  return {
    language: check.language,
    genre: check.genre.genre,
    findings: check.applied.kept.map((finding) => browserFindingOf(finding, check)),
    notRun: [...check.raw.skipped.map((skipped) => ({ rule: skipped.rule, reason: skipped.why })), ...unappliedSettings(options.config, check.language)],
  };
};
