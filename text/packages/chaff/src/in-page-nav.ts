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

const collectAnchors = (node: NavNode, found: Set<string>): void => {
  if (node.type === "definition" && node.identifier !== undefined && pointsInPage(node.url)) found.add(node.identifier);
  (node.children ?? []).forEach((child) => collectAnchors(child, found));
};

export const inPageAnchors = (root: NavNode): InPageAnchors => {
  const found = new Set<string>();
  collectAnchors(root, found);
  return found;
};

const isInPageLink = (node: NavNode, anchors: InPageAnchors): boolean =>
  (node.type === "link" && pointsInPage(node.url)) || (node.type === "linkReference" && anchors.has(node.identifier ?? ""));

const isNavigationPart = (node: NavNode, anchors: InPageAnchors): boolean => {
  if (isInPageLink(node, anchors) || node.type === "break") return true;
  if (node.type === "text") return !WORD.test(node.value ?? "");
  return WRAPPERS.has(node.type) && (node.children ?? []).every((child) => isNavigationPart(child, anchors));
};

const containsInPageLink = (node: NavNode, anchors: InPageAnchors): boolean =>
  isInPageLink(node, anchors) || (node.children ?? []).some((child) => containsInPageLink(child, anchors));

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

const isNavigationBlock = (node: NavNode, anchors: InPageAnchors): boolean => isInPageNavigation(node, anchors) || isNavigationList(node, anchors);

const isNavigationItem = (item: NavNode, anchors: InPageAnchors): boolean => {
  const children = item.children ?? [];
  return item.type === "listItem" && children.length > 0 && children.every((child) => isNavigationBlock(child, anchors));
};

/** 項目がどれもページの案内（入れ子も含む）の箇条書き。目次の項目の数は節の数で決まり、書いた人が選んだ並べ方ではない。 */
export const isNavigationList = (list: NavNode, anchors: InPageAnchors = new Set()): boolean => {
  const items = list.children ?? [];
  return list.type === "list" && items.length > 0 && items.every((item) => isNavigationItem(item, anchors));
};
