import type { StructureNode } from "../plugin.ts";
import type { StructureIssue } from "./issues.ts";

/**
 * 参照に添えた言葉と、参照先の中身。
 * 名前: 参照のすぐ後ろの括弧か引用符の中（「第2章「料金」」「第5条（秘密保持）」"Section 2 (Pricing)"）。参照先の見出しと、どちらかが
 * どちらかを含めば合う。合わなければ、番号か名前のどちらかが古い。
 * 話題: 参照のすぐ後ろの「で述べた」「に定める」"for" に続く語（「第2章で述べた料金体系」"see Section 2 for pricing"）。
 * 参照先の見出しにも本文にも無ければ言う。
 * どちらも、参照先がちょうど一つに決まり、見出しを持つときだけ見る。
 */
export type ReferenceWords = {
  /** 括弧の中に書いても名前ではない語（参照、上記、above）。 */
  readonly asides: readonly string[];
  /** 参照と話題のあいだの言い回し（で述べた、for）。 */
  readonly topicLinks: readonly string[];
  /** 話題にならない語（詳細、内容、details）。どの節にも当てはまる。 */
  readonly vagueTopics: readonly string[];
};

export type ReferenceInput = {
  readonly source: string;
  readonly references: readonly StructureNode[];
  readonly targetOf: (reference: StructureNode) => StructureNode | undefined;
  readonly words: ReferenceWords;
};

const OPENERS: Readonly<Record<string, string>> = { "(": ")", "（": "）", "「": "」", "『": "』", '"': '"', "“": "”", "‘": "’" };
const MAX_NAME = 30;
const DIGIT = /\p{N}/u;
const LETTER = /\p{L}/u;
const SPACE_BEFORE = /^[ \t\u3000]?/u;

const normalized = (text: string): string =>
  text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s・·]/gu, "");

const headingOf = (node: StructureNode): string => String(node.attrs["heading"] ?? "");

/** 参照のすぐ後ろの、括弧か引用符の中。 */
const nameAfter = (source: string, end: number): { name: string; at: number } | undefined => {
  const gap = SPACE_BEFORE.exec(source.slice(end))?.[0].length ?? 0;
  const opener = source.charAt(end + gap);
  const closer = OPENERS[opener];
  if (closer === undefined) return undefined;
  const from = end + gap + 1;
  const close = source.slice(from, from + MAX_NAME + 1).indexOf(closer) + from;
  if (close < from) return undefined;
  return { name: source.slice(from, close).trim(), at: from };
};

/** 項や号の札（(a)、(ii)、（イ））。名前ではなく、参照の続き。 */
const ITEM_LABEL = /^(?:[a-z]{1,2}|[ivxlcdm]{1,5}|.)$/iu;

const isName = (name: string, words: ReferenceWords): boolean =>
  LETTER.test(name) &&
  !DIGIT.test(name) &&
  !ITEM_LABEL.test(name.normalize("NFKC")) &&
  !words.asides.some((aside) => normalized(name).includes(normalized(aside)));

const agrees = (name: string, heading: string): boolean => {
  const [a, b] = [normalized(name), normalized(heading)];
  return a.includes(b) || b.includes(a);
};

/** 名前を添えた参照で、名前が参照先の見出しと合わない。 */
export const titleMismatches = (input: ReferenceInput): StructureIssue[] =>
  input.references.flatMap((reference) => {
    const target = input.targetOf(reference);
    const heading = target === undefined ? "" : headingOf(target);
    const found = nameAfter(input.source, reference.span.end);
    if (heading === "" || found === undefined || !isName(found.name, input.words) || agrees(found.name, heading)) return [];
    return [{ offset: found.at, values: { label: String(reference.attrs["label"] ?? ""), name: found.name, heading } }];
  });

/** 話題の語: 漢字、片仮名、英字、数字の続き。日本語はここで切れる（「料金体系は」の は）。英語は三語まで。 */
const JA_TOPIC = /^[\p{Script=Han}\p{Script=Katakana}ー々]{2,20}/u;
const EN_TOPIC = /^(?:the |a |an )?([a-z][a-z-]{2,}(?: [a-z][a-z-]{2,}){0,2})/iu;
const STEM = 5;
const LATIN_TOPIC = /^[a-z -]+$/iu;

const topicAfter = (source: string, end: number, links: readonly string[]): string | undefined => {
  const after = source.slice(end, end + 60);
  const link = links.find((candidate) => after.replace(SPACE_BEFORE, "").toLowerCase().startsWith(candidate.toLowerCase()));
  if (link === undefined) return undefined;
  const rest = after.replace(SPACE_BEFORE, "").slice(link.length).replace(SPACE_BEFORE, "");
  return JA_TOPIC.exec(rest)?.[0] ?? EN_TOPIC.exec(rest)?.[1];
};

/** 話題が参照先にあるか。英語の語は、語の頭から五文字で探す（pricing と price は同じ語の形違い、metadata の data は別の語）。 */
const mentions = (text: string, topic: string): boolean => {
  const lower = text.normalize("NFKC").toLowerCase();
  const words = topic.toLowerCase().split(" ");
  if (!LATIN_TOPIC.test(topic)) return lower.includes(topic.normalize("NFKC").toLowerCase());
  return words.every((word) => new RegExp(`(?<![a-z])${word.slice(0, STEM).replace(/[^a-z]/gu, "")}`, "u").test(lower));
};

/** 話題のどれかの語が、どの節にも当てはまる語（further caveats の further、料金の詳細の 詳細）。 */
const isVague = (topic: string, words: ReferenceWords): boolean => {
  const parts = topic.toLowerCase().split(" ");
  return words.vagueTopics.some((word) => parts.includes(word.toLowerCase()) || normalized(topic).endsWith(normalized(word)));
};

/** 参照先の見出しにも本文にも無い話題。 */
export const topicMisses = (input: ReferenceInput): StructureIssue[] =>
  input.references.flatMap((reference) => {
    const target = input.targetOf(reference);
    const topic = topicAfter(input.source, reference.span.end, input.words.topicLinks);
    if (target === undefined || headingOf(target) === "" || topic === undefined || isVague(topic, input.words)) return [];
    if (mentions(input.source.slice(target.span.start, target.span.end), topic)) return [];
    return [{ offset: reference.span.start, values: { label: String(reference.attrs["label"] ?? ""), topic, heading: headingOf(target) } }];
  });
