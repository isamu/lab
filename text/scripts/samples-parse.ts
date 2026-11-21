// The parts of a rule sample (docs/samples/<language>/<rule-id>.md) that a machine reads, and the screens written back
// into it. No file system here: scripts/samples.ts reads the files and runs chaff, test/test_rule_samples.ts checks them.
import { parse } from "yaml";

/** What the sample's opening comment says: the rule, the genre the run uses, the file name the screen shows. */
export type SampleMeta = {
  readonly rule: string;
  readonly genre: string;
  readonly file: string;
  /** Rules the corrected text may still be reported by, each one said in the sample's own words. */
  readonly afterAllows: readonly string[];
};

/** One fenced block: its info string's chaff- tag, the word after the tag, its body, and where the body sits. */
export type SampleBlock = { readonly tag: string; readonly name: string | undefined; readonly body: string; readonly start: number; readonly end: number };

export type Sample = {
  readonly meta: SampleMeta;
  readonly before: string;
  readonly after: string;
  /** chaff.yaml for both runs, when the sample needs one. */
  readonly config: string | undefined;
  /** Further files beside the document, by name: a rule that compares documents reads them too. */
  readonly others: Readonly<Record<string, string>>;
  /** The chaff.yaml lines the settings section shows; each must be settings chaff reads. */
  readonly settings: readonly string[];
};

const META = /^<!-- chaff-sample\n([\s\S]*?)\n-->/u;
const FENCE_OPEN = /^(`{3,})[a-z]*[ \t]+(chaff-[a-z]+)(?:[ \t]+([^\s`]+))?$/u;
const DEFAULT_FILE = "draft.md";

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> => typeof value === "object" && value !== null && !Array.isArray(value);

const textField = (raw: Readonly<Record<string, unknown>>, key: string, where: string): string => {
  const value = raw[key];
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${where}: the chaff-sample comment needs ${key}:`);
  return value.trim();
};

const listField = (value: unknown, where: string): string[] => {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === "string")) throw new Error(`${where}: after_allows is a list of rule ids`);
  return value;
};

export const metaOf = (text: string, where: string): SampleMeta => {
  const found = META.exec(text);
  if (found === null) throw new Error(`${where}: the file must open with a <!-- chaff-sample ... --> comment`);
  const raw: unknown = parse(found[1] ?? "");
  if (!isRecord(raw)) throw new Error(`${where}: the chaff-sample comment is not YAML keys`);
  const file = raw["file"] === undefined ? DEFAULT_FILE : textField(raw, "file", where);
  return { rule: textField(raw, "rule", where), genre: textField(raw, "genre", where), file, afterAllows: listField(raw["after_allows"], where) };
};

/** Where each line starts in the text. */
const lineStarts = (lines: readonly string[]): number[] => {
  const starts = [0];
  lines.forEach((line) => starts.push((starts.at(-1) ?? 0) + line.length + 1));
  return starts;
};

/** The tagged blocks from this line on. A block's body is skipped whole, so a fence inside it is part of the body. */
const blocksFrom = (text: string, lines: readonly string[], starts: readonly number[], from: number, where: string): SampleBlock[] => {
  const index = lines.findIndex((line, at) => at >= from && FENCE_OPEN.test(line.trimEnd()));
  if (index < 0) return [];
  const [, fence = "```", tag = "", name] = FENCE_OPEN.exec((lines[index] ?? "").trimEnd()) ?? [];
  const close = lines.findIndex((line, at) => at > index && line.trimEnd() === fence);
  if (close < 0) throw new Error(`${where}: the ${tag} block on line ${String(index + 1)} is never closed`);
  const start = starts[index + 1] ?? 0;
  const end = starts[close] ?? start;
  return [{ tag, name, body: text.slice(start, end), start, end }, ...blocksFrom(text, lines, starts, close + 1, where)];
};

/** Every block whose info string carries a chaff- tag, in order. The body is the text between the fences, with its last newline. */
export const blocksOf = (text: string, where: string): SampleBlock[] => {
  const lines = text.split("\n");
  return blocksFrom(text, lines, lineStarts(lines), 0, where);
};

