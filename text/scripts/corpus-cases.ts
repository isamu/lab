// Keeps one lab issue per open chaff-corpus case: reads a checkout of isamu/chaff-corpus and the lab issues labelled
// corpus-case, and writes the plan (corpus-cases-plan.ts) as JSON. It changes nothing itself: the workflow
// chaff-corpus-cases.yml applies the plan with gh.
//   node scripts/corpus-cases.ts --corpus <chaff-corpus checkout> [--issues <gh issue list JSON>] [--plan <out.json>]
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { parseArgs } from "node:util";
import { parse } from "yaml";
import { openCaseOf, planIssues, planSummary, type CaseProblem, type CorpusCase, type ExistingIssue } from "./corpus-cases-plan.ts";

const TEXT_EXTENSIONS = [".md", ".txt"];

const { values: options } = parseArgs({
  options: { corpus: { type: "string" }, issues: { type: "string" }, plan: { type: "string" } },
});

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });

/** Each document id under docs/, with its text (or its .yaml when the text is not committed), relative to the corpus root. */
const documentPaths = (corpus: string): Map<string, string> => {
  const docs = join(corpus, "docs");
  const metas = existsSync(docs) ? walk(docs).filter((path) => path.endsWith(".yaml")) : [];
  return new Map(
    metas.map((meta) => {
      const text = TEXT_EXTENSIONS.map((extension) => meta.replace(/\.yaml$/u, extension)).find((path) => existsSync(path));
      const id = (meta.split(sep).at(-1) ?? "").replace(/\.yaml$/u, "");
      return [
        id,
        relative(corpus, text ?? meta)
          .split(sep)
          .join("/"),
      ];
    }),
  );
};

const caseOf = (corpus: string, file: string, documents: ReadonlyMap<string, string>): CorpusCase | CaseProblem => {
  const id = file.replace(/\.yaml$/u, "");
  try {
    return openCaseOf(parse(readFileSync(join(corpus, "expected", file), "utf8")), id, documents.get(id));
  } catch (error) {
    return { id, problem: `cannot read it: ${error instanceof Error ? error.message : String(error)}` };
  }
};

const isExistingIssue = (value: unknown): value is ExistingIssue =>
  typeof value === "object" &&
  value !== null &&
  "number" in value &&
  typeof value.number === "number" &&
  "title" in value &&
  typeof value.title === "string" &&
  "body" in value &&
  typeof value.body === "string" &&
  "state" in value &&
  (value.state === "OPEN" || value.state === "CLOSED");

const readIssues = (path: string | undefined): ExistingIssue[] => {
  if (path === undefined) return [];
  const raw: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (!Array.isArray(raw) || !raw.every(isExistingIssue)) throw new Error(`${path}: not the JSON of gh issue list --json number,title,body,state`);
  return raw;
};

const main = (): void => {
  const corpus = options.corpus;
  if (corpus === undefined) throw new Error("corpus-cases: --corpus <chaff-corpus checkout> is required");
  const expectedDir = join(corpus, "expected");
  if (!existsSync(expectedDir)) throw new Error(`corpus-cases: ${expectedDir} does not exist`);
  const documents = documentPaths(corpus);
  const files = readdirSync(expectedDir)
    .filter((name) => name.endsWith(".yaml"))
    .toSorted((left, right) => left.localeCompare(right, "en"));
  const plan = planIssues(
    files.map((file) => caseOf(corpus, file, documents)),
    readIssues(options.issues),
  );
  if (options.plan !== undefined) writeFileSync(options.plan, `${JSON.stringify(plan, null, 2)}\n`);
  console.log(planSummary(plan));
};

main();
