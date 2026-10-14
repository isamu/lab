import { escapeRegExp } from "../orthography.ts";

/**
 * 行頭の、文字で振った見出しの番号（議事録の Z. の次の AA.、AB. … BZ.）。表計算の列名と同じく A〜Z の次は AA と進む。
 * 略語ではない。行頭で . か ) が続き、その前か後の番号も同じ文書の行頭にあるときだけ番号と読む。1 か所だけの
 * 行頭の大文字（IT. の説明、FAQ) の行）は略語のまま数える。そう読めた番号を区切りの名前の後ろで指す所（See Attachment AA）も
 * 番号。区切りの名前は言語パッケージの語彙表から読む。
 */

type Span = { readonly start: number; readonly end: number };

const LABEL = /^[ \t]*(?<label>[A-Z]{1,3})[.)](?=[ \t]|$)/gmu;
const ALPHABET = 26;
const CODE_BEFORE_A = 64;

/** A=1、Z=26、AA=27、AZ=52、BA=53。 */
const positionOf = (label: string): number => [...label].reduce((total, letter) => total * ALPHABET + (letter.charCodeAt(0) - CODE_BEFORE_A), 0);

type Label = { readonly text: string; readonly position: number; readonly span: Span };

const labelsOf = (source: string): Label[] =>
  [...source.matchAll(LABEL)].map((match) => {
    const text = match.groups?.["label"] ?? "";
    const start = match.index + match[0].indexOf(text);
    return { text, position: positionOf(text), span: { start, end: start + text.length } };
  });

const lineLabels = (source: string): Label[] => {
  const labels = labelsOf(source);
  const positions = new Set(labels.map((label) => label.position));
  return labels.filter(({ position }) => positions.has(position - 1) || positions.has(position + 1));
};

const referenceSpans = (source: string, labels: readonly Label[], divisions: readonly string[]): Span[] => {
  const texts = [...new Set(labels.map((label) => label.text))];
  if (texts.length === 0 || divisions.length === 0) return [];
  const pattern = new RegExp(String.raw`(?<![A-Za-z0-9_])(?:${divisions.map(escapeRegExp).join("|")})\s+(?<label>${texts.join("|")})(?![A-Za-z0-9_&])`, "gu");
  return [...source.matchAll(pattern)].map((match) => {
    const end = match.index + match[0].length;
    return { start: end - (match.groups?.["label"] ?? "").length, end };
  });
};

/** 文書の中の、隣の番号と並んだ文字の番号と、それを区切りの名前の後ろで指す所の範囲。位置は文書の頭からの文字数。 */
export const outlineLabelSpans = (source: string, divisions: readonly string[]): Span[] => {
  const labels = lineLabels(source);
  return [...labels.map((label) => label.span), ...referenceSpans(source, labels, divisions)];
};
