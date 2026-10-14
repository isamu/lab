// Which lab issues the open chaff-corpus cases need: one issue per document that still has a `false-positive` or
// `missed` entry in isamu/chaff-corpus's expected/<id>.yaml. Pure; corpus-cases.ts reads the files and the issues.

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/** An entry chaff still gets wrong: a finding it should not give, or one it should give and does not. */
export type OpenEntry = {
  readonly verdict: "false-positive" | "missed";
  readonly rule: string;
  readonly line: number;
  /** The text at the finding (a false positive) or what a reader expects there (a miss). */
  readonly text: string;
  readonly note?: string;
};

/** One document's open entries, and where it lives in the corpus repository (paths relative to its root). */
export type CorpusCase = {
  readonly id: string;
  readonly entries: readonly OpenEntry[];
  readonly expectedPath: string;
  /** The document's text, or its .yaml when the text may not be redistributed; undefined when docs/ has neither. */
  readonly documentPath?: string;
};

/** A document whose expected file cannot be read: its issue is left as it is. */
export type CaseProblem = { readonly id: string; readonly problem: string };

/** A lab issue labelled corpus-case, as `gh issue list --json number,title,body,state` gives it. */
export type ExistingIssue = { readonly number: number; readonly title: string; readonly body: string; readonly state: "OPEN" | "CLOSED" };

export type IssueAction =
  | { readonly kind: "create"; readonly id: string; readonly title: string; readonly body: string }
  | { readonly kind: "update"; readonly id: string; readonly number: number; readonly title: string; readonly body: string; readonly reopen: boolean }
  | { readonly kind: "close"; readonly id: string; readonly number: number; readonly comment: string };

export type IssuePlan = {
  readonly actions: readonly IssueAction[];
  /** Ids whose open issue already says what the corpus says. */
  readonly unchanged: readonly string[];
  readonly problems: readonly CaseProblem[];
};

export const CORPUS_REPOSITORY = "isamu/chaff-corpus";
const BLOB_BASE = `https://github.com/${CORPUS_REPOSITORY}/blob/main/`;
const MAX_TITLE_LENGTH = 200;
const OPEN_VERDICTS: readonly string[] = ["false-positive", "missed"];
const KNOWN_VERDICTS: readonly string[] = ["correct", "unjudged", ...OPEN_VERDICTS];

/** The hidden line that ties an issue to its document, so a rerun finds it again whatever its title became. */
export const markerOf = (id: string): string => `<!-- corpus-case: ${id} -->`;

const MARKER_PATTERN = /^<!-- corpus-case: (\S+) -->$/mu;

/** The document id an issue body is marked with, or undefined for an issue this sync did not write. */
export const markedId = (body: string): string | undefined => MARKER_PATTERN.exec(body)?.[1];

const isOpenVerdict = (value: unknown): value is OpenEntry["verdict"] => typeof value === "string" && OPEN_VERDICTS.includes(value);

const entryProblem = (raw: unknown, index: number): string | undefined => {
  const where = `findings[${String(index)}]`;
  if (!isRecord(raw)) return `${where} is not a mapping`;
  if (typeof raw["rule"] !== "string" || raw["rule"] === "") return `${where} has no rule`;
  if (!Number.isInteger(raw["line"]) || Number(raw["line"]) < 1) return `${where} has no positive line`;
  if (typeof raw["verdict"] !== "string" || !KNOWN_VERDICTS.includes(raw["verdict"])) return `${where} has an unknown verdict`;
  const textKey = raw["verdict"] === "missed" ? "what" : "text";
  return typeof raw[textKey] === "string" ? undefined : `${where} has no ${textKey}`;
};

const openEntryOf = (raw: Readonly<Record<string, unknown>>): OpenEntry[] => {
  const verdict = raw["verdict"];
  if (!isOpenVerdict(verdict)) return [];
  const text = String(verdict === "missed" ? raw["what"] : raw["text"]);
  const entry: OpenEntry = { verdict, rule: String(raw["rule"]), line: Number(raw["line"]), text };
  return [typeof raw["note"] === "string" && raw["note"] !== "" ? { ...entry, note: raw["note"] } : entry];
};

