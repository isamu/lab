import { eachPreOrder } from "./tree-walk.ts";

/** mdast の節のうち、ページ内の案内かどうかの判定に要る部分だけ。 */
export type NavNode = {
  readonly type: string;
  readonly url?: string | undefined;
  readonly value?: string | undefined;
  readonly identifier?: string | undefined;
  readonly children?: readonly NavNode[] | undefined;
};

/** 参照形式のリンク（`[目次][toc]`）の名前のうち、定義（`[toc]: #目次`）が同じページの中を指すもの。 */
export type InPageAnchors = ReadonlySet<string>;

/** 文字か数字。これが 1 つでもあれば、書いた人の言葉がある。記号（▲ ↑ | ・）だけなら飾り。 */
const WORD = /[\p{L}\p{N}]/u;

const WRAPPERS = new Set(["strong", "emphasis", "delete"]);

const pointsInPage = (url: string | undefined): boolean => (url ?? "").startsWith("#");

export const inPageAnchors = (root: NavNode): InPageAnchors => {
  const found = new Set<string>();
  eachPreOrder(root, (node) => {
    if (node.type === "definition" && node.identifier !== undefined && pointsInPage(node.url)) found.add(node.identifier);
  });
  return found;
};

const isInPageLink = (node: NavNode, anchors: InPageAnchors): boolean =>
  (node.type === "link" && pointsInPage(node.url)) || (node.type === "linkReference" && anchors.has(node.identifier ?? ""));

/** What must also be a part for this node to be one: nothing for a link or symbols, the children of emphasis. undefined when it is prose. */
const partsWithin = (node: NavNode, anchors: InPageAnchors): readonly NavNode[] | undefined => {
  if (isInPageLink(node, anchors) || node.type === "break") return [];
  if (node.type === "text") return WORD.test(node.value ?? "") ? undefined : [];
  return WRAPPERS.has(node.type) ? (node.children ?? []) : undefined;
};

const isNavigationPart = (node: NavNode, anchors: InPageAnchors): boolean => {
  const pending: NavNode[] = [node];
  while (pending.length > 0) {
    const next = pending.pop();
    const within = next === undefined ? [] : partsWithin(next, anchors);
    if (within === undefined) return false;
    within.forEach((child) => pending.push(child));
  }
  return true;
};

const containsInPageLink = (node: NavNode, anchors: InPageAnchors): boolean => {
  const pending: NavNode[] = [node];
  while (pending.length > 0) {
    const next = pending.pop();
    if (next !== undefined && isInPageLink(next, anchors)) return true;
    (next?.children ?? []).forEach((child) => pending.push(child));
  }
  return false;
};

/**
 * 同じページの中へのリンク（`](#…)`）と記号だけでできた段落。「▲ 目次に戻る」や目次の項目で、本文ではなくページの案内。
 * 言葉が 1 つでも混ざれば本文（「詳しくは[第3章](#第3章)を参照」）。他のページへのリンクは書いた人が選んだ一覧なので残す。
 */
export const isInPageNavigation = (paragraph: NavNode, anchors: InPageAnchors = new Set()): boolean => {
  const children = paragraph.children ?? [];
  return (
    paragraph.type === "paragraph" &&
    children.every((child) => isNavigationPart(child, anchors)) &&
    children.some((child) => containsInPageLink(child, anchors))
  );
};

/** The blocks inside a list's items, or undefined unless it is a list whose every item holds a block. */
const itemBlocks = (list: NavNode): readonly NavNode[] | undefined => {
  const items = list.children ?? [];
  if (list.type !== "list" || items.length === 0) return undefined;
  const blocks = items.map((item) => (item.type === "listItem" ? (item.children ?? []) : []));
  return blocks.some((children) => children.length === 0) ? undefined : blocks.flat();
};

/**
 * 項目がどれもページの案内（入れ子も含む）の箇条書き。目次の項目の数は節の数で決まり、書いた人が選んだ並べ方ではない。
 * 項目の中の段落はページの案内の段落で、段落でない塊は、それ自身がページの案内の箇条書き。
 */
export const isNavigationList = (list: NavNode, anchors: InPageAnchors = new Set()): boolean => {
  const pending: NavNode[] = [list];
  while (pending.length > 0) {
    const next = pending.pop();
    const blocks = next === undefined ? [] : itemBlocks(next);
    if (blocks === undefined) return false;
    if (!blocks.every((block) => block.type !== "paragraph" || isInPageNavigation(block, anchors))) return false;
    blocks.filter((block) => block.type !== "paragraph").forEach((block) => pending.push(block));
  }
  return true;
};
