// A guide page links to a sibling as `./configuration` or `configuration.md`, which is right beside the
// Markdown file but wrong on the site: every page is served as a folder (`/lab/ja/guide/getting-started/`),
// so the browser would resolve it inside the current page. This points such links at the sibling's folder.
type Node = { type?: unknown; url?: unknown; children?: unknown };

const isNode = (value: unknown): value is Node => typeof value === "object" && value !== null;

const SIBLING = /^(?:\.\/)?([a-z0-9][a-z0-9-]*)(?:\.md)?(#[^\s]*)?$/u;

/** Pure: where a link in a guide page should point on the site. Anything not a sibling page is left as written. */
export const guideLinkTarget = (url: string): string => {
  const match = SIBLING.exec(url);
  return match ? `../${match[1]}/${match[2] ?? ""}` : url;
};

const visit = (node: unknown): void => {
  if (!isNode(node)) return;
  if ((node.type === "link" || node.type === "definition") && typeof node.url === "string") node.url = guideLinkTarget(node.url);
  if (Array.isArray(node.children)) node.children.forEach(visit);
};

/** A remark plugin: rewrites links between guide pages for the site's folder-per-page layout. */
export const remarkGuideLinks = () => (tree: unknown) => visit(tree);
