// Markdown turns a line break inside a paragraph into a space. Japanese has no spaces between words, so
// a paragraph written one sentence per line would show a stray space after each 。. This drops a line
// break when the characters on both sides are Japanese (or Japanese punctuation), and keeps it otherwise.
type Node = { type?: unknown; value?: unknown; children?: unknown };

const isNode = (value: unknown): value is Node => typeof value === "object" && value !== null;

const CJK_BREAK =
  /(?<=[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}　-〿＀-￯])\n(?=[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}　-〿＀-￯])/gu;

/** Pure: a text node's value with its Japanese-to-Japanese line breaks removed. */
export const joinCjkLines = (text: string): string => text.replace(CJK_BREAK, "");

const visit = (node: unknown): void => {
  if (!isNode(node)) return;
  if (node.type === "text" && typeof node.value === "string") node.value = joinCjkLines(node.value);
  if (Array.isArray(node.children)) node.children.forEach(visit);
};

/** A remark plugin: joins Japanese lines in every text node of the Markdown tree. */
export const remarkJoinCjkLines = () => (tree: unknown) => visit(tree);
