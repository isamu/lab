import type { Texts } from "../ui.ts";
import type { AtomKind, UnreadReason } from "./atom.ts";
import { counted } from "../render/plural.ts";

export type CompareText = {
  readonly usage: string;
  readonly unknownKind: (kind: string, kinds: string) => string;
  /** A kind counted (numbers 3→3) and a kind of one fact (number: 1,000円). */
  readonly kinds: Readonly<Record<AtomKind, string>>;
  readonly kind: Readonly<Record<AtomKind, string>>;
  readonly unread: (kind: AtomKind, reason: UnreadReason) => string;
  readonly unreadHeading: string;
  readonly droppedHeading: (count: number, before: string, after: string) => string;
  readonly addedHeading: (count: number, after: string) => string;
  readonly reformedHeading: (count: number) => string;
  readonly allowed: (flag: string) => string;
  readonly lines: (before: number, after: number) => string;
  readonly checked: (before: number, after: number, perKind: string) => string;
  readonly separator: string;
  readonly clean: string;
  readonly failed: (dropped: number, added: number) => string;
  /** The tally of the compact output. */
  readonly tally: (dropped: number, added: number, reformed: number) => string;
};

const KINDS_JA: Readonly<Record<AtomKind, string>> = {
  number: "数",
  date: "日付",
  time: "時刻",
  url: "URL",
  code: "コード",
  name: "固有名詞",
  quote: "引用",
  heading: "見出し",
  reference: "条項の参照",
  footnote: "脚注",
};

const KINDS_EN: Readonly<Record<AtomKind, string>> = {
  number: "numbers",
  date: "dates",
  time: "times",
  url: "URLs",
  code: "code",
  name: "names",
  quote: "quotations",
  heading: "headings",
  reference: "references",
  footnote: "footnotes",
};

const KIND_EN: Readonly<Record<AtomKind, string>> = {
  number: "number",
  date: "date",
  time: "time",
  url: "URL",
  code: "code",
  name: "name",
  quote: "quotation",
  heading: "heading",
  reference: "reference",
  footnote: "footnote",
};

const UNREAD_JA: Readonly<Record<UnreadReason, (kind: AtomKind) => string>> = {
  "no-structure": (kind) =>
    kind === "number" ? "言語パッケージが単位を読まないので、数字だけを比べました" : "言語パッケージが文書の構造を読まないので、読んでいません",
  "no-dates": () => "言語パッケージが日付を読まないので、数字だけで書いた日付（2026-04-01）だけを比べました",
  "no-pos": () => "品詞を読む解析器が無いので、chaff.yaml の names: だけを比べました",
  "plain-text": () => "Markdown ではないので、コードの記法がありません",
};

const UNREAD_EN: Readonly<Record<UnreadReason, (kind: AtomKind) => string>> = {
  "no-structure": (kind) =>
    kind === "number"
      ? "the language package reads no units, so only the figures were compared"
      : "the language package reads no document structure, so none were read",
  "no-dates": () => "the language package reads no dates, so only dates written in figures (2026-04-01) were compared",
  "no-pos": () => "there is no part-of-speech tagger, so only chaff.yaml's names: were compared",
  "plain-text": () => "the document is not Markdown, so it has no code markup",
};

export const COMPARE_TEXT: Texts<CompareText> = {
  ja: {
    usage: "使い方: chaff compare <書き換える前> <書き換えた後> [--compact | --json] [--allow-dropped <種類>] [--allow-added <種類>] [--language ja|en|…]",
    unknownKind: (kind, kinds) => `知らない種類です: ${kind}（使えるのは ${kinds}）`,
    kinds: KINDS_JA,
    kind: KINDS_JA,
    unread: (kind, reason) => `${KINDS_JA[kind]}: ${UNREAD_JA[reason](kind)}`,
    unreadHeading: "読めなかったもの",
    droppedHeading: (count, before, after) => `✗ 落ちた事実 ${String(count)} 件（${before} にあって ${after} に無い）`,
    addedHeading: (count, after) => `✗ 足された事実 ${String(count)} 件（${after} にだけある）`,
    reformedHeading: (count) => `i 書き方だけ変わった事実 ${String(count)} 件`,
    allowed: (flag) => `（${flag} で許可）`,
    lines: (before, after) => `${String(before)} 行目 → ${String(after)} 行目`,
    checked: (before, after, perKind) => `照合した事実 ${String(before)} 件 → ${String(after)} 件: ${perKind}`,
    separator: "、",
    clean: "落ちた事実も足された事実もありません",
    failed: (dropped, added) => `落ちた事実 ${String(dropped)} 件、足された事実 ${String(added)} 件`,
    tally: (dropped, added, reformed) => `落ちた ${String(dropped)} 件、足された ${String(added)} 件、書き方だけ ${String(reformed)} 件`,
  },
  en: {
    usage: "usage: chaff compare <before> <after> [--compact | --json] [--allow-dropped <kind>] [--allow-added <kind>] [--language ja|en|…]",
    unknownKind: (kind, kinds) => `Unknown kind: ${kind} (the kinds are ${kinds})`,
    kinds: KINDS_EN,
    kind: KIND_EN,
    unread: (kind, reason) => `${KINDS_EN[kind]}: ${UNREAD_EN[reason](kind)}`,
    unreadHeading: "Not fully read",
    droppedHeading: (count, before, after) => `✗ ${counted(count, "fact")} dropped (in ${before}, not in ${after})`,
    addedHeading: (count, after) => `✗ ${counted(count, "fact")} added (only in ${after})`,
    reformedHeading: (count) => `i ${counted(count, "fact")} written another way`,
    allowed: (flag) => ` (allowed by ${flag})`,
    lines: (before, after) => `line ${String(before)} → line ${String(after)}`,
    checked: (before, after, perKind) => `Facts checked: ${String(before)} → ${String(after)}: ${perKind}`,
    separator: ", ",
    clean: "No fact dropped or added",
    failed: (dropped, added) => `${counted(dropped, "fact")} dropped, ${counted(added, "fact")} added`,
    tally: (dropped, added, reformed) => `${String(dropped)} dropped, ${String(added)} added, ${String(reformed)} written another way`,
  },
};
