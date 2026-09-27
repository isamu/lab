import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import type { Finding, RuleDefinition } from "../plugin.ts";
import { messageOf } from "../render/text.ts";
import type { Texts, UiLanguage } from "../ui.ts";
import { excerptsAround } from "../feedback/excerpt.ts";
import { feedbackDraft, type FeedbackDraft, type FeedbackKind, type ReportedFinding } from "../feedback/draft.ts";

export const FEEDBACK_FILE = ".chaff-feedback.md";
const NEW_ISSUE = "https://github.com/isamu/lab/issues/new";
/** Browsers and GitHub refuse very long URLs; past this the link carries the title only. */
const MAX_URL_LENGTH = 7000;

export type Checked = {
  readonly findings: readonly Finding[];
  readonly rules: readonly RuleDefinition[];
  readonly language: string;
  readonly genre: string;
};

export type FeedbackContext = {
  readonly cwd: string;
  readonly ui: UiLanguage;
  readonly version: string;
  readonly runtime: string;
  readonly flag: (argv: readonly string[], name: string) => string | undefined;
  readonly check: (path: string) => Promise<Checked>;
};

const TEXT: Texts<{
  readonly usage: string;
  readonly notFound: (path: string) => string;
  readonly noMatch: (list: string) => string;
  readonly none: string;
  readonly written: (file: string, lines: string) => string;
  readonly send: string;
  readonly link: string;
  readonly tooLong: (file: string) => string;
  readonly neverSent: string;
}> = {
  ja: {
    usage:
      "使い方: chaff feedback <file> --rule <rule-id> [--line N]   誤った指摘を報告する\n        chaff feedback <file> --missed --line N           見逃しを報告する",
    notFound: (path) => `${path} がありません。`,
    noMatch: (list) => `その指摘が見つかりません。この文書の指摘:\n${list}`,
    none: "  （指摘はありません）",
    written: (file, lines) => `報告の下書きを ${file} に書きました。文書から載せたのは ${lines} だけです。送る前に読んで、要らない所は消してください。`,
    send: "送るには（どちらか）:",
    link: "ブラウザで:",
    tooLong: (file) => `（長いので、開いたページに ${file} の中身を貼ってください）`,
    neverSent: "chaff は何も送っていません。",
  },
  en: {
    usage:
      "usage: chaff feedback <file> --rule <rule-id> [--line N]   report a wrong finding\n       chaff feedback <file> --missed --line N           report something chaff missed",
    notFound: (path) => `${path} does not exist.`,
    noMatch: (list) => `No such finding. The findings in this document:\n${list}`,
    none: "  (no findings)",
    written: (file, lines) =>
      `Wrote a draft report to ${file}. From the document it includes only ${lines}. Read it before sending, and delete anything you do not want to share.`,
    send: "To send it (either):",
    link: "In a browser:",
    tooLong: (file) => `(too long for a link: paste the contents of ${file} into the page)`,
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

type Request = { readonly path: string; readonly kind: FeedbackKind; readonly rule: string | undefined; readonly line: number | undefined };

/** What the person asked to report. A wrong finding is picked by rule or line; a miss needs the line. */
const requestOf = (targets: readonly string[], argv: readonly string[], context: FeedbackContext): Request | undefined => {
  const [path] = targets;
  const kind: FeedbackKind = argv.includes("--missed") ? "missed" : "false-positive";
  const rule = context.flag(argv, "--rule");
  const lineFlag = context.flag(argv, "--line");
  const line = lineFlag === undefined ? undefined : Number(lineFlag);
  const lineMissing = kind === "missed" ? line === undefined : rule === undefined && line === undefined;
  if (path === undefined || targets.length !== 1 || lineMissing || (line !== undefined && !Number.isInteger(line))) return undefined;
  return { path, kind, rule, line };
};

const reported = (findings: readonly Finding[], checked: Checked): ReportedFinding[] => {
  const byId = new Map(checked.rules.map((definition) => [definition.id, definition]));
  return findings.flatMap((finding) => {
    const definition = byId.get(finding.rule);
    return definition === undefined ? [] : [{ rule: finding.rule, line: finding.line, message: messageOf(definition, finding, checked.language) }];
  });
};

const sendInstructions = (draft: FeedbackDraft, lines: readonly number[], ui: UiLanguage): string => {
  const text = TEXT[ui];
  const url = `${NEW_ISSUE}?title=${encodeURIComponent(draft.title)}&body=${encodeURIComponent(draft.body)}`;
  const link = url.length <= MAX_URL_LENGTH ? url : `${NEW_ISSUE}?title=${encodeURIComponent(draft.title)}`;
  return [
    "",
    `  ${text.written(FEEDBACK_FILE, lineList([...new Set(lines)], ui))}`,
    "",
    `  ${text.send}`,
    `    gh issue create -R isamu/lab --title ${JSON.stringify(draft.title)} --body-file ${FEEDBACK_FILE}`,
    `  ${text.link}`,
    `    ${link}`,
    ...(link === url ? [] : [`    ${text.tooLong(FEEDBACK_FILE)}`]),
    "",
    `  ${text.neverSent}`,
    "",
  ].join("\n");
};

/**
 * `chaff feedback`: an issue draft from a run on the person's own document. It writes a file and prints how to
 * send it; it never sends anything itself. Only the lines around the reported spot are copied from the document.
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
  const checked = await context.check(request.path);
  const picked = chosen(checked.findings, request.rule, request.line);
  if (request.kind === "false-positive" && picked.length === 0) {
    console.error(text.noMatch(describe(checked.findings, text.none)));
    return 1;
  }
  const findings = reported(picked, checked);
  const lines = request.kind === "missed" && request.line !== undefined ? [request.line] : findings.map((finding) => finding.line);
  const configPath = join(context.cwd, "chaff.yaml");
  const draft = feedbackDraft(
    {
      kind: request.kind,
      version: context.version,
      runtime: context.runtime,
      fileName: basename(request.path),
      language: checked.language,
      genre: checked.genre,
      findings,
      excerpts: excerptsAround(readFileSync(request.path, "utf8"), lines),
      config: existsSync(configPath) ? readFileSync(configPath, "utf8") : undefined,
    },
    context.ui,
  );
  writeFileSync(join(context.cwd, FEEDBACK_FILE), draft.body, "utf8");
  console.log(sendInstructions(draft, lines, context.ui));
  return 0;
};
