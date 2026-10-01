import type { Texts } from "../ui.ts";
import type { LengthUnit } from "../plugin.ts";
import { counted } from "../render/plural.ts";

export type OutlineText = {
  readonly usage: string;
  /** How a length is written: 120 字 / 120 words. */
  readonly length: (count: number, unit: LengthUnit) => string;
  /** The text before the first heading, in place of a heading. */
  readonly lead: string;
  readonly headings: string;
  readonly averageSection: string;
  readonly lists: string;
  readonly bold: string;
  readonly separator: string;
  /** The line that names the file and gives its shape. */
  readonly shapeOf: (path: string, measures: string) => string;
  readonly measure: (name: string, value: string) => string;
  /** The heading of the before/after block. */
  readonly changed: (before: string, after: string) => string;
};

export const OUTLINE_TEXT: Texts<OutlineText> = {
  ja: {
    usage: "使い方: chaff outline <file> [<書き直した後>] [--compact | --json] [--language ja|en|…] [--genre <ジャンル>]",
    length: (count, unit) => (unit === "char" ? `${String(count)} 字` : `${String(count)} 語`),
    lead: "（最初の見出しの前）",
    headings: "見出し",
    averageSection: "節の平均",
    lists: "箇条書き",
    bold: "太字",
    separator: "、",
    shapeOf: (path, measures) => `${path} の構成: ${measures}`,
    measure: (name, value) => `${name} ${value}`,
    changed: (before, after) => `構成の変化（${before} → ${after}）`,
  },
  en: {
    usage: "usage: chaff outline <file> [<rewritten>] [--compact | --json] [--language ja|en|…] [--genre <genre>]",
    length: (count, unit) => (unit === "char" ? counted(count, "character") : counted(count, "word")),
    lead: "(before the first heading)",
    headings: "headings",
    averageSection: "average section",
    lists: "in lists",
    bold: "bold",
    separator: ", ",
    shapeOf: (path, measures) => `${path} outline: ${measures}`,
    measure: (name, value) => `${name} ${value}`,
    changed: (before, after) => `How the shape changed (${before} → ${after})`,
  },
};
