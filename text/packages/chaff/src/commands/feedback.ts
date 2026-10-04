import { readDocumentFile } from "../files.ts";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import type { Finding, RuleDefinition } from "../plugin.ts";
import type { Config } from "../config/load.ts";
import { messageOf } from "../render/text.ts";
import type { Texts, UiLanguage } from "../ui.ts";
import { excerptsAround } from "../feedback/excerpt.ts";
import { feedbackDraft, type FeedbackDraft, type FeedbackKind, type ReportedFinding } from "../feedback/draft.ts";
import { notRunAmong } from "../not-run.ts";
import type { Skipped } from "../run.ts";
import type { GenreSource } from "../cli-text.ts";

export const FEEDBACK_FILE = ".chaff-feedback.md";
const NEW_ISSUE = "https://github.com/isamu/lab/issues/new";
/** GitHub cuts long titles, and a title can carry document text through a rule's message. */
export const MAX_TITLE_LENGTH = 120;

export type Checked = {
  readonly findings: readonly Finding[];
  readonly rules: readonly RuleDefinition[];
  readonly language: string;
  readonly genre: string;
  /** Where the genre came from: set (--genre, chaff.yaml, by_path, front matter), guessed or defaulted. */
  readonly genreFrom: GenreSource;
  /** The rules this check did not run, and why. */
  readonly skipped: readonly Skipped[];
  /** How the check was run, as the reader of a report would repeat it (runConditions). */
  readonly conditions: readonly string[];
};

export type FeedbackContext = {
  readonly cwd: string;
  readonly ui: UiLanguage;
  readonly version: string;
  readonly runtime: string;
  readonly flag: (argv: readonly string[], name: string) => string | undefined;
  readonly check: (path: string) => Promise<Checked>;
  /** The reported rules' own settings in chaff.yaml (one line each), or undefined when none are set. */
  readonly settingsOf: (ruleIds: readonly string[]) => string | undefined;
};

const TEXT: Texts<{
  readonly usage: string;
  readonly notFound: (path: string) => string;
  readonly badLine: (lines: number) => string;
  readonly noMatch: (list: string) => string;
  readonly notRun: (rule: string, why: string) => string;
  readonly runExperimental: string;
  readonly several: (list: string) => string;
  readonly none: string;
  readonly written: (file: string, lines: string) => string;
  readonly send: string;
  readonly link: (file: string) => string;
  readonly neverSent: string;
}> = {
  ja: {
    usage: [
      "使い方: chaff feedback <file> --rule <rule-id> [--line N] [--with-config]   誤った指摘を報告する",
      "        chaff feedback <file> --missed --line N [--with-config]           見逃しを報告する",
    ].join("\n"),
    notFound: (path) => `${path} がありません。`,
    badLine: (lines) => `--line には 1〜${String(lines)} の行番号を書いてください。`,
    noMatch: (list) => `その指摘が見つかりません。この文書の指摘:\n${list}`,
    notRun: (rule, why) => `${rule} は今回動いていません（${why}）。`,
    runExperimental: "試験中の rule です。--experimental を付けてかけ直してください。",
    several: (list) => `その rule の指摘がいくつもあります。--line で一つ選んでください:\n${list}`,
    none: "  （指摘はありません）",
    written: (file, lines) => `報告の下書きを ${file} に書きました。文書から載せたのは ${lines} だけです。送る前に読んで、要らない所は消してください。`,
    send: "送るには（どちらか）:",
    link: (file) => `ブラウザで（開いたページに ${file} の中身を貼ります）:`,
    neverSent: "chaff は何も送っていません。",
  },
  en: {
    usage: [
      "usage: chaff feedback <file> --rule <rule-id> [--line N] [--with-config]   report a wrong finding",
      "       chaff feedback <file> --missed --line N [--with-config]           report something chaff missed",
    ].join("\n"),
    notFound: (path) => `${path} does not exist.`,
    badLine: (lines) => `--line must be a line number from 1 to ${String(lines)}.`,
    noMatch: (list) => `No such finding. The findings in this document:\n${list}`,
    notRun: (rule, why) => `${rule} did not run in this check (${why}).`,
    runExperimental: "It is experimental: run again with --experimental.",
    several: (list) => `That rule has several findings here. Pick one with --line:\n${list}`,
    none: "  (no findings)",
    written: (file, lines) =>
      `Wrote a draft report to ${file}. From the document it includes only ${lines}. Read it before sending, and delete anything you do not want to share.`,
    send: "To send it (either):",
    link: (file) => `In a browser (paste the contents of ${file} into the page):`,
    neverSent: "chaff has not sent anything.",
  },
};