const entryOrder = (left: OpenEntry, right: OpenEntry): number =>
  left.line - right.line || left.rule.localeCompare(right.rule, "en") || left.text.localeCompare(right.text, "en");

/**
 * The open entries of expected/<id>.yaml, already parsed from YAML, or why it cannot be read. Any malformed entry makes
 * the whole file a problem: closing an issue because its entries could not be read would report a case as resolved.
 */
export const openCaseOf = (raw: unknown, id: string, documentPath: string | undefined): CorpusCase | CaseProblem => {
  if (!isRecord(raw)) return { id, problem: "the file is not a mapping" };
  if (raw["id"] !== id) return { id, problem: `its id is not "${id}" (the file name)` };
  const findings = raw["findings"] ?? [];
  if (!Array.isArray(findings)) return { id, problem: "findings is not a list" };
  const problems = findings.flatMap((entry: unknown, index) => entryProblem(entry, index) ?? []);
  if (problems.length > 0) return { id, problem: problems.join("; ") };
  const entries = findings.filter(isRecord).flatMap(openEntryOf).toSorted(entryOrder);
  const place = { id, entries, expectedPath: `expected/${id}.yaml` };
  return documentPath === undefined ? place : { ...place, documentPath };
};

/** The rules of a case in the order they first appear, for the title. */
const rulesOf = (entries: readonly OpenEntry[]): string[] => [...new Set(entries.map((entry) => entry.rule))];

export const titleOf = (corpusCase: CorpusCase): string => {
  const title = `chaff-corpus: ${corpusCase.id} — ${rulesOf(corpusCase.entries).join(", ")}`;
  return title.length <= MAX_TITLE_LENGTH ? title : `${title.slice(0, MAX_TITLE_LENGTH - 1)}…`;
};

/** Corpus text in an issue: an @ that would mention someone is broken with a zero-width space, newlines become spaces. */
const inert = (text: string): string => text.replaceAll("@", "@\u200b").replaceAll(/\r?\n/gu, " ");

