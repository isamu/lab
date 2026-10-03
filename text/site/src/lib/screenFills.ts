// A guide page that shows chaff's screen does not keep the lines that change with every new rule. It writes "{not-run}"
// where chaff lists the rules that did not run, "{not-run: <rule>}" for one rule's line of such a list (its padding
// follows the longest id that did not run), and "{counts}" where --compact ends with "3 findings, 97 rules not run".
// yarn examples runs chaff on each such screen (scripts/guide-screens.ts) and this puts its lines in at build.
// A screen with nothing made for it stops the build rather than show a marker.
import { readFileSync } from "node:fs";
import { relative, resolve, sep } from "node:path";

type Node = { type?: unknown; value?: unknown; children?: unknown };

/** The lines made for one screen: the list of rules that did not run, single rules' lines of it, and the last line of --compact. */
export type ScreenFills = { readonly notRun?: string; readonly counts?: string; readonly rows?: Readonly<Record<string, string>> };
/** One page's screens with markers, in page order. */
export type PageFills = readonly { readonly command: string; readonly fills: ScreenFills }[];
type AllFills = Readonly<Record<string, PageFills>>;

/** The line a guide page writes where chaff's list of the rules that did not run goes. */
export const NOT_RUN_MARKER = "{not-run}";
/** The line a guide page writes where --compact's last line ("3 findings, 97 rules not run") goes. */
export const COUNTS_MARKER = "{counts}";
const ROW_MARKER = /^\{not-run: (\S+)\}$/u;

/** The line a guide page writes where one rule's line of chaff's list of the rules that did not run goes. */
export const notRunRowMarker = (rule: string): string => `{not-run: ${rule}}`;

/** The rule a "{not-run: <rule>}" line names, or undefined for any other line. */
export const rowMarkerRule = (line: string): string | undefined => ROW_MARKER.exec(line.trim())?.[1];
const SCREENS_FILE = resolve(process.cwd(), "src", "generated", "guide-screens.json");
const GUIDE_DIR = resolve(process.cwd(), "src", "content", "guide");

const isNode = (value: unknown): value is Node => typeof value === "object" && value !== null;

const isOptionalString = (value: unknown): boolean => value === undefined || typeof value === "string";

const isOptionalRows = (value: unknown): boolean =>
  value === undefined || (isNode(value) && !Array.isArray(value) && Object.values(value).every((row: unknown) => typeof row === "string"));

const isFillsEntry = (value: unknown): boolean =>
  isNode(value) &&
  "command" in value &&
  typeof value.command === "string" &&
  "fills" in value &&
  isNode(value.fills) &&
  isOptionalString("notRun" in value.fills ? value.fills.notRun : undefined) &&
  isOptionalString("counts" in value.fills ? value.fills.counts : undefined) &&
  isOptionalRows("rows" in value.fills ? value.fills.rows : undefined);

const isAllFills = (value: unknown): value is AllFills =>
  isNode(value) && Object.values(value).every((page: unknown) => Array.isArray(page) && page.every(isFillsEntry));

/** The marker on a line and what was made for it, or undefined for a line that is no marker. */
const markerOf = (line: string, fills: ScreenFills): readonly [string, string | undefined] | undefined => {
  const trimmed = line.trim();
  if (trimmed === NOT_RUN_MARKER) return [NOT_RUN_MARKER, fills.notRun];
  if (trimmed === COUNTS_MARKER) return [COUNTS_MARKER, fills.counts];
  const rule = rowMarkerRule(trimmed);
  return rule === undefined ? undefined : [trimmed, fills.rows?.[rule]];
};

/** Pure: a code block's text with each marker line replaced by what was made for it. */
export const withScreenFills = (code: string, fills: ScreenFills, where: string): string =>
  code
    .split("\n")
    .map((line) => {
      const marker = markerOf(line, fills);
      if (marker === undefined) return line;
      const [name, fill] = marker;
      if (fill === undefined) throw new Error(`${where}: nothing made for ${name}; run yarn examples`);
      return fill;
    })
    .join("\n");

const hasMarker = (node: Node): boolean =>
  typeof node.value === "string" && node.value.split("\n").some((line) => markerOf(line, {}) !== undefined);

/** Pure: fills in a page's marked code blocks, given in page order, from that page's entries, also in page order. */
export const fillPage = (codes: readonly string[], page: PageFills, pageName: string): string[] =>
  codes.map((code, index) => {
    const command = code.split("\n")[0] ?? "";
    const entry = page[index];
    if (entry?.command !== command)
      throw new Error(`${pageName}: nothing made for screen ${String(index + 1)} ("${command}"); run yarn examples`);
    return withScreenFills(code, entry.fills, `${pageName}: "${command}"`);
  });

const loadFills = (): AllFills => {
  const parsed: unknown = JSON.parse(readFileSync(SCREENS_FILE, "utf8"));
  if (!isAllFills(parsed)) throw new Error(`${SCREENS_FILE}: not the output of scripts/guide-screens.ts`);
  return parsed;
};

const codeNodes = (node: unknown): Node[] => {
  if (!isNode(node)) return [];
  const own = node.type === "code" && typeof node.value === "string" ? [node] : [];
  return [...own, ...(Array.isArray(node.children) ? node.children.flatMap(codeNodes) : [])];
};

/** A remark plugin: fills in the marked lines of a guide page's screens from src/generated/guide-screens.json. */
export const remarkScreenFills = () => {
  const cache: { fills?: AllFills } = {};
  return (tree: unknown, file: { path?: string }) => {
    const marked = codeNodes(tree).filter(hasMarker);
    if (marked.length === 0) return;
    const page = relative(GUIDE_DIR, file.path ?? "")
      .split(sep)
      .join("/");
    cache.fills ??= loadFills();
    const filled = fillPage(
      marked.map((node) => String(node.value)),
      cache.fills[page] ?? [],
      page,
    );
    marked.forEach((node, index) => {
      node.value = filled[index];
    });
  };
};