const lineList = (lines: readonly number[], ui: UiLanguage): string =>
  ui === "ja" ? `${lines.join("、")} 行目の前後` : `the lines around ${lines.join(", ")}`;

/** The findings the person picked: by rule, by line, or both. */
const chosen = (findings: readonly Finding[], rule: string | undefined, line: number | undefined): Finding[] =>
  findings.filter((finding) => (rule === undefined || finding.rule === rule) && (line === undefined || finding.line === line));

const describe = (findings: readonly Finding[], none: string): string =>
  findings.length === 0 ? none : findings.map((finding) => `  ${String(finding.line)}  ${finding.rule}`).join("\n");

/**
 * Pure: the reported rules' own lines of chaff.yaml's rules (a numeric limit wins over a level), under the style chaff.yaml
 * names, or undefined when none is set. A level the style decided is the style's, so only the style line reproduces it.
 */
export const settingsOf = (config: Pick<Config, "rules" | "limits" | "applied">, ruleIds: readonly string[]): string | undefined => {
  const fromStyle = new Set(config.applied?.levelsFrom ?? []);
  const lines = [...new Set(ruleIds)].flatMap((id) => {
    const limit = config.limits[id];
    const level = config.rules[id];
    if (limit !== undefined) return [`  ${id}: ${String(limit)}`];
    return level === undefined || fromStyle.has(id) ? [] : [`  ${id}: ${level}`];
  });
  const style = config.applied === undefined ? [] : [`style: ${config.applied.style}`];
  const rules = lines.length === 0 ? [] : ["rules:", ...lines];
  return style.length + rules.length === 0 ? undefined : [...style, ...rules].join("\n");
};

/** Pure: a title on one line, no longer than GitHub shows. */
export const titleLine = (title: string): string => {
  const flat = title.replace(/\s+/gu, " ").trim();
  return flat.length <= MAX_TITLE_LENGTH ? flat : `${flat.slice(0, MAX_TITLE_LENGTH - 1)}…`;
};

/** Pure: a string a POSIX shell reads literally — single quotes, with any single quote closed, escaped and reopened. */
export const shellQuoted = (text: string): string => `'${text.replaceAll("'", "'\\''")}'`;

type Request = {
  readonly path: string;
  readonly kind: FeedbackKind;
  readonly rule: string | undefined;
  readonly line: number | undefined;
  readonly withConfig: boolean;
};

/** What the person asked to report. A wrong finding is picked by rule or line; a miss needs the line. */
const requestOf = (targets: readonly string[], argv: readonly string[], context: FeedbackContext): Request | undefined => {
  const [path] = targets;
  const kind: FeedbackKind = argv.includes("--missed") ? "missed" : "false-positive";
  const rule = context.flag(argv, "--rule");
  const lineFlag = context.flag(argv, "--line");
  const line = lineFlag === undefined ? undefined : Number(lineFlag);
  const lineMissing = kind === "missed" ? line === undefined : rule === undefined && line === undefined;
  if (path === undefined || targets.length !== 1 || lineMissing || (line !== undefined && !Number.isInteger(line))) return undefined;
  return { path, kind, rule, line, withConfig: argv.includes("--with-config") };
};

const reported = (findings: readonly Finding[], checked: Checked): ReportedFinding[] => {
  const byId = new Map(checked.rules.map((definition) => [definition.id, definition]));
  return findings.flatMap((finding) => {
    const definition = byId.get(finding.rule);
    return definition === undefined ? [] : [{ rule: finding.rule, line: finding.line, message: messageOf(definition, finding, checked.language) }];
  });
};