/** A code span that holds any text, backticks included. */
const codeSpan = (text: string): string => {
  if (text.trim() === "") return "(no text at the position)";
  const longestRun = Math.max(0, ...[...text.matchAll(/`+/gu)].map((match) => match[0].length));
  const fence = "`".repeat(longestRun + 1);
  const padded = text.startsWith("`") || text.endsWith("`") ? ` ${text} ` : text;
  return `${fence}${padded}${fence}`;
};

const lineLink = (corpusCase: CorpusCase, line: number): string =>
  corpusCase.documentPath === undefined || corpusCase.documentPath.endsWith(".yaml")
    ? `line ${String(line)}`
    : `[line ${String(line)}](${BLOB_BASE}${corpusCase.documentPath}?plain=1#L${String(line)})`;

const entryLine = (corpusCase: CorpusCase, entry: OpenEntry): string => {
  const note = entry.note === undefined ? "" : ` — ${inert(entry.note)}`;
  return `- **${entry.verdict}** \`${entry.rule}\`, ${lineLink(corpusCase, entry.line)}: ${codeSpan(inert(entry.text))}${note}`;
};

const documentLine = (corpusCase: CorpusCase): string => {
  const expected = `[${corpusCase.expectedPath}](${BLOB_BASE}${corpusCase.expectedPath})`;
  const document = corpusCase.documentPath === undefined ? "" : `[the document](${BLOB_BASE}${corpusCase.documentPath}), `;
  return `Open entries for \`${corpusCase.id}\` in ${CORPUS_REPOSITORY}: ${document}${expected}.`;
};

export const bodyOf = (corpusCase: CorpusCase): string =>
  [
    markerOf(corpusCase.id),
    documentLine(corpusCase),
    "",
    ...corpusCase.entries.map((entry) => entryLine(corpusCase, entry)),
    "",
    "A `false-positive` is a finding chaff should not give; a `missed` is one it should give and does not. This issue is " +
      "kept by the chaff corpus cases workflow from the corpus's main: it is updated when the entries change and closed " +
      "when none is left, so an edit to this body is overwritten.",
    "",
  ].join("\n");

const closeComment = (id: string, reason: "resolved" | "removed"): string =>
  reason === "resolved"
    ? `\`${id}\` has no \`false-positive\` or \`missed\` entry left in ${CORPUS_REPOSITORY}'s expected/${id}.yaml, so this case is resolved.`
    : `\`${id}\` is no longer in ${CORPUS_REPOSITORY} (expected/${id}.yaml is gone), so this case is closed.`;

/** The issue of each marked document: the open one when there is one, else the most recent. */
const issuesById = (issues: readonly ExistingIssue[]): Map<string, ExistingIssue> =>
  issues
    .toSorted((left, right) => Number(left.state === "OPEN") - Number(right.state === "OPEN") || left.number - right.number)
    .reduce((byId, issue) => {
      const id = markedId(issue.body);
      return id === undefined ? byId : byId.set(id, issue);
    }, new Map<string, ExistingIssue>());

const isProblem = (item: CorpusCase | CaseProblem): item is CaseProblem => "problem" in item;

const actionFor = (corpusCase: CorpusCase, issue: ExistingIssue | undefined): IssueAction | undefined => {
  const title = titleOf(corpusCase);
  const body = bodyOf(corpusCase);
  if (issue === undefined) return { kind: "create", id: corpusCase.id, title, body };
  const reopen = issue.state === "CLOSED";
  if (!reopen && issue.title === title && issue.body.trimEnd() === body.trimEnd()) return undefined;
  return { kind: "update", id: corpusCase.id, number: issue.number, title, body, reopen };
};

/**
 * What to do so that the open issues are exactly the documents with open entries. `cases` holds every expected file
 * the corpus has (a problem for one that cannot be read); a document whose file is a problem keeps its issue as it is.
 */
export const planIssues = (cases: readonly (CorpusCase | CaseProblem)[], issues: readonly ExistingIssue[]): IssuePlan => {
  const byId = issuesById(issues);
  const known = new Set(cases.map((item) => item.id));
  const open = cases.filter((item): item is CorpusCase => !isProblem(item) && item.entries.length > 0);
  const opened = open.map((corpusCase) => ({ id: corpusCase.id, action: actionFor(corpusCase, byId.get(corpusCase.id)) }));
  const openIds = new Set(open.map((corpusCase) => corpusCase.id));
  const problemIds = new Set(cases.filter(isProblem).map((problem) => problem.id));
  const closed = [...byId.entries()]
    .filter(([id, issue]) => issue.state === "OPEN" && !openIds.has(id) && !problemIds.has(id))
    .map(([id, issue]): IssueAction => ({ kind: "close", id, number: issue.number, comment: closeComment(id, known.has(id) ? "resolved" : "removed") }));
  return {
    actions: [...opened.flatMap((item) => item.action ?? []), ...closed].toSorted((left, right) => left.id.localeCompare(right.id, "en")),
    unchanged: opened.filter((item) => item.action === undefined).map((item) => item.id),
    problems: cases.filter(isProblem),
  };
};

/** The plan in a few lines, for the log and the job summary. */
export const planSummary = (plan: IssuePlan): string => {
  const count = (kind: IssueAction["kind"]): number => plan.actions.filter((action) => action.kind === kind).length;
  const lines = [
    `create ${String(count("create"))}, update ${String(count("update"))}, close ${String(count("close"))}, unchanged ${String(plan.unchanged.length)}`,
    ...plan.actions.map((action) => (action.kind === "close" ? `- close #${String(action.number)} ${action.id}` : `- ${action.kind} ${action.title}`)),
    ...plan.problems.map((problem) => `- skipped ${problem.id}: ${problem.problem}`),
  ];
  return lines.join("\n");
};
