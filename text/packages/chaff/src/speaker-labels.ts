import type { Span } from "./plugin.ts";

/**
 * 戯曲・台本・議事録・書き起こしの、話し手の名前（`ALGERNON.`、行頭の `夫` と全角空白、`○事務局`）。
 * 名前は誰が話すかの印であって本文ではない。文として数えると、名前だけの文が増え、名前が固有名詞と言い回しの繰り返しに入る。
 *
 * 形だけで決める。同じ形の行頭の名前が、MIN_SPEAKERS 人以上それぞれ MIN_TURNS 回以上繰り返され、どれも後に発言が続く。
 * 1 つの名前の繰り返しは見出し（○ と全角空白の後の「注意事項」）、繰り返されない名前は偶然なので、話し手と読まない。
 * そう読めた形では、1 度しか話さない人の名前も話し手の名前とする（議事録の委員）。
 */

/** 話し手と読むのに要る、繰り返す名前の数。 */
const MIN_SPEAKERS = 2;
/** 名前が繰り返されたと読む回数。 */
const MIN_TURNS = 3;

type Candidate = { readonly shape: string; readonly name: string; readonly span: Span };

/** 名前の後の発言が、同じ行にあるか（inline）、次の行にあるか（alone）。 */
type Shape = { readonly id: string; readonly pattern: RegExp; readonly alone: boolean };

/**
 * 英語の名前は大文字で書いたものだけ（ALGERNON、LADY BRACKNELL、Mr. SMITH）。
 * 大文字小文字まじりの「Title:」「Notes:」「Content-Type:」は、記録や表の項目の名前と形が同じで、見分けられない。
 */
const CAPS_WORD = String.raw`[A-Z][A-Z'’&-]*\.?`;
const CAPS_NAME = String.raw`(?:[A-Z][a-z]{1,3}\. )?${CAPS_WORD}(?: ${CAPS_WORD}){0,3}`;
/** 日本語の名前に入らない文字。空白、括弧、句読点、かぎ括弧、コロン。 */
const JA_NAME = String.raw`[^\s\u3000（）()、。，．「」『』:：]`;

/** 各 pattern の 1 番目の組が行頭の空白、2 番目が覆う範囲、`name` の組が名前。 */
const SHAPES: readonly Shape[] = [
  { id: "caps", pattern: new RegExp(String.raw`^(\s*)((?<name>${CAPS_NAME})[.:]?)\s*$`, "u"), alone: true },
  { id: "caps", pattern: new RegExp(String.raw`^(\s*)((?<name>${CAPS_NAME})[.:])\s+\S`, "u"), alone: false },
  { id: "mark", pattern: new RegExp(String.raw`^([ \t\u3000]*)([○◯〇](?<name>${JA_NAME}{1,20})(?:（[^）\n]*）)?)[ \t\u3000]*$`, "u"), alone: true },
  { id: "mark", pattern: new RegExp(String.raw`^([ \t\u3000]*)([○◯〇](?<name>${JA_NAME}{1,20})(?:（[^）\n]*）)?\u3000+)\S`, "u"), alone: false },
  { id: "spaced", pattern: new RegExp(String.raw`^([ \t]*)((?<name>${JA_NAME}{1,10})\u3000+)\S`, "u"), alone: false },
  { id: "quote", pattern: new RegExp(String.raw`^([ \t]*)((?<name>${JA_NAME}{1,10}))[ \t]*「`, "u"), alone: false },
];

/**
 * 名前でないもの。番号（数字・漢数字・ローマ数字・「第」で始まる序数・1 字の仮名）は見出しや項目の印で、話し手ではない。
 * 助詞で終わる語は地の文の主語（「私は「…」」）。英字 1 字は、名前より略語や項目の印が多い。
 */
const NUMERAL = /^[\d０-９一二三四五六七八九十百千〇IVXLCDM]+(?:の[\d０-９一二三四五六七八九十百千〇]+)*$/u;
const ORDINAL = /^第[\d０-９一二三四五六七八九十百千〇]/u;
const DIGIT = /[\d０-９]/u;
const SINGLE_KANA = /^[\p{Script=Hiragana}\p{Script=Katakana}]$/u;
const LETTER = /\p{L}/u;
const PARTICLE_END = /[はがもをにへとでやの]$/u;

const isName = (shape: string, name: string): boolean =>
  LETTER.test(name) &&
  !NUMERAL.test(name.replace(/[\s.'’&-]/gu, "")) &&
  !ORDINAL.test(name) &&
  !DIGIT.test(name) &&
  !SINGLE_KANA.test(name) &&
  !(shape === "quote" && PARTICLE_END.test(name)) &&
  !(shape === "caps" && name.replace(/[^A-Z]/gu, "").length < 2);

type Line = { readonly start: number; readonly text: string };

const linesOf = (text: string): Line[] => {
  const scan = { start: 0 };
  return text.split("\n").map((raw) => {
    const line = { start: scan.start, text: raw.replace(/\r$/u, "") };
    scan.start += raw.length + 1;
    return line;
  });
};

const isBlank = (line: Line | undefined): boolean => line === undefined || line.text.trim() === "";

/** 名前だけの行は、次の行に発言があるときだけ話し手の名前（空行の後の大文字の行は見出し）。 */
const candidateOf = (lines: readonly Line[], index: number): Candidate | undefined => {
  const line = lines[index];
  if (line === undefined) return undefined;
  return SHAPES.flatMap((shape) => {
    const match = shape.pattern.exec(line.text);
    const lead = match?.[1];
    const label = match?.[2];
    const name = match?.groups?.["name"]?.replace(/[.:]$/u, "");
    if (lead === undefined || label === undefined || name === undefined || !isName(shape.id, name)) return [];
    if (shape.alone && isBlank(lines[index + 1])) return [];
    const start = line.start + lead.length;
    return [{ shape: shape.id, name, span: { start, end: start + label.length } }];
  })[0];
};

const countBy = <T>(items: readonly T[], keyOf: (item: T) => string): Map<string, number> =>
  items.reduce((counts, item) => counts.set(keyOf(item), (counts.get(keyOf(item)) ?? 0) + 1), new Map<string, number>());

const speakerKey = (candidate: Candidate): string => `${candidate.shape}\n${candidate.name}`;

/** 形ごとに、MIN_TURNS 回以上出る名前が MIN_SPEAKERS 人以上いるか。 */
const dialogueShapes = (candidates: readonly Candidate[]): Set<string> => {
  const turns = countBy(candidates, speakerKey);
  const speakers = [...new Map(candidates.map((candidate) => [speakerKey(candidate), candidate])).values()];
  const repeated = speakers.filter((speaker) => (turns.get(speakerKey(speaker)) ?? 0) >= MIN_TURNS);
  const perShape = countBy(repeated, (speaker) => speaker.shape);
  return new Set([...perShape].filter(([, count]) => count >= MIN_SPEAKERS).map(([shape]) => shape));
};

/** text の中の話し手の名前の範囲。発言は含まない。 */
export const speakerLabels = (text: string): Span[] => {
  const lines = linesOf(text);
  const candidates = lines.flatMap((_, index) => candidateOf(lines, index) ?? []);
  const shapes = dialogueShapes(candidates);
  return candidates.filter((candidate) => shapes.has(candidate.shape)).map((candidate) => candidate.span);
};
