import { relative } from "node:path";

import { assay } from "./run.ts";
import { detectConfig, writeConfig, CONFIG_FILENAME, type LoadedConfig, type Mode, type ScoriaConfig } from "./config.ts";
import { isLang, messagesFor, type Lang } from "./messages.ts";
import type { Report } from "./report.ts";
import { renderExplain, renderReport } from "./render.ts";
import { renderGithubSummary } from "./summary.ts";
import { renderSarif } from "./sarif.ts";
import { badgeEndpoint } from "./badge.ts";
import { SCORIA_VERSION } from "./version.ts";
import { appendFile, mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { applyFixes, diagnose, renderDoctor } from "./doctor.ts";
import { changedTools, readBaseline, writeBaseline } from "./baseline.ts";
import { diffReports, type ReportDiff } from "./diff.ts";
import { judge, type Verdict } from "./gate.ts";

type Command = "assay" | "init" | "doctor" | "baseline";

const COMMANDS = new Set<string>(["init", "doctor", "baseline"]);

const isCommand = (value: string | undefined): value is Command => value !== undefined && COMMANDS.has(value);

interface Options {
  readonly command: Command;
  readonly target: string;
  readonly json: boolean;
  readonly explain: string | undefined;
  readonly write: boolean;
  readonly fix: boolean;
  readonly summary: boolean;
  readonly sarif: string | undefined;
  readonly badge: string | undefined;
  readonly lang: Lang | undefined;
}

const valueAfter = (argv: readonly string[], flag: string): string | undefined => {
  const at = argv.indexOf(flag);
  return at < 0 ? undefined : argv[at + 1];
};

const parse = (argv: readonly string[]): Options => {
  const explain = valueAfter(argv, "--explain");
  const lang = valueAfter(argv, "--lang");
  const sarif = valueAfter(argv, "--sarif");
  const badge = valueAfter(argv, "--badge-json");
  const consumed = new Set([explain, lang, sarif, badge]);
  const positional = argv.filter((arg) => !arg.startsWith("--") && !consumed.has(arg));
  const first = positional[0];
  const command = isCommand(first) ? first : "assay";
  const target = (command === "assay" ? positional[0] : positional[1]) ?? ".";
  return {
    command,
    target,
    json: argv.includes("--json"),
    explain,
    write: !argv.includes("--no-write"),
    fix: argv.includes("--fix"),
    summary: !argv.includes("--no-summary"),
    sarif,
    badge,
    lang: isLang(lang) ? lang : undefined,
  };
};

const describe = (config: ScoriaConfig): string => `profile: ${config.profile} · stacks: ${config.stacks.join(", ")}`;

/** An absolute path reads better than a chain of `..` when the target is outside the cwd. */
const displayPath = (path: string): string => {
  const fromHere = relative(process.cwd(), path);
  return fromHere === "" || fromHere.startsWith("..") ? path : fromHere;
};

const runInit = async (target: string, lang: Lang): Promise<void> => {
  const messages = messagesFor(lang);
  const detected = await detectConfig(target);
  const config: ScoriaConfig = { ...detected, lang };
  const path = await writeConfig(target, config);
  const lines = ["", messages.wroteConfig(displayPath(path)), `  ${describe(config)}`, "", ...messages.frozenNote, ""];
  process.stdout.write(`${lines.join("\n")}\n`);
};

/**
 * Measuring without a config means one added dependency can move the score (spec §9.2).
 * The first run writes the detection out and freezes it. Nothing is written under CI.
 */
const freezeIfNeeded = async (target: string, frozen: boolean, write: boolean, lang: Lang): Promise<string | undefined> => {
  const messages = messagesFor(lang);
  if (frozen) return undefined;
  if (!write || process.env["CI"] === "true") return messages.notFrozen;
  const detected = await detectConfig(target);
  await writeConfig(target, { ...detected, lang });
  return messages.createdConfig(CONFIG_FILENAME, describe(detected));
};

/**
 * A CI log is a wall of text nobody scrolls. GitHub renders the step summary on the run page, so
 * the table lands where a reviewer already is. Writing the file is all it takes — no token, no
 * `permissions:` block.
 */
const writeGithubSummary = async (report: Report, lang: Lang, enabled: boolean, diff?: ReportDiff): Promise<void> => {
  const path = process.env["GITHUB_STEP_SUMMARY"];
  if (!enabled || path === undefined || path === "") return;
  await appendFile(path, renderGithubSummary(report, lang, diff), "utf8");
};

/** GitHub code scanning reads SARIF, which puts each finding inline on the changed lines. */
const writeSarif = async (report: Report, path: string | undefined): Promise<void> => {
  if (path === undefined) return;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, renderSarif(report, SCORIA_VERSION), "utf8");
};

/** Published somewhere public, this is all a shields.io endpoint badge needs — no server. */
const writeBadge = async (report: Report, path: string | undefined, diff: ReportDiff | undefined): Promise<void> => {
  if (path === undefined) return;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(badgeEndpoint(report, diff), null, 2)}\n`, "utf8");
};

/** A run with no baseline has nothing to ratchet against, so it reports and passes. */
const gateOf = (mode: Mode, baseline: Report | undefined, report: Report): Verdict | undefined => {
  if (mode !== "ratchet" || baseline === undefined) return undefined;
  return judge(baseline, report, changedTools(baseline, report));
};

export const main = async (argv: readonly string[]): Promise<void> => {
  const options = parse(argv);
  if (options.command === "init") {
    await runInit(options.target, options.lang ?? "en");
    return;
  }
  if (options.command === "doctor") {
    const diagnosis = await diagnose(options.target);
    const applied = options.fix ? await applyFixes(diagnosis) : [];
    process.stdout.write(renderDoctor(diagnosis, applied, options.lang ?? "en"));
    return;
  }
  const { report, loaded } = await assay(options.target);
  const lang = options.lang ?? loaded.config.lang;
  if (options.command === "baseline") {
    const path = await writeBaseline(options.target, report);
    process.stdout.write(`\n${messagesFor(lang).baselineWritten(displayPath(path))}\n\n`);
    return;
  }
  await runAssay(options, report, loaded, lang);
};

const runAssay = async (options: Options, report: Report, loaded: LoadedConfig, lang: Lang): Promise<void> => {
  const baseline = await readBaseline(options.target);
  const comparison =
    baseline === undefined
      ? undefined
      : { diff: diffReports(baseline.report, report), since: baseline.createdAt, rebaseline: changedTools(baseline.report, report) };
  const verdict = gateOf(loaded.config.mode, baseline?.report, report);
  const notice = await freezeIfNeeded(options.target, loaded.frozen, options.write, lang);
  await writeGithubSummary(report, lang, options.summary, comparison?.diff);
  await writeSarif(report, options.sarif);
  await writeBadge(report, options.badge, comparison?.diff);
  // Non-zero only under `mode: ratchet`. The default mode reports and exits 0 (spec §17.2).
  if (verdict?.failed === true) process.exitCode = 1;
  if (options.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return;
  }
  process.stdout.write(
    options.explain === undefined
      ? renderReport(report, { source: loaded.source, drift: loaded.drift, notice, lang, comparison, verdict })
      : renderExplain(report, options.explain, lang),
  );
};
