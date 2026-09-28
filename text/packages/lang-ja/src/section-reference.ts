import type { Lexicon, Mention } from "chaffjs/plugin";
import { toHalfWidth } from "./numbers.ts";

// 算用数字で番号を振った文書の中の参照（「3.2節」「第3章」「3.2.1項」）。番地は木の通し番号（### 3.2 → 3.2）と同じにする。
// 漢数字の「第三章」「第二節」は法令の書き方で、法令の番地は章ごと・編ごとに振り直すので、ここでは読まない。

export type SectionVocabulary = {
  /** 番号の直前にあると番地でなくなる語（全3章・バージョン3.2）。 */
  readonly notBefore: readonly string[];
  /** 単位の字で始まる別の語（3.2節約・3項目）。 */
  readonly notAfter: readonly string[];
};

const patternsOf = (lexicon: Lexicon | undefined): string[] => (lexicon ?? []).map((entry) => entry.pattern);

export const sectionVocabulary = (lexicons: Readonly<Record<string, Lexicon>>): SectionVocabulary => ({
  notBefore: patternsOf(lexicons["not-section-before"]),
  notAfter: patternsOf(lexicons["not-section-after"]),
});

/** 部品は 3 桁まで・深さは 6 まで。木の通し番号と同じ上限。 */
const SECTION = /(?:第[ \u3000]?)?(?<n>[0-9０-９]{1,3}(?:[.．][0-9０-９]{1,3}){0,5})[ \u3000]?(?<unit>[章節項])/gu;

/** 番号の一部になる字が前にあれば、長い番号（2024.3.2）や版（v3.2）の途中。 */
const NUMBER_CHAR = /[0-9０-９.．A-Za-zＡ-Ｚａ-ｚ]/u;

/** 章は「3章」、節と項は「3.2節」「3.2.1項」。点の無い「2節」「第2項」は数か法令の番地で、点のある「3.2章」は書かない。 */
const hasDots = (unit: string): boolean => unit !== "章";

/** 行頭の「3.2節 データ」「3.2節（データ）」「### 3.2節」は、その行の見出しの番号。本文の「3.2節で述べた」は参照。 */
const isLineLabel = (text: string, start: number, end: number): boolean => /^[#\s]*$/u.test(text.slice(0, start)) && /^(?:[\s（(：:]|$)/u.test(text.slice(end));

/** 「全 3 章」のように数える語と番号のあいだに空白があっても、数える語。見る長さは語彙の語が収まる分だけ。 */
const BEFORE_WINDOW = 20;
const wordBefore = (text: string, start: number): string => text.slice(Math.max(0, start - BEFORE_WINDOW), start).trimEnd();

const blocked = (text: string, start: number, unitAt: number, vocabulary: SectionVocabulary): boolean =>
  NUMBER_CHAR.test(text[start - 1] ?? "") ||
  vocabulary.notBefore.some((word) => wordBefore(text, start).endsWith(word)) ||
  vocabulary.notAfter.some((word) => text.startsWith(word, unitAt));

/**
 * 「3.2節」→ 3.2、「第3章」「3章」→ ch3。見出し「## 第3章」は木に ch3 として入る。見出しを「## 3. 構成」と書く文書では 3 なので、それを fallback にする。
 * 他の文書の名前（民法第3章）は、条の参照と一緒に structure.ts が付ける。
 */
export const sectionReferences = (text: string, vocabulary: SectionVocabulary): Mention[] =>
  [...text.matchAll(SECTION)].flatMap((match) => {
    const groups = match.groups ?? {};
    const [written, unit] = [groups["n"] ?? "", groups["unit"] ?? ""];
    const number = toHalfWidth(written).replace(/．/gu, ".");
    const end = match.index + match[0].length;
    if (number.includes(".") !== hasDots(unit)) return [];
    if (blocked(text, match.index, end - unit.length, vocabulary) || isLineLabel(text, match.index, end)) return [];
    const address = unit === "章" ? { target: `ch${number}`, fallback: number } : { target: number };
    return [{ start: match.index, end, attrs: { ...address, label: match[0] } }];
  });