const onlyBlock = (blocks: readonly SampleBlock[], tag: string, where: string): string => {
  const found = blocks.filter((block) => block.tag === tag);
  if (found.length !== 1) throw new Error(`${where}: needs exactly one \`\`\`… ${tag} block, found ${String(found.length)}`);
  return found[0]?.body ?? "";
};

const optionalBlock = (blocks: readonly SampleBlock[], tag: string, where: string): string | undefined =>
  blocks.some((block) => block.tag === tag) ? onlyBlock(blocks, tag, where) : undefined;

const othersOf = (blocks: readonly SampleBlock[], where: string): Record<string, string> =>
  Object.fromEntries(
    blocks
      .filter((block) => block.tag === "chaff-file")
      .map((block) => {
        if (block.name === undefined) throw new Error(`${where}: a chaff-file block names its file: \`\`\`markdown chaff-file glossary.md`);
        return [block.name, block.body];
      }),
  );

export const sampleOf = (text: string, where: string): Sample => {
  const blocks = blocksOf(text, where);
  return {
    meta: metaOf(text, where),
    before: onlyBlock(blocks, "chaff-before", where),
    after: onlyBlock(blocks, "chaff-after", where),
    config: optionalBlock(blocks, "chaff-config", where),
    others: othersOf(blocks, where),
    settings: blocks.filter((block) => block.tag === "chaff-settings").map((block) => block.body),
  };
};

/** The arguments of the run a sample shows, without the program's name: the genre, then the document and any others. */
export const sampleArgs = (sample: Sample): string[] => ["--no-guide", "--genre", sample.meta.genre, sample.meta.file, ...Object.keys(sample.others)];

/** `chaff explain` for the sample's rule, with the genre, so the numbers it lists are the ones the sample ran with. */
export const explainArgs = (sample: Sample): string[] => ["explain", sample.meta.rule, "--genre", sample.meta.genre];

export const commandOf = (args: readonly string[]): string => `$ npx chaffjs ${args.join(" ")}`;

// The friendly report ends with every rule that did not run, a list that grows with each new rule; a sample shows up to
// the line that says the text was not changed, which closes the findings in both languages.
const CLOSING = /^\s*(文章は書き換えていません。直すのは書いた人です。|The text was not changed\. Fixing it is the writer's job\.)$/u;

/**
 * The report as a sample shows it: the command, then chaff's output from the first document's header line to its closing
 * line, without trailing spaces. What comes before the header is the run's own (the SARIF file the check reads).
 */
export const screenOf = (command: string, output: string, files: readonly string[], where: string): string => {
  const lines = output.split("\n").map((line) => line.trimEnd());
  const header = lines.findIndex((line) => files.some((file) => line.startsWith(`${file} `)));
  const closing = lines.findIndex((line) => CLOSING.test(line));
  if (header < 0 || closing < header)
    throw new Error(`${where}: chaff's report has no header for ${files.join(", ")} or no closing line; did the run fail?\n${output}`);
  return [command, "", ...lines.slice(header, closing + 1), ""].join("\n");
};

/** Any screen: the command, then what chaff printed, without blank lines around it or trailing spaces. */
export const plainScreenOf = (command: string, output: string): string => {
  const lines = output.split("\n").map((line) => line.trimEnd());
  const first = lines.findIndex((line) => line !== "");
  const last = lines.findLastIndex((line) => line !== "");
  return [command, "", ...lines.slice(first, last + 1), ""].join("\n");
};

/** The text with the body of its block of this tag replaced. A sample without one gets an error that names the tag. */
export const withBlock = (text: string, tag: string, body: string, where: string): string => {
  const block = blocksOf(text, where).find((entry) => entry.tag === tag);
  if (block === undefined) throw new Error(`${where}: no \`\`\`text ${tag} block to write chaff's output into`);
  return `${text.slice(0, block.start)}${body}${text.slice(block.end)}`;
};

/** The body of the block of this tag, or undefined. */
export const blockBody = (text: string, tag: string, where: string): string | undefined => blocksOf(text, where).find((block) => block.tag === tag)?.body;
