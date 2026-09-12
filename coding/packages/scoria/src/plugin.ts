/**
 * scoria plugin contract — spec §8.
 *
 * Types only. Do not add implementation here.
 * Probes and stack adapters depend on this file alone and know nothing of the core internals.
 */

export type Tier = 0 | 1 | 2 | 3 | 4 | 5;

export type Severity = "error" | "warning" | "info";

export type MetricUnit = "count" | "ratio" | "per_kloc" | "pct" | "lines";

export interface Contributor {
  readonly file: string;
  readonly value: number;
}

/**
 * One measurement a probe returns. Not a score (spec §6.2).
 * Normalising to 0-100 is the rubric's job; doing it in a probe buries the threshold in code.
 */
export interface Metric {
  readonly id: string;
  readonly value: number;
  readonly unit: MetricUnit;
  readonly topContributors?: readonly Contributor[];
}

/**
 * absent and skipped are kept apart so that a repository with no tests at all cannot score full
 * marks (spec §18). absent means the project is missing something it ought to have, and scores 0.
 * skipped means scoria could not measure it, and is not scored at all.
 */
export type ProbeStatus =
  { readonly kind: "ok" } | { readonly kind: "absent"; readonly reason: string } | { readonly kind: "skipped"; readonly reason: string };

export interface Finding {
  readonly rule: string;
  readonly severity: Severity;
  readonly file: string;
  readonly line: number;
  readonly message: string;
  readonly probe: string;
  readonly dimension: string;
  readonly tier: Tier;
}

export interface ProbeResult {
  readonly probe: string;
  readonly status: ProbeStatus;
  readonly metrics: readonly Metric[];
  readonly findings: readonly Finding[];
  readonly toolVersions: Readonly<Record<string, string>>;
  readonly durationMs: number;
}

export type FileKind = "source" | "test" | "config" | "generated" | "ignored";

/**
 * Probes receive classified files, never raw paths.
 * Spec §8 forbids a probe from deciding file kinds by any route other than classify; rather than
 * policing that with a static check, the contract makes the violation unwritable.
 */
export interface SourceFile {
  readonly path: string;
  readonly kind: FileKind;
  /** The original lines. Used for line numbers and for measuring file size. */
  readonly lines: readonly string[];
  /**
   * The same lines with everything that is not JavaScript/TypeScript blanked out.
   * Line numbers stay aligned with `lines`.
   *
   * Scanning a .vue `<template>` or `<style>` as JS makes HTML attribute quotes and apostrophes
   * in body text open string literals, hiding the code that follows. Only the stack adapter knows
   * which regions are JS, so the core settles this once at collection time.
   */
  readonly codeLines: readonly string[];
}

/** What detection established about the project, so probes never touch a stack adapter directly. */
export interface ProjectFacts {
  /** Whether typescript is a dependency. Decides whether warning about .js is appropriate. */
  readonly typescript: boolean;
  /**
   * Whether the target's dependencies are installed.
   *
   * Tier 1 tools resolve the import graph, and without node_modules they resolve nothing and
   * report nothing — which reads as a clean repository. They must report skipped instead.
   */
  readonly installed: boolean;
  /**
   * Which package manager's lockfile is present, or undefined for neither.
   *
   * Detected from the file's existence rather than its contents: a lockfile runs to megabytes, and
   * `npm audit` cannot read a yarn.lock, so asking the wrong one reports nothing rather than zero.
   */
  readonly packageManager: "npm" | "yarn" | undefined;
  readonly stacks: readonly string[];
}

export interface ExecResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly code: number;
}

export type Exec = (command: string, args: readonly string[]) => Promise<ExecResult>;

/**
 * Runs a Node script — every tool scoria drives is one.
 *
 * Their bins are `#!/usr/bin/env node` scripts, and Windows does not honour a shebang, so
 * executing the path directly works on Unix and fails on Windows. Running them through the same
 * Node that is already executing removes the question, and needs no shell.
 */
export type ExecNode = (script: string, args: readonly string[]) => Promise<ExecResult>;

/**
 * Reads a file a probe itself produced — a tool's report written to a scratch directory.
 *
 * Probes must not import fs (spec §26.2): the rule stops them deciding file kinds behind
 * classify's back. Reading back the output of a command they just ran is a different act, and
 * the core owns it so the rule can stay absolute.
 */
export type ReadText = (path: string) => Promise<string | undefined>;

/**
 * A configuration file the core read for probes that judge the project's own gates.
 * Only a bounded, known set is collected; probes never walk the tree themselves.
 */
export interface ConfigFile {
  readonly path: string;
  readonly text: string;
}

export interface ProbeContext {
  readonly root: string;
  readonly files: readonly SourceFile[];
  readonly configFiles: readonly ConfigFile[];
  readonly project: ProjectFacts;
  readonly exec: Exec;
  readonly execNode: ExecNode;
  readonly readText: ReadText;
}

export interface Probe {
  readonly kind: "probe";
  readonly id: string;
  readonly apiVersion: 1;
  readonly tier: Tier;
  /** The metric ids this probe can emit. Used to validate rubrics statically (spec §26.2). */
  readonly declares: readonly string[];
  readonly detect: (ctx: ProbeContext) => Promise<ProbeStatus>;
  readonly run: (ctx: ProbeContext) => Promise<ProbeResult>;
}

export interface StackDetection {
  readonly matched: boolean;
  readonly confidence: number;
  readonly evidence: readonly string[];
}

export interface StackAdapter {
  readonly kind: "stack";
  readonly id: string;
  readonly apiVersion: 1;
  readonly detect: (root: string) => Promise<StackDetection>;
  /** Return "ignored" for paths this adapter does not own. The core takes the first non-ignored result. */
  readonly classify: (relativePath: string) => FileKind;
  /** Returns the lines with only the JS-interpretable regions kept. Omit to use the lines as they are. */
  readonly codeLinesOf?: (lines: readonly string[]) => readonly string[];
}
