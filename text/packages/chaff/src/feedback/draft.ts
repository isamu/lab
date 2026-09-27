import type { Texts, UiLanguage } from "../ui.ts";
import type { Excerpt } from "./excerpt.ts";

export type FeedbackKind = "false-positive" | "missed";

export type ReportedFinding = { readonly rule: string; readonly line: number; readonly message: string };

export type FeedbackInput = {
  readonly kind: FeedbackKind;
  readonly version: string;
  readonly runtime: string;
  readonly fileName: string;
  readonly language: string;
  readonly genre: string;
  readonly findings: readonly ReportedFinding[];
  /** The line the person reported: the finding's line, or for a miss the line they named. */
  readonly line: number;
  readonly excerpts: readonly Excerpt[];
  readonly config: string | undefined;
};

export type FeedbackDraft = { readonly title: string; readonly body: string };

const TEXT: Texts<{
  readonly titleFalse: (rule: string, message: string) => string;
  readonly titleMissed: (fileName: string, line: number) => string;
  readonly what: Readonly<Record<FeedbackKind, string>>;
  readonly environment: string;
  readonly findings: string;
  readonly excerpt: string;
  readonly config: string;
  readonly expected: string;
  readonly expectedHint: Readonly<Record<FeedbackKind, string>>;
  readonly lines: (from: number, to: number) => string;
}> = {
  ja: {
    titleFalse: (rule, message) => `誤検出: ${rule} — ${message}`,
    titleMissed: (fileName, line) => `見逃し: ${fileName} の ${String(line)} 行目`,
    what: { "false-positive": "この指摘は誤りだと思います。", missed: "ここで chaff は何か言うべきだと思います。" },
    environment: "環境",
    findings: "指摘",
    excerpt: "文書の該当箇所（この部分だけを載せています）",
    config: "chaff.yaml",
    expected: "期待すること",
    expectedHint: {
      "false-positive": "<!-- なぜ誤りか、本来どう読むべきかを書いてください -->",
      missed: "<!-- 何が問題で、どの rule が言うべきだったかを書いてください -->",
    },
    lines: (from, to) => `${String(from)}〜${String(to)} 行目`,
  },
  en: {
    titleFalse: (rule, message) => `False positive: ${rule} — ${message}`,
    titleMissed: (fileName, line) => `Missed: ${fileName} line ${String(line)}`,
    what: { "false-positive": "I think this finding is wrong.", missed: "I think chaff should say something here." },
    environment: "Environment",
    findings: "Findings",
    excerpt: "The part of the document (only these lines are included)",
    config: "chaff.yaml",
    expected: "What I expected",
    expectedHint: {
      "false-positive": "<!-- Why it is wrong, and how the text should be read -->",
      missed: "<!-- What is wrong in the text, and which rule should have said so -->",
    },
    lines: (from, to) => `lines ${String(from)}-${String(to)}`,
  },
};

const fence = (content: string, language = ""): string => {
  const longest = Math.max(2, ...[...content.matchAll(/`+/gu)].map((match) => match[0].length));
  const ticks = "`".repeat(longest + 1);
  return [`${ticks}${language}`, content, ticks].join("\n");
};

/** Pure: the issue title and body for a report. Nothing here reads files or the network. */
export const feedbackDraft = (input: FeedbackInput, ui: UiLanguage): FeedbackDraft => {
  const text = TEXT[ui];
  const first = input.findings[0];
  const title =
    input.kind === "false-positive" && first !== undefined ? text.titleFalse(first.rule, first.message) : text.titleMissed(input.fileName, input.line);
  const body = [
    text.what[input.kind],
    "",
    `## ${text.environment}`,
    "",
    `- chaffjs ${input.version}`,
    `- ${input.runtime}`,
    `- ${input.fileName} · ${input.language} · ${input.genre}`,
    ...(input.findings.length === 0
      ? []
      : ["", `## ${text.findings}`, "", ...input.findings.map((finding) => `- \`${finding.rule}\` (${String(finding.line)}): ${finding.message}`)]),
    "",
    `## ${text.excerpt}`,
    ...input.excerpts.flatMap((excerpt) => ["", text.lines(excerpt.from, excerpt.to), "", fence(excerpt.lines.join("\n"))]),
    ...(input.config === undefined ? [] : ["", `## ${text.config}`, "", fence(input.config.trimEnd(), "yaml")]),
    "",
    `## ${text.expected}`,
    "",
    text.expectedHint[input.kind],
    "",
  ].join("\n");
  return { title, body };
};
