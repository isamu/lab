import type { AtomKind } from "../compare/atom.ts";
import type { CitationStatus } from "../structure/cite.ts";
import type { Severity } from "../plugin.ts";
import type { OutputSize } from "./rates.ts";
import type { GradeAiScore } from "./ai-score.ts";

// The shape of one line of `chaff grade --out`, and of what `grade()` returns. Spec §29.3.

export type GradeFinding = {
  readonly rule: string;
  readonly level: Severity;
  readonly line: number;
  readonly column: number;
  readonly message: string;
};

/** A dropped or added fact, as `compare --json` writes it. */
export type GradeFact = { readonly kind: AtomKind; readonly key: string; readonly text: string; readonly line: number; readonly allowed: boolean };

/** `compare`'s outcome against the item's reference. */
export type GradeFacts = { readonly dropped: readonly GradeFact[]; readonly added: readonly GradeFact[]; readonly reformed: number };

export type FailedCitation = {
  readonly source: string;
  readonly address: string;
  readonly quote: string;
  readonly status: Exclude<CitationStatus, "ok">;
  readonly foundAt?: string | undefined;
  readonly line?: number | undefined;
};

export type GradeCitations = { readonly checked: number; readonly failed: readonly FailedCitation[] };

/** A fact of the output that a retrieved passage states, and the first passage (0-based) that does. */
export type SupportedFact = { readonly kind: AtomKind; readonly text: string; readonly line: number; readonly passage: number };

/** The output's checkable facts against the item's retrieved passages (`contexts`). */
export type GradeContexts = {
  readonly passages: number;
  /** Facts of the kinds checked against the passages: numbers, dates, times, URLs, code, names and quotations. */
  readonly checked: number;
  readonly supported: readonly SupportedFact[];
  /** Facts no passage states; a quotation not found word for word in any passage. */
  readonly unsupported: readonly GradeFact[];
  /** Sentences that state no checkable fact: whether a passage supports them needs reading, which chaff does not do. */
  readonly uncheckedSentences: number;
};

/** A rule, or a check (`compare`, `cite`), that did not run on this output, and why. */
export type NotRunEntry = { readonly rule: string; readonly reason: string };

/** What makes two results comparable (spec §29.7): the same rules and settings. */
export type Stamp = { readonly chaff: string; readonly rules: string; readonly settings: string };

/** One finding's penalty points, so every point names the finding it came from. */
export type ScoreItem = { readonly points: number; readonly rule: string; readonly line: number };

/** The penalty sum under a `grade:` rubric (spec §29.4). Never a score out of a maximum. */
export type GradeScore = { readonly penalty: number; readonly items: readonly ScoreItem[] };

export type GradeResult = {
  readonly id: string;
  /** The item's variant label, when it had one. */
  readonly variant?: string | undefined;
  readonly language: string;
  readonly genre: string;
  readonly size: OutputSize;
  readonly findings: readonly GradeFinding[];
  readonly rates: Readonly<Record<string, number>>;
  readonly notRun: readonly NotRunEntry[];
  /** Null when the item had no reference. */
  readonly facts: GradeFacts | null;
  /** Null when the item gave no citations. */
  readonly citations: GradeCitations | null;
  /** Only when the item gave contexts, so results of items without them keep their shape. */
  readonly contexts?: GradeContexts | undefined;
  /** Only with a `grade:` rubric. */
  readonly score?: GradeScore | undefined;
  /** The AI-likeness quick score. Absent only in results written before it existed. Never part of pass or fail. */
  readonly aiScore?: GradeAiScore | undefined;
  readonly pass: boolean;
  /** Each condition the output failed, with how far: `facts.dropped 3 > 0`. */
  readonly failedBecause: readonly string[];
  readonly stamp: Stamp;
};
