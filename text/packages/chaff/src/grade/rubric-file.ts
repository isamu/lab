import { createHash } from "node:crypto";
import { extname } from "node:path";
import { parse } from "yaml";
import { parseRubric, type Rubric, type RubricProblem } from "./rubric.ts";

// A rubric file given with `chaff grade --rubric <file>`: the schema of chaff.yaml's `grade:`, at the file's top level.
// Pure: the caller reads the file. Its paths drop the `grade.` prefix, because in the file they start at the top.

type Format = "yaml" | "json";

const FORMATS: Readonly<Record<string, Format>> = { ".yaml": "yaml", ".yml": "yaml", ".json": "json" };

export type RubricFileProblem =
  { readonly kind: "format" } | { readonly kind: "syntax"; readonly why: string } | { readonly kind: "rubric"; readonly problem: RubricProblem };

export type RubricFile = { readonly rubric: Rubric; readonly digest: string } | { readonly problems: readonly RubricFileProblem[] };

const formatOf = (path: string): Format | undefined => FORMATS[extname(path).toLowerCase()];

const syntaxOf = (content: string, format: Format): { readonly raw: unknown } | { readonly why: string } => {
  try {
    return { raw: format === "json" ? JSON.parse(content) : parse(content) };
  } catch (error) {
    return { why: error instanceof Error ? error.message : String(error) };
  }
};

/** `grade.rules.x` in chaff.yaml is `rules.x` in a rubric file; `grade` itself is the file's top level, the empty path. */
export const filePathOf = (gradePath: string): string => (gradePath === "grade" ? "" : gradePath.replace(/^grade\./u, ""));

/** The sha256 of the file's bytes as read, recorded in the stamp so runs under different rubric files are not compared silently. */
export const rubricFileDigest = (content: string): string => `sha256:${createHash("sha256").update(content).digest("hex")}`;

/** The rubric a file holds, or every problem with it. An empty file is an empty rubric, as a bare `grade:` is. */
export const parseRubricFile = (path: string, content: string): RubricFile => {
  const format = formatOf(path);
  if (format === undefined) return { problems: [{ kind: "format" }] };
  const read = syntaxOf(content, format);
  if ("why" in read) return { problems: [{ kind: "syntax", why: read.why }] };
  const parsed = parseRubric(read.raw ?? null);
  if ("problems" in parsed)
    return { problems: parsed.problems.map((problem) => ({ kind: "rubric", problem: { ...problem, path: filePathOf(problem.path) } })) };
  return { rubric: parsed.rubric ?? { rules: {} }, digest: rubricFileDigest(content) };
};
