import type { Sentence, Span } from "../plugin.ts";

// 箇条書きの項目の文が、どの導入の文の下にあるか。「(3) If … no such resolution is made—\n(a) the Commissioner must issue …」の
// (a) は (3) の条件の下にあり、(a) だけを読むと条件が落ちる。

/** 導入の文の終わり。この後に項目が並ぶ（"must include—"、"is made:"、「承認した場合：」）。 */
const LEAD_IN_END = /[:：—–]\s*$/u;

/** 空行。そこで段落が改まり、導入はそこを越えて探さない。 */
const BLANK_LINE = /\n[^\S\n]*\n/u;

/** 項目の頭の印: 開き括弧、番号か記号（囲み数字や仮名は 1 字）、閉じ括弧か点。 */
const MARKER = /^\s*([(（［[]?)([0-9０-９]+|[a-zA-Zａ-ｚＡ-Ｚ]+|[一二三四五六七八九十]+|\S)([)）］\].．]?)/u;

/** 1 字のローマ数字。英字の並び（(h) の次の (i)）でもありうる。 */
const SINGLE_ROMAN = /^[ivxIVX]$/u;
const ROMAN = /^(?:[ivxlc]{2,}|[IVXLC]{2,})$/u;

const labelClass = (label: string): string => {
  if (/^[0-9０-９]+$/u.test(label)) return "1";
  if (ROMAN.test(label) || SINGLE_ROMAN.test(label)) return /[a-z]/u.test(label) ? "i" : "I";
  if (/^[a-zａ-ｚ]+$/u.test(label)) return "a";
  if (/^[A-ZＡ-Ｚ]+$/u.test(label)) return "A";
  if (/^[一二三四五六七八九十]+$/u.test(label)) return "一";
  if (/^[\p{Script=Katakana}\p{Script=Hiragana}]$/u.test(label)) return "イ";
  if (/^[①-⑳㉑-㉟㊱-㊿]$/u.test(label)) return "①";
  if (/^[⑴-⒇]$/u.test(label)) return "⑴";
  return label;
};

/** 項目の文の頭の印の範囲（"(a)"、"①"）。番号は文の中身ではない。項目の文でなければ undefined。 */
export const itemMarkerSpan = (sentence: Sentence): Span | undefined => {
  const match = sentence.listItem === true ? MARKER.exec(sentence.text) : null;
  return match === null ? undefined : { start: sentence.span.start, end: sentence.span.start + match[0].length };
};

const previousLetter = (label: string): string => String.fromCharCode(label.charCodeAt(0) - 1);

/**
 * 項目の印の形（"(1)"、"(a)"、"(i)"、"①"、"・"）。番号そのものは数えない。
 * 1 字の i・v・x は、同じ括弧の英字の項目がその前の字（h・u・w）で終わっていれば英字、でなければローマ数字。
 */
export const markerShape = (text: string, lastLetters: ReadonlyMap<string, string>): { readonly shape: string; readonly letter?: string } | undefined => {
  const match = MARKER.exec(text);
  const [, open = "", label, close = ""] = match ?? [];
  if (label === undefined) return undefined;
  const letterShape = `${open}${/[a-z]/u.test(label) ? "a" : "A"}${close}`;
  const continuesLetters = SINGLE_ROMAN.test(label) && lastLetters.get(letterShape) === previousLetter(label);
  const shape = continuesLetters ? letterShape : `${open}${labelClass(label)}${close}`;
  return shape === letterShape ? { shape, letter: label } : { shape };
};

type Entry = { readonly sentence: Sentence; readonly leadIns: readonly Sentence[] };

/** 段落の中で、いま開いている項目の形ごとの最後の項目と、最後の導入の文。 */
type Block = {
  readonly lastByShape: Map<string, { readonly at: number; readonly entry: Entry }>;
  readonly lastLetters: Map<string, string>;
  leadIn: { readonly at: number; readonly entry: Entry } | undefined;
};

const newBlock = (): Block => ({ lastByShape: new Map(), lastLetters: new Map(), leadIn: undefined });

/** 項目の導入の文: 同じ形の前の項目（兄弟）が導入より後にあればその導入、無ければ最後の導入の文とその導入。 */
const leadInsOf = (block: Block, shape: string): readonly Sentence[] => {
  const sibling = block.lastByShape.get(shape);
  const leadIn = block.leadIn;
  if (sibling !== undefined && (leadIn === undefined || sibling.at >= leadIn.at)) return sibling.entry.leadIns;
  return leadIn === undefined ? [] : [leadIn.entry.sentence, ...leadIn.entry.leadIns];
};

/**
 * 箇条書きの項目の文（listItem）ごとの、導入の文。近い順で、導入が項目なら、その導入も続ける。
 * 導入は、同じ段落（空行を挟まない）の前の文で、「—」「:」「：」で終わるもの。同じ形の項目どうしは同じ導入の下にある。
 * sentences は文書の順。source は sentences の span の座標の文字列。
 */
export const listLeadIns = (source: string, sentences: readonly Sentence[]): Map<Sentence, readonly Sentence[]> => {
  const found = new Map<Sentence, readonly Sentence[]>();
  let block = newBlock();
  sentences.forEach((sentence, at) => {
    const previous = sentences[at - 1];
    if (previous !== undefined && BLANK_LINE.test(source.slice(previous.span.end, sentence.span.start))) block = newBlock();
    const marker = sentence.listItem === true ? markerShape(sentence.text, block.lastLetters) : undefined;
    const entry: Entry = { sentence, leadIns: marker === undefined ? [] : leadInsOf(block, marker.shape) };
    if (marker !== undefined) {
      found.set(sentence, entry.leadIns);
      block.lastByShape.set(marker.shape, { at, entry });
      if (marker.letter !== undefined) block.lastLetters.set(marker.shape, marker.letter.at(-1) ?? "");
    }
    if (LEAD_IN_END.test(sentence.text)) block.leadIn = { at, entry };
  });
  return found;
};
