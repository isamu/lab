import type { LengthUnit } from "../plugin.ts";

/** 語句を数える単位に分ける。英語は語、日本語は文字。 */
const unitsOf = (key: string, unit: LengthUnit): string[] => (unit === "char" ? [...key] : key.split(" "));

const joinUnits = (units: readonly string[], unit: LengthUnit): string => units.join(unit === "char" ? "" : " ");

/** 中身のある部分か。日本語は漢字か片仮名が 2 字続く（併記、ボタン）。英語は 2 語以上（create a ConfigMap）。 */
const CONTENT_RUN = /[\p{Script=Han}\p{Script=Katakana}ー]{2}/u;

const hasContent = (units: readonly string[], unit: LengthUnit): boolean => (unit === "char" ? CONTENT_RUN.test(units.join("")) : units.length >= 2);

/** units の連続する部分のうち、title にあって中身のある一番長いものの長さ（文字の数）。 */
const longestNamedRun = (units: readonly string[], title: string, unit: LengthUnit): number => {
  const runs = units.flatMap((_, start) => units.slice(start + 1).map((__, offset) => units.slice(start, start + offset + 2)));
  const named = runs.filter((run) => hasContent(run, unit) && title.includes(joinUnits(run, unit)));
  return Math.max(0, ...named.map((run) => [...joinUnits(run, unit)].length));
};

/**
 * 見出しが名付けた句か。語句の文字の過半が、見出しにある中身のある一続きの句（to create a ConfigMap の create a ConfigMap、
 * 氏を併記した氏名 の 氏を併記した）。窓の幅は決まっているので、本文が見出しの句に前置詞や後ろの名詞を付けて使うと、窓は見出しの
 * 句からはみ出す。文字で測るので、短い機能語だけの一続き（How you will be evaluated の will be）では過半に届かない。
 * 題と見出しにある句は文書の主題で、名前と同じく、それに付いた語句も数えない。title は見出しを並べた文字列。
 */
export const namedByHeading = (key: string, title: string, unit: LengthUnit): boolean =>
  title.includes(key) || longestNamedRun(unitsOf(key, unit), title, unit) * 2 > [...key].length;
