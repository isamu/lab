// A guide page that shows chaff's screen does not keep the lines that change with every new rule. It writes "{not-run}"
// where chaff lists the rules that did not run, and "{counts}" where --compact ends with "3 findings, 97 rules not run".
// yarn examples runs chaff on each such screen (scripts/guide-screens.ts) and this puts its lines in at build.
// A screen with nothing made for it stops the build rather than show a marker.
import { readFileSync } from "node:fs";
import { relative, resolve, sep } from "node:path";

type Node = { type?: unknown; value?: unknown; children?: unknown };

/** The lines made for one screen: the list of rules that did not run, and the last line of --compact. */
export type ScreenFills = { readonly notRun?: string; readonly counts?: string };
/** One page's screens with markers, in page order. */
export type PageFills = readonly { readonly command: string; readonly fills: ScreenFills }[];
type AllFills = Readonly<Record<string, PageFills>>;

/** The line a guide page writes where chaff's list of the rules that did not run goes. */
export const NOT_RUN_MARKER = "{not-run}";
/** The line a guide page writes where --compact's last line ("3 findings, 97 rules not run") goes. */
export const COUNTS_MARKER = "{counts}";
const SCREENS_FILE = resolve(process.cwd(), "src", "generated", "guide-screens.json");
const GUIDE_DIR = resolve(process.cwd(), "src", "content", "guide");

const isNode = (value: unknown): value is Node => typeof value === "object" && value !== null;

const isOptionalString = (value: unknown): boolean => value === undefined || typeof value === "string";

const isFillsEntry = (value: unknown): boolean =>
  isNode(value) &&
  "command" in value &&
  typeof value.command === "string" &&
  "fills" in value &&
  isNode(value.fills) &&
  isOptionalString("notRun" in value.fills ? value.fills.notRun : undefined) &&
  isOptionalString("counts" in value.fills ? value.fills.counts : undefined);

const isAllFills = (value: unknown): value is AllFills =>
  isNode(value) && Object.values(value).every((page: unknown) => Array.isArray(page) && page.every(isFillsEntry));

const markers = (fills: ScreenFills): readonly (readonly [string, string | undefined])[] => [
  [NOT_RUN_MARKER, fills.notRun],
  [COUNTS_MARKER, fills.counts],
];

/** Pure: a code block's text with each marker line replaced by what was made for it. */
export const withScreenFills = (code: string, fills: ScreenFills, where: string): string =>
  code
    .split("\n")
    .map((line) => {
      const marker = markers(fills).find(([name]) => line.trim() === name);
      if (marker === undefined) return line;
      const [name, fill] = marker;
      if (fill === undefined) throw new Error(`${where}: nothing made for ${name}; run yarn examples`);
      return fill;
    })
    .join("\n");

const hasMarker = (node: Node): boolean =>
  typeof node.value === "string" && node.value.split("\n").some((line) => line.trim() === NOT_RUN_MARKER || line.trim() === COUNTS_MARKER);

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