/** The link carries the title only: the body holds document lines, and a URL ends up in history and logs. */
const sendInstructions = (title: string, lines: readonly number[], ui: UiLanguage): string => {
  const text = TEXT[ui];
  return [
    "",
    `  ${text.written(FEEDBACK_FILE, lineList([...new Set(lines)], ui))}`,
    "",
    `  ${text.send}`,
    `    gh issue create -R isamu/lab --title ${shellQuoted(title)} --body-file ${FEEDBACK_FILE}`,
    `  ${text.link(FEEDBACK_FILE)}`,
    `    ${NEW_ISSUE}?title=${encodeURIComponent(title)}`,
    "",
    `  ${text.neverSent}`,
    "",
  ].join("\n");
};

/**
 * Pure: how a check was run, in the words a reader would type to run it again: the flags that change what is found.
 * Experimental rules switched on in chaff.yaml count too, said as chaff.yaml says it.
 */
export const runConditions = (argv: readonly string[], genreFlag: string | undefined, experimentalInConfig: boolean): string[] => {
  const experimental = argv.includes("--experimental") ? ["--experimental"] : [];
  const fromConfig = experimental.length === 0 && experimentalInConfig ? ["experimental: true (chaff.yaml)"] : [];
  return [...experimental, ...fromConfig, ...(genreFlag === undefined ? [] : [`--genre ${genreFlag}`])];
};

/** No finding matched: say so with the findings there are, and first why the asked-for rule did not run, if it did not. */
const noMatch = (request: Request, checked: Checked, ui: UiLanguage): string => {
  const text = TEXT[ui];
  const list = text.noMatch(describe(checked.findings, text.none));
  const [notRun] = request.rule === undefined ? [] : notRunAmong([request.rule], checked.skipped);
  if (notRun === undefined) return list;
  return [text.notRun(notRun.rule, notRun.why), ...(notRun.needsExperimental ? [text.runExperimental] : []), list].join("\n");
};

/** Why the request cannot be drafted, or the findings to report. */
const pick = (request: Request, checked: Checked, lineCount: number, ui: UiLanguage): { readonly error: string } | { readonly findings: Finding[] } => {
  const text = TEXT[ui];
  if (request.line !== undefined && (request.line < 1 || request.line > lineCount)) return { error: text.badLine(lineCount) };
  const picked = chosen(checked.findings, request.rule, request.line);
  if (request.kind === "missed") return { findings: picked };
  if (picked.length === 0) return { error: noMatch(request, checked, ui) };
  // One finding per report: a rule picked alone could otherwise pull excerpts from all over the document.
  if (picked.length > 1) return { error: text.several(describe(picked, text.none)) };
  return { findings: picked };
};

/**
 * `chaff feedback`: an issue draft from a run on the person's own document. It writes a file and prints how to
 * send it; it never sends anything itself. Only the lines around the reported spot are copied from the document,
 * and from chaff.yaml only the reported rules' settings unless --with-config is given.
 */
export const runFeedback = async (targets: readonly string[], argv: readonly string[], context: FeedbackContext): Promise<number> => {
  const text = TEXT[context.ui];
  const request = requestOf(targets, argv, context);
  if (request === undefined) {
    console.error(text.usage);
    return 1;
  }
  if (!existsSync(request.path)) {
    console.error(text.notFound(request.path));
    return 1;
  }
  const source = await readDocumentFile(request.path);
  const checked = await context.check(request.path);
  const picked = pick(request, checked, source.split("\n").length, context.ui);
  if ("error" in picked) {
    console.error(picked.error);
    return 1;
  }
  const findings = reported(picked.findings, checked);
  const lines = request.kind === "missed" && request.line !== undefined ? [request.line] : findings.map((finding) => finding.line);
  const configPath = join(context.cwd, "chaff.yaml");
  const wholeConfig = request.withConfig && existsSync(configPath) ? readFileSync(configPath, "utf8") : undefined;
  const draft: FeedbackDraft = feedbackDraft(
    {
      kind: request.kind,
      version: context.version,
      runtime: context.runtime,
      fileName: basename(request.path),
      language: checked.language,
      genre: checked.genre,
      conditions: checked.conditions,
      findings,
      line: lines[0] ?? 0,
      excerpts: excerptsAround(source, lines),
      config: wholeConfig ?? context.settingsOf(findings.map((finding) => finding.rule)),
    },
    context.ui,
  );
  writeFileSync(join(context.cwd, FEEDBACK_FILE), draft.body, "utf8");
  console.log(sendInstructions(titleLine(draft.title), lines, context.ui));
  return 0;
};
