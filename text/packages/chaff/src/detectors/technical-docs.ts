// Checks a README or a manual needs: code fences tagged with a language or not, shell commands written with and without
// a prompt, a heading that names a command its section's code never shows, and a step of a numbered procedure written
// as a statement among instructions. Pure. Shell languages and prompt marks come from the shell-fence-language and
// shell-prompt lexicons.
import { codeFences, codeSpans, type CodeFence } from "./code-fences.ts";
import { opensAsNounPhrase } from "./nominal-step.ts";
import { quoteAt } from "./structure-tree.ts";
import { escapeRegExp } from "../orthography.ts";
import type { Detector, Finding, ProseDocument, Span, Token } from "../plugin.ts";

const patternsOf = (doc: ProseDocument, id: string): string[] => (doc.lexicons[id] ?? []).map((entry) => entry.pattern);

/** The members of the less used of two kinds: at most limit of them, and fewer than the other kind. */
export const minorityOf = <T>(first: readonly T[], second: readonly T[], limit: number): readonly T[] => {
  const [fewer, more] = first.length <= second.length ? [first, second] : [second, first];
  return fewer.length > 0 && fewer.length < more.length && fewer.length <= limit ? fewer : [];
};

const finding = (doc: ProseDocument, rule: string, offset: number, values: Readonly<Record<string, string | number>> = {}): Finding => ({
  rule,
  severity: "info",
  line: 0,
  column: 0,
  quote: quoteAt(doc.source, offset),
  values: { ...values, offset },
});

/** Fences without a language, when they are the fewer kind: a document that mostly leaves the language out is not reported. */
export const untaggedFewer = (fences: readonly CodeFence[], limit: number): readonly CodeFence[] => {
  const untagged = fences.filter((fence) => fence.language === "");
  const tagged = fences.filter((fence) => fence.language !== "");
  return untagged.length > 0 && untagged.length < tagged.length && untagged.length <= limit ? untagged : [];
};

export const codeFenceLanguage: Detector = (doc, options): Finding[] => {
  const fences = codeFences(doc.source);
  const tagged = fences.filter((fence) => fence.language !== "").length;
  return untaggedFewer(fences, options.limit).map((fence) =>
    finding(doc, "code-fence-language-mix", fence.start, { tagged, untagged: fences.length - tagged }),
  );
};

export type PromptStyle = "prompt" | "bare" | undefined;

/**
 * Whether a shell block writes its commands after a prompt ($ npm install) or bare (npm install). A block that mixes
 * prompted and unprompted lines shows a command with its output, and is neither. Comment lines (#) are skipped.
 */
export const promptStyleOf = (fence: CodeFence, prompts: readonly string[]): PromptStyle => {
  const lines = fence.lines.map((line) => line.trim()).filter((line) => line !== "" && !line.startsWith("#"));
  if (lines.length === 0) return undefined;
  const prompted = lines.filter((line) => prompts.some((prompt) => line.startsWith(`${prompt} `))).length;
  if (prompted === lines.length) return "prompt";
  return prompted === 0 ? "bare" : undefined;
};

export const shellPrompt: Detector = (doc, options): Finding[] => {
  const languages = new Set(patternsOf(doc, "shell-fence-language").map((language) => language.toLowerCase()));
  const prompts = patternsOf(doc, "shell-prompt");
  const shells = codeFences(doc.source).filter((fence) => languages.has(fence.language));
  const prompted = shells.filter((fence) => promptStyleOf(fence, prompts) === "prompt");
  const bare = shells.filter((fence) => promptStyleOf(fence, prompts) === "bare");
  const minority = minorityOf(prompted, bare, options.limit);
  const style = minority === prompted ? "prompt" : "bare";
  return minority.map((fence) => finding(doc, "shell-prompt-mix", fence.start, { majority: style === "prompt" ? bare.length : prompted.length }));
};

/**
 * A code span that names a command or an option: a flag (--force, -f) or a command with its arguments (npm install). A
 * single plain word (net, init) is as often a package, an endpoint or a type as a command, and is left out.
 */
const COMMAND_WORD = /^[a-z][a-z0-9_-]*$/u;
const FLAG = /^--?[A-Za-z][\w-]*$/u;

export const isCommandName = (text: string): boolean => {
  const words = text.trim().split(/\s+/u);
  const first = words[0] ?? "";
  return words.length === 1 ? FLAG.test(first) : COMMAND_WORD.test(first);
};

/** The heading without its links' text: [`net`](/pkg/net/) names the page it links to, not a command shown below. */
export const withoutLinks = (heading: string): string => {
  const pieces: string[] = [];
  const state = { at: 0 };
  while (state.at < heading.length) {
    const open = heading.indexOf("[", state.at);
    const close = open === -1 ? -1 : heading.indexOf("]", open);
    if (close === -1) break;
    pieces.push(heading.slice(state.at, open), " ");
    state.at = close + 1 + targetLength(heading, close + 1);
  }
  pieces.push(heading.slice(state.at));
  return pieces.join("");
};

