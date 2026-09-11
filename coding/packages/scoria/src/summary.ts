import type { Finding } from "./plugin.ts";
import type { DimensionReport, Report } from "./report.ts";
import { messagesFor, type Lang, type Messages } from "./messages.ts";

/**
 * The report as GitHub-flavoured Markdown, for `$GITHUB_STEP_SUMMARY`.
 *
 * A CI log is a wall of text nobody scrolls. The step summary renders on the run page and in the
 * pull request's checks tab, so the table is the first thing a reviewer sees. It needs no token
 * and no `permissions:` block — the runner writes to a file.
 */

const BAR_CELLS = 10;
const MAX_FINDINGS = 20;
const FULL = "█";
const EMPTY = "░";

const bar = (score: number): string => {
  const filled = Math.max(0, Math.min(BAR_CELLS, Math.round((score / 100) * BAR_CELLS)));
  return FULL.repeat(filled) + EMPTY.repeat(BAR_CELLS - filled);
};

/** A dimension measured through suppressions is flagged, because the number is about the measurement. */
const confidenceCell = (dimension: DimensionReport): string =>
  dimension.confidence === "high" ? "high" : `**${dimension.confidence}** — ${dimension.confidenceReason}`;

const dimensionRow = (dimension: DimensionReport): string => {
  const score = dimension.score;
  const cells = score === undefined ? ["—", "—"] : [score.toFixed(0), `\`${bar(score)}\``];
  return `| ${dimension.dimension} | ${cells[0]} | ${cells[1]} | ${confidenceCell(dimension)} |`;
};

const findingRow = (finding: Finding, messages: Messages): string =>
  `| \`${finding.file}:${finding.line}\` | ${finding.rule} | ${messages.ruleMessages[finding.rule] ?? finding.message} |`;

const findingsBlock = (report: Report, messages: Messages): readonly string[] => {
  const errors = report.findings.filter((finding) => finding.severity === "error");
  if (errors.length === 0) return [];
  const rest = errors.length > MAX_FINDINGS ? ["", `_${messages.more(errors.length - MAX_FINDINGS)}_`] : [];
  return [
    "",
    `<details><summary>${messages.findingsAtError(errors.length)}</summary>`,
    "",
    "| file | rule | |",
    "| --- | --- | --- |",
    ...errors.slice(0, MAX_FINDINGS).map((finding) => findingRow(finding, messages)),
    ...rest,
    "",
    "</details>",
  ];
};

const warningsBlock = (report: Report, messages: Messages): readonly string[] => {
  const warnings = report.findings.filter((finding) => finding.severity === "warning");
  if (warnings.length === 0) return [];
  const byRule = new Map<string, number>();
  warnings.forEach((finding) => byRule.set(finding.rule, (byRule.get(finding.rule) ?? 0) + 1));
  return [
    "",
    `<details><summary>${messages.warnings(warnings.length)}</summary>`,
    "",
    "| rule | count |",
    "| --- | ---: |",
    ...[...byRule.entries()].sort((a, b) => b[1] - a[1]).map(([rule, count]) => `| ${rule} | ${count} |`),
    "",
    "</details>",
  ];
};

const skippedBlock = (report: Report, messages: Messages): readonly string[] => {
  const notRun = report.probes.filter((probe) => probe.status.kind !== "ok");
  if (notRun.length === 0) return [];
  return [
    "",
    `<details><summary>${messages.probesNotScored}</summary>`,
    "",
    "| probe | | |",
    "| --- | --- | --- |",
    ...notRun.map((probe) => `| ${probe.probe} | ${probe.status.kind} | ${"reason" in probe.status ? probe.status.reason : ""} |`),
    "",
    "</details>",
  ];
};

export const renderGithubSummary = (report: Report, lang: Lang): string => {
  const messages = messagesFor(lang);
  return [
    `## scoria — ${report.overall.score.toFixed(0)} / 100`,
    "",
    `\`${report.stacks.join(" · ")}\` · ${messages.profileLabel}: ${report.profile} · ` +
      `${messages.filesLine(report.size.files, report.size.sloc, report.size.testSloc)}`,
    "",
    `| ${messages.dimension} | ${messages.score} | | ${messages.confidence} |`,
    "| --- | ---: | --- | --- |",
    ...report.dimensions.map(dimensionRow),
    ...findingsBlock(report, messages),
    ...warningsBlock(report, messages),
    ...skippedBlock(report, messages),
    "",
    `> ${messages.notComparableLong}`,
    "",
  ].join("\n");
};
