// A guide page that shows chaff's screen writes "{not-run}" where chaff lists the rules that did not run. That list
// changes with every new rule, so the page does not keep a copy: yarn examples runs chaff (scripts/guide-screens.ts)
// and this puts its list in at build. A screen with no list made for it stops the build rather than show the marker.
import { readFileSync } from "node:fs";
import { relative, resolve, sep } from "node:path";

type Node = { type?: unknown; value?: unknown; children?: unknown };
type Lists = Readonly<Record<string, Readonly<Record<string, string>>>>;

/** The line a guide page writes where chaff's list of the rules that did not run goes. */
export const NOT_RUN_MARKER = "{not-run}";
const SCREENS_FILE = resolve(process.cwd(), "src", "generated", "guide-screens.json");
const GUIDE_DIR = resolve(process.cwd(), "src", "content", "guide");

const isNode = (value: unknown): value is Node => typeof value === "object" && value !== null;

const isLists = (value: unknown): value is Lists =>
  isNode(value) &&
  Object.values(value).every((lists: unknown) => isNode(lists) && Object.values(lists).every((list: unknown) => typeof list === "string"));

/** Pure: a code block's text with its "{not-run}" line replaced by the list made for this page and command. */
export const withNotRunList = (code: string, lists: Readonly<Record<string, string>>, page: string): string => {
  const lines = code.split("\n");
  if (!lines.some((line) => line.trim() === NOT_RUN_MARKER)) return code;
  const command = lines[0] ?? "";
  const list = lists[command];
  if (list === undefined) throw new Error(`${page}: no list of rules that did not run for "${command}"; run yarn examples`);
  return lines.map((line) => (line.trim() === NOT_RUN_MARKER ? list : line)).join("\n");
};

const loadLists = (): Lists => {
  const parsed: unknown = JSON.parse(readFileSync(SCREENS_FILE, "utf8"));
  if (!isLists(parsed)) throw new Error(`${SCREENS_FILE}: not the output of scripts/guide-screens.ts`);
  return parsed;
};

const codeNodes = (node: unknown): Node[] => {
  if (!isNode(node)) return [];
  const own = node.type === "code" && typeof node.value === "string" ? [node] : [];
  return [...own, ...(Array.isArray(node.children) ? node.children.flatMap(codeNodes) : [])];
};

const hasMarker = (node: Node): boolean =>
  typeof node.value === "string" && node.value.split("\n").some((line) => line.trim() === NOT_RUN_MARKER);

/** A remark plugin: fills in the "{not-run}" lines of a guide page from src/generated/guide-screens.json. */
export const remarkNotRunLists = () => {
  const cache: { lists?: Lists } = {};
  return (tree: unknown, file: { path?: string }) => {
    const marked = codeNodes(tree).filter(hasMarker);
    if (marked.length === 0) return;
    const page = relative(GUIDE_DIR, file.path ?? "")
      .split(sep)
      .join("/");
    cache.lists ??= loadLists();
    const lists = cache.lists[page] ?? {};
    marked.forEach((node) => {
      node.value = withNotRunList(String(node.value), lists, page);
    });
  };
};