/** The length of a link's target right after its text: (url), [label] or [] (a reference link); 0 when there is none. */
const targetLength = (heading: string, at: number): number => {
  const pair: Readonly<Record<string, string>> = { "(": ")", "[": "]" };
  const closer = pair[heading.charAt(at)];
  const end = closer === undefined ? -1 : heading.indexOf(closer, at);
  return end === -1 ? 0 : end - at + 1;
};

/** The commands and options a heading names: its code spans that read as one, and bare flags (--force). */
export const commandsIn = (heading: string): string[] => {
  const spans = codeSpans(withoutLinks(heading)).map((span) => span.text);
  const flags = heading
    .replace(/`[^`]*`/gu, " ")
    .split(/\s+/u)
    .filter((word) => FLAG.test(word) && word.startsWith("--"));
  return [...new Set([...spans.filter(isCommandName), ...flags])];
};

const collapse = (text: string): string => text.replace(/\s+/gu, " ");
const OPTION_CHAR = /[A-Za-z0-9_-]/u;

/**
 * A command with arguments whose program the code runs under its package's name: chaff grade as npx chaffjs grade,
 * python -m venv as python3 -m venv. The arguments must follow as written.
 */
const showsUnderPackageName = (text: string, wanted: string): boolean => {
  const [program = "", ...rest] = wanted.split(" ");
  if (rest.length === 0) return false;
  const pattern = `(?<![A-Za-z0-9_.-])${escapeRegExp(program)}[A-Za-z0-9_.-]* ${rest.map(escapeRegExp).join(" ")}(?![A-Za-z0-9_-])`;
  return new RegExp(pattern, "u").test(text);
};

/** Whether the code holds the command as a whole word: --force is not --force-with-lease, init is not initial. */
export const showsCommand = (code: string, command: string): boolean => {
  const text = collapse(code);
  const wanted = collapse(command.trim());
  if (showsUnderPackageName(text, wanted)) return true;
  const state = { at: text.indexOf(wanted) };
  while (state.at !== -1) {
    const before = text.charAt(state.at - 1);
    const after = text.charAt(state.at + wanted.length);
    if (!OPTION_CHAR.test(before) && !OPTION_CHAR.test(after)) return true;
    state.at = text.indexOf(wanted, state.at + 1);
  }
  return false;
};

type Section = { readonly heading: string; readonly start: number; readonly body: Span };

const sectionsOf = (doc: ProseDocument): Section[] => {
  const headings = doc.markup?.headings ?? [];
  return headings.map((heading, index) => {
    const next = headings.slice(index + 1).find((later) => later.depth <= heading.depth);
    return { heading: doc.source.slice(heading.start, heading.end), start: heading.start, body: { start: heading.end, end: next?.start ?? doc.source.length } };
  });
};

/** The code a section shows: its fenced blocks and its inline code spans. Empty when it shows none. */
const codeOf = (doc: ProseDocument, fences: readonly CodeFence[], body: Span): string => {
  const inFences = fences.filter((fence) => fence.start >= body.start && fence.start < body.end);
  const outside = inFences.reduceRight(
    (text, fence) => `${text.slice(0, fence.start - body.start)}${text.slice(Math.min(fence.end, body.end) - body.start)}`,
    doc.source.slice(body.start, body.end),
  );
  return [...inFences.flatMap((fence) => fence.lines), ...codeSpans(outside).map((span) => span.text)].join("\n");
};

export const headingCommand: Detector = (doc): Finding[] => {
  const fences = codeFences(doc.source);
  return sectionsOf(doc).flatMap((section) => {
    const commands = commandsIn(section.heading);
    if (commands.length === 0) return [];
    const code = codeOf(doc, fences, section.body);
    if (code.trim() === "") return [];
    return commands.filter((command) => !showsCommand(code, command)).map((command) => finding(doc, "heading-command-missing", section.start, { command }));
  });
};

const ORDERED_ITEM = /^\s*\d{1,3}[.)]\s/u;
/** What opens a statement: an article or a pronoun (The installer asks, You click, It opens). */
const SUBJECT_OPENER = new Set(["DET", "PRON"]);
/** What a subject opens with when it is a name or a noun phrase (Docker builds, Each user gets). */
const SUBJECT_HEAD = new Set(["DET", "PRON", "PROPN", "NOUN", "ADJ"]);
/** What may stand between the opener and the verb: the rest of the subject. */
const SUBJECT_PART = new Set(["DET", "PRON", "PROPN", "NOUN", "ADJ", "ADP"]);
/** What opens an instruction. The tagger reads a sentence-initial imperative as a noun, an adjective or a name (Click, Open, Restart). */
const INSTRUCTION_OPENER = new Set(["VERB", "NOUN", "ADJ", "PROPN"]);
const PREDICATE = new Set(["VERB", "AUX"]);
const SKIPPED = new Set(["PUNCT", "NUM", "SYM", "X", "SPACE"]);
/** Steps shorter than this are labels (1. Setup), not instructions or statements. */
const MIN_STEP_TOKENS = 3;
/** A list needs this many steps to have a form to keep. */
const MIN_STEPS = 3;

/** A verb in a finite, inflected form (starts, built): it has a subject before it. A base form (Save) may be an imperative's object. */
const isInflected = (token: Token): boolean =>
  token.lemma !== undefined && token.lemma !== "" && token.surface.toLowerCase() !== token.lemma && token.features?.["VerbForm"] !== "Part";

const NOMINAL = new Set(["NOUN", "PROPN"]);
/** What an adjective at the head of a subject goes on to: the noun it describes, or another word describing it. */
const DESCRIBED = new Set(["NOUN", "PROPN", "ADJ"]);

/**
 * An adjective opening a subject is followed by what it describes (Each user, Large files). One followed by a preposition
 * or an article is an imperative the tagger read as an adjective (Bake in the oven, Open the file).
 */
export const opensWithMisreadImperative = (tokens: readonly Token[]): boolean => {
  const [head, next] = tokens.filter((token) => !SKIPPED.has(token.pos));
  return head?.pos === "ADJ" && !DESCRIBED.has(next?.pos ?? "");
};

/** A determiner right after a noun opens a clause inside the phrase (a buffer that is big): the verb after it is the clause's, not a subject's. */
const opensClause = (words: readonly Token[]): boolean => words.some((token, at) => at > 0 && token.pos === "DET" && NOMINAL.has(words[at - 1]?.pos ?? ""));

/**
 * A step written as a statement: a subject, then its verb. The subject opens with an article or a pronoun (The installer
 * asks, You click), or it is a name or a noun whose verb is inflected (Docker builds). A noun before a base-form verb is
 * not enough: the tagger reads Click and Press there as nouns (Click Save).
 */
export const isStatement = (tokens: readonly Token[]): boolean => {
  const words = tokens.filter((token) => !SKIPPED.has(token.pos));
  const [head, ...rest] = words;
  if (head === undefined || words.length < MIN_STEP_TOKENS || !SUBJECT_HEAD.has(head.pos)) return false;
  if (opensWithMisreadImperative(words)) return false;
  const verbAt = rest.findIndex((token) => PREDICATE.has(token.pos));
  const verb = rest[verbAt];
  const subject = [head, ...rest.slice(0, verbAt)];
  if (verb === undefined || !rest.slice(0, verbAt).every((token) => SUBJECT_PART.has(token.pos)) || opensClause(subject)) return false;
  // Punctuation before the verb is no subject: a label (Guests: the users who …) or an opening phrase (On the left bar, select …).
  const interrupted = tokens.some((token) => token.pos === "PUNCT" && token.span.start > head.span.start && token.span.start < verb.span.start);
  return !interrupted && (SUBJECT_OPENER.has(head.pos) || isInflected(verb));
};

type Step = { readonly start: number; readonly kind: "statement" | "instruction" | "other" };

/** A step that opens with its verb: an instruction (Run the installer). An item that names a case (Faults caused by a drop) is not one. */
export const isInstruction = (tokens: readonly Token[]): boolean =>
  INSTRUCTION_OPENER.has(tokens.find((token) => !SKIPPED.has(token.pos))?.pos ?? "") && !opensAsNounPhrase(tokens);

const kindOf = (tokens: readonly Token[]): Step["kind"] => {
  if (isStatement(tokens)) return "statement";
  return isInstruction(tokens) ? "instruction" : "other";
};

/** The steps of each numbered list: each item's first sentence, read as a statement or not. */
const stepLists = (doc: ProseDocument): Step[][] =>
  doc.lists
    .filter((list) => ORDERED_ITEM.test(doc.source.slice(list.span.start, list.span.end)))
    .map((list) =>
      list.itemSpans.flatMap((item): Step[] => {
        const sentence = doc.sentences.find((candidate) => candidate.span.start >= item.start && candidate.span.start < item.end);
        // Only the sentence on the item's own line: a note paragraph under it (**NOTE:** …) is not the step.
        const onItemLine = sentence !== undefined && !doc.source.slice(item.start, sentence.span.start).includes("\n");
        return sentence?.tokens === undefined || !onItemLine ? [] : [{ start: sentence.span.start, kind: kindOf(sentence.tokens) }];
      }),
    )
    .filter((steps) => steps.length >= MIN_STEPS);

export const stepStatement: Detector = (doc, options): Finding[] =>
  stepLists(doc).flatMap((steps) => {
    const statements = steps.filter((step) => step.kind === "statement");
    const instructions = steps.filter((step) => step.kind === "instruction");
    // A procedure is a list most of whose steps are instructions; a numbered list of terms and definitions is not one.
    const isProcedure = instructions.length * 2 > steps.length;
    return isProcedure && statements.length > 0 && statements.length < instructions.length && statements.length <= options.limit
      ? statements.map((step) => finding(doc, "step-statement-mix", step.start, { count: instructions.length }))
      : [];
  });
