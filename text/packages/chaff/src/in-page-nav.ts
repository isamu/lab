/** mdast の節のうち、ページ内の案内かどうかの判定に要る部分だけ。 */
export type InlineNode = {
  readonly type: string;
  readonly url?: string | undefined;
  readonly value?: string | undefined;
  readonly children?: readonly InlineNode[] | undefined;
};

/** 文字か数字。これが 1 つでもあれば、書いた人の言葉がある。記号（▲ ↑ | ・）だけなら飾り。 */
const WORD = /[\p{L}\p{N}]/u;

const WRAPPERS = new Set(["strong", "emphasis", "delete"]);

const isInPageLink = (node: InlineNode): boolean => node.type === "link" && (node.url ?? "").startsWith("#");

const isNavigationPart = (node: InlineNode): boolean => {
  if (isInPageLink(node) || node.type === "break") return true;
  if (node.type === "text") return !WORD.test(node.value ?? "");
  return WRAPPERS.has(node.type) && (node.children ?? []).every(isNavigationPart);
};

const containsInPageLink = (node: InlineNode): boolean => isInPageLink(node) || (node.children ?? []).some(containsInPageLink);

/**
 * 同じページの中へのリンク（`](#…)`）と記号だけでできた段落。「▲ 目次に戻る」や目次の項目で、本文ではなくページの案内。
 * 言葉が 1 つでも混ざれば本文（「詳しくは[第3章](#第3章)を参照」）。他のページへのリンクは書いた人が選んだ一覧なので残す。
 */
export const isInPageNavigation = (paragraph: InlineNode): boolean => {
  const children = paragraph.children ?? [];
  return paragraph.type === "paragraph" && children.every(isNavigationPart) && children.some(containsInPageLink);
};
