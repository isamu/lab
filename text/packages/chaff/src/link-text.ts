// リンクの言葉（`[こちら](url)` の「こちら」）を読む。純粋な関数だけを置く。

/** `[` から、対応する `]` の位置。入れ子の角括弧（`[a [b] c]`）を数える。閉じなければ undefined。 */
const closingBracket = (written: string): number | undefined => {
  let depth = 0;
  for (const [at, char] of [...written].entries()) {
    if (char === "[") depth += 1;
    if (char === "]") depth -= 1;
    if (depth === 0) return at;
  }
  return undefined;
};

/**
 * インラインのリンク（`[言葉](行き先)`）の言葉。参照の定義（`[1]: url`）と自動リンク（`<https://…>`）は言葉を持たないので undefined。
 * 位置は字（コードポイント）で数える。
 */
export const linkTextOf = (written: string): string | undefined => {
  if (!written.startsWith("[")) return undefined;
  const close = closingBracket(written);
  const chars = [...written];
  if (close === undefined || chars[close + 1] !== "(") return undefined;
  return chars.slice(1, close).join("");
};

/** 言葉を包む強調の印と鉤括弧（前後とも）、終わりの句読点（後ろだけ）。「**こちら**」も「こちら。」も「こちら」と読む。 */
const LEADING = new Set(" \t\n*_「『\"“'");
const TRAILING = new Set([...LEADING, ..."」』”。．.、，,!！?？:："]);

const trimmed = (chars: readonly string[]): string => {
  const start = chars.findIndex((char) => !LEADING.has(char));
  if (start === -1) return "";
  return chars.slice(start, chars.findLastIndex((char) => !TRAILING.has(char)) + 1).join("");
};

/** Markdown の逃がし（`here\\.`）。字はそのまま見えるので、逃がしの印だけを外す。 */
const ESCAPED = /\\(\p{P})/gu;

/** 見せる形。逃がしの印と、強調と鉤括弧と終わりの句読点を外し、空白をまとめる。コードの印（`）は外さない。コードの言葉は語ではない。 */
export const bareLinkText = (text: string): string => trimmed([...text.replace(ESCAPED, "$1")]).replace(/\s+/gu, " ");

/** 比べる形。見せる形を小文字にしたもの。 */
export const comparableLinkText = (text: string): string => bareLinkText(text).toLowerCase();

/** リンクの言葉が、それだけでは行き先を言わない言葉（語彙表の語）そのものか。言葉の一部に含むだけ（「料金表はこちら」）なら違う。 */
export const isVagueLinkText = (text: string, vague: ReadonlySet<string>): boolean => vague.has(comparableLinkText(text));
