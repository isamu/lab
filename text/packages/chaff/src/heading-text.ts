/**
 * 見出しの末尾に付けた属性を外した、見出しの言葉。`## ステップ 1 {#step1}` は「ステップ 1」。
 * kramdown（`{#id}`、`{: .class}`）と pandoc（`{#id .class}`）の書き方。属性は読者に見えないので、
 * 残すと見出しの言い直しや番号の読み取りが、見えない文字に引きずられる。
 * 波括弧で終わっていても、中身が `#` `.` `:` で始まらないもの（`## {name} の設定`）は言葉のうち。
 */
export const headingText = (raw: string): string => {
  const trimmed = raw.trim();
  if (!trimmed.endsWith("}")) return trimmed;
  const open = trimmed.lastIndexOf("{");
  if (open === -1) return trimmed;
  const inner = trimmed.slice(open + 1, -1).trimStart();
  const isAttributes = inner.startsWith("#") || inner.startsWith(".") || inner.startsWith(":");
  return isAttributes ? trimmed.slice(0, open).trim() : trimmed;
};
