import { withoutFences } from "./acronym-expansion.ts";

/** 箇条書きの項目の行。字下げの幅と、印の後ろの文。 */
const LIST_ITEM = /^(?<indent>[ \t]*)(?:[-*+]|\d+[.)])\s+(?<text>(?:\S.*)?)$/u;
const ITEM_ACRONYM = /(?<![\p{L}\p{N}_&])(?<acronym>[A-Z]{2,10})s?(?![\p{L}\p{N}_&])/gu;
/** 親の項目の名前の語の短さの下限。of や to の頭文字は、2 字の略語にたまたま揃いやすい。 */
const MIN_PARENT_WORD = 3;

type ListItem = { readonly text: string; readonly children: string };

const indentOf = (line: string): number => (/^[ \t]*/u.exec(line)?.[0] ?? "").length;

/** at から始まる項目の、自分の文（続きの行も）と、それより深く字下げした子の項目の文。 */
const itemAt = (lines: readonly string[], at: number): ListItem | undefined => {
  const item = LIST_ITEM.exec(lines[at] ?? "")?.groups;
  if (item === undefined) return undefined;
  const indent = (item["indent"] ?? "").length;
  const endIndex = lines.findIndex((line, index) => index > at && line.trim() !== "" && indentOf(line) <= indent);
  const block = lines.slice(at + 1, endIndex === -1 ? lines.length : endIndex);
  const firstChild = block.findIndex((line) => LIST_ITEM.test(line));
  const own = firstChild === -1 ? block : block.slice(0, firstChild);
  const children = firstChild === -1 ? [] : block.slice(firstChild);
  return { text: [item["text"] ?? "", ...own].join(" "), children: children.join("\n") };
};

/** リンクの行き先と URL。アドレスの語（…/cross-project-council/…）は、書き手が書いた名前ではない。 */
const LINK_TARGET = /\]\([^()\s]*\)/gu;
const BARE_URL = /\bhttps?:\/\/\S+/gu;

const withoutAddresses = (text: string): string => text.replace(LINK_TARGET, "]").replace(BARE_URL, " ");

/** 文の中に、略語の文字を頭文字に持つ語が続けて並ぶか（product owner → PO）。大文字小文字を問わず、短い語は数えない。 */
const spelledByRun = (text: string, acronym: string): boolean => {
  const letters = [...acronym.toLowerCase()];
  const words =
    withoutAddresses(text)
      .toLowerCase()
      .match(/\p{L}+/gu) ?? [];
  const runStartsAt = (start: number): boolean =>
    letters.every((letter, offset) => {
      const word = words[start + offset] ?? "";
      return word.length >= MIN_PARENT_WORD && word.startsWith(letter);
    });
  return words.some((_, start) => runStartsAt(start));
};

/**
 * 子の項目で使う略語のうち、親の項目がその名前を書き出しているもの（- **No product owner:** … の下の - Unavailable PO: …）。
 * 入れ子の箇条書きでは、親の項目が子の項目の話題を名指すので、親の語の頭文字が略語と揃えば展開と読む。
 */
export const parentItemAcronyms = (source: string): ReadonlySet<string> => {
  const lines = withoutFences(source.split(/\r?\n/u));
  return new Set(
    lines.flatMap((_, index) => {
      const item = itemAt(lines, index);
      if (item === undefined || item.children === "") return [];
      return [...item.children.matchAll(ITEM_ACRONYM)].map((match) => match.groups?.["acronym"] ?? "").filter((acronym) => spelledByRun(item.text, acronym));
    }),
  );
};
