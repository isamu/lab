import type { Section, Sentence, Span, StructureKind, StructureNode, Token } from "../plugin.ts";
import { preOrder } from "../tree-walk.ts";
import { isStatement } from "./technical-docs.ts";

/**
 * 形態素解析が数と読んだ語（UD の NumType=Card）。漢数字の「二割」「十五分」も、算用数字と同じ具体的な数。
 * 言い回しの「二人三脚」「一人ひとり」は、辞書が一語として持つので数にならない。
 */
const isCardinal = (token: Token): boolean => token.features?.["NumType"] === "Card";

const HYPHEN = /^[-‐‑]$/u;

/** ハイフンで前の語に続く数（one-on-one の後ろの one）は、合成語の部品。 */
const isCompoundPart = (token: Token, previous: Token | undefined): boolean =>
  previous !== undefined && previous.span.end === token.span.start && HYPHEN.test(previous.surface);

/** 数の語（UPOS の NUM）が、すぐ後ろの複数形の名詞を数えている（five minutes）。one of や two-way は量ではない。 */
const countsPlural = (tokens: readonly Token[], index: number): boolean => {
  const token = tokens[index];
  return token?.pos === "NUM" && tokens[index + 1]?.features?.["Number"] === "Plur" && !isCompoundPart(token, tokens[index - 1]);
};

/** 品詞が無ければ何も言わない。数字そのものは呼ぶ側が文字で見る。 */
export const hasNumeral = (tokens: readonly Token[]): boolean => tokens.some((token, index) => isCardinal(token) || countsPlural(tokens, index));

/** 節の中で始まるものがある。節は見出しの直後から次の見出しの前まで。 */
export const startsWithin = (section: Span, spans: readonly Span[]): boolean => spans.some((span) => span.start >= section.start && span.start < section.end);

/** 構造の木が読んだ参照（第3条・Section VI）・数量・日付。どれも読み手が確かめに行ける具体物。 */
const EVIDENCE: ReadonlySet<StructureKind> = new Set(["reference", "quantity", "date"]);

export const evidenceSpans = (root: StructureNode | undefined): Span[] =>
  root === undefined ? [] : preOrder(root).flatMap((node) => (EVIDENCE.has(node.kind) ? [node.span] : []));

/** 読み手にすることを伝える言い方。英語は文の書き出し（Never use, Please submit）、日本語は文末（〜ください、〜しましょう）。 */
export type AdviceWords = { readonly openers: readonly string[]; readonly endings: readonly string[] };

const CLOSERS = new Set(Array.from("\"'”’」』）)】〕〉》］]"));
const TERMINALS = new Set(Array.from("。．.!！"));
const QUESTION_MARKS = new Set(["?", "？"]);
const SKIPPED = new Set(["PUNCT", "SYM", "X", "SPACE"]);

/** 文末から、閉じ括弧・引用符（と、渡されれば句点）を外した残り。 */
const withoutTail = (text: string, tail: ReadonlySet<string>): string => {
  const chars = Array.from(text.trimEnd());
  const last = chars.findLastIndex((char) => !tail.has(char) && char.trim() !== "");
  return chars.slice(0, last + 1).join("");
};

const isQuestion = (text: string): boolean => QUESTION_MARKS.has(Array.from(withoutTail(text, CLOSERS)).at(-1) ?? "");

const opensWith = (text: string, openers: readonly string[]): boolean => {
  const lower = text.trimStart().toLowerCase();
  return openers.some((opener) => lower.startsWith(`${opener} `));
};

const endsWith = (text: string, endings: readonly string[]): boolean => {
  const body = withoutTail(text, new Set([...CLOSERS, ...TERMINALS]));
  return endings.some((ending) => body.endsWith(ending));
};

/** 項目の番号（a, 12, iv）。 */
const ENUMERATOR = /^(?:\p{L}|\p{Nd}{1,3}|[ivx]{1,4})$/iu;
const BRACKETED = /^[(（](.+)[)）]$/u;
const MARKED = /^(.+)[.)）．]$/u;

/** 項目の番号だけが文として切り出されたもの（a. や (1)）。述べることも問うことも無い。 */
export const isLabelOnly = (sentence: Pick<Sentence, "text">): boolean => {
  const text = sentence.text.trim();
  const core = BRACKETED.exec(text)?.[1] ?? MARKED.exec(text)?.[1];
  return core !== undefined && ENUMERATOR.test(core);
};

/** 動詞の目的語の書き出し（Use a generator, Review our benefits）。名詞と読まれた語の後ろにこれが来れば、その語は動詞。 */
const OBJECT_OPENER = new Set(["DET", "PRON"]);

/**
 * 原形の動詞（Keep, Take）。解析器が名詞と読んだ、動詞にもなる語も、目的語が続けば同じ（Use a generator）。
 * 後ろが名詞や前置詞なら名詞句の頭（evidence of complexity, trust development plans）。
 */
const isBaseVerb = (token: Token, next: Token | undefined): boolean =>
  (token.pos === "VERB" && token.lemma?.toLowerCase() === token.surface.toLowerCase() && token.features?.["VerbForm"] === undefined) ||
  (token.pos === "NOUN" && token.features?.["AlsoVerb"] === "Yes" && token.features["Number"] !== "Plur" && OBJECT_OPENER.has(next?.pos ?? ""));

/** 頭の語が一語として立っている。空白を置かずに続けば、語の一部（Cloud.gov の Cloud）。 */
const standsAlone = (tokens: readonly Token[], head: Token): boolean => {
  const after = tokens[tokens.indexOf(head) + 1];
  return after === undefined || after.span.start > head.span.end || after === tokens.at(-1) || after.surface === ",";
};

/**
 * 動詞で始まる英語の文（Keep freezers closed）は指示。すぐ後ろがコロンなら見出し語（Release: none）で、主語のある文は述べる文。
 * 日本語は動詞が文末に来るので、品詞では読まない。
 */
const opensWithVerb = (tokens: readonly Token[], language: string): boolean => {
  const [head, next] = tokens.filter((token) => !SKIPPED.has(token.pos) || token.surface === ":");
  return language === "en" && head !== undefined && isBaseVerb(head, next) && standsAlone(tokens, head) && next?.surface !== ":" && !isStatement(tokens);
};

/**
 * 読み手が裏づけを求められることを述べた文。問い（情報提供の依頼に並ぶ質問）と指示（安全の手引き）は主張ではなく、
 * 数字が欠けているとは言えない。
 */
export const isClaim = (sentence: Pick<Sentence, "text" | "tokens">, language: string, words: AdviceWords): boolean =>
  !isQuestion(sentence.text) &&
  !opensWith(sentence.text, words.openers) &&
  !endsWith(sentence.text, words.endings) &&
  !opensWithVerb(sentence.tokens ?? [], language);

/**
 * 見込み・あるべき姿・書き手の予定を述べる言い方。英語は文のどこかの語（may, should, we will）、日本語は文末（〜が期待される、〜すべきである）。
 * どちらの言語の語彙表も、その言語の文書にしか無い。
 */
export type IntentWords = { readonly phrases: readonly string[]; readonly endings: readonly string[] };

/** 語の並びとして比べる形。字とアポストロフィ以外を空白に畳んで、両端に空白を置く。 */
const wordRun = (text: string): string =>
  ` ${text
    .replace(/’/gu, "'")
    .replace(/[^\p{L}']+/gu, " ")
    .trim()} `;

/** 文頭の大文字だけを小文字に戻す。文の途中の大文字の語（in May）は、助動詞と別の語。 */
const withLowerHead = (text: string): string => {
  const trimmed = text.trimStart();
  return `${trimmed.charAt(0).toLowerCase()}${trimmed.slice(1)}`;
};

const containsPhrase = (text: string, phrases: readonly string[]): boolean => {
  const words = wordRun(withLowerHead(text));
  return phrases.some((phrase) => words.includes(wordRun(phrase.toLowerCase())));
};

/** 事実でなく、起こりうること・すべきこと・書き手のする予定を述べた文（リスクと対策、提言、答申の方針）。裏づけの数字を求める主張ではない。 */
export const statesIntent = (sentence: Pick<Sentence, "text">, words: IntentWords): boolean =>
  containsPhrase(sentence.text, words.phrases) || endsWith(sentence.text, words.endings);

/** 比べる形。前後の空白と、文末の句点・コロンを除き、小文字にする。 */
const bareLine = (text: string): string =>
  withoutTail(text, new Set([...TERMINALS, ":", "："]))
    .trim()
    .toLowerCase();

/** 変換で残ったサイトの案内（ページの先頭です。本文）。文書の本文ではない。 */
export const isNavigationLine = (sentence: Pick<Sentence, "text">, lines: readonly string[]): boolean => lines.includes(bareLine(sentence.text));

/** 条件を並べる節の見出し（Requirements、応募資格）。並ぶのは条件で、裏づけを求める主張ではない。 */
export const isConditionHeading = (heading: string, headings: readonly string[]): boolean => headings.includes(bareLine(heading));

/** 節と、その下の節（続く、見出しがより深い節）。親の節の本文は短い導入で、中身は下の節にある。導入部（深さ 0）は親ではない。 */
export const withSubsections = <T extends Pick<Section, "depth">>(sections: readonly T[], section: T): T[] => {
  const index = sections.indexOf(section);
  const after = index === -1 ? [] : sections.slice(index + 1);
  const next = section.depth === 0 ? 0 : after.findIndex((other) => other.depth <= section.depth);
  return [section, ...(next === -1 ? after : after.slice(0, next))];
};

type SlotSection = Pick<Section, "depth" | "heading" | "unlabeledHeading">;

/** 同じ見出しの節がこの数の親の下にあれば、項目ごとに繰り返す型の欄（状況・解決策・備考）。 */
const MIN_SLOT_PARENTS = 3;

const titleOf = (section: SlotSection): string => (section.unlabeledHeading ?? section.heading).trim();

const parentOf = <T extends SlotSection>(sections: readonly T[], section: T): T | undefined => {
  const index = sections.indexOf(section);
  const parent = sections.slice(0, Math.max(index, 0)).findLast((other) => other.depth < section.depth);
  return parent !== undefined && parent.depth > 0 ? parent : undefined;
};

/**
 * 型の欄の節は、その欄を持つ項目（親の節）と、項目の他の欄と合わせて読む。具体物を何欄目に書くかは項目ごとに違い、
 * 一つの欄だけでは持ち帰るものを決められない。型の欄でなければ、その節と下の節。
 */
export const familyWithSlots = <T extends SlotSection>(sections: readonly T[], section: T): T[] => {
  const parent = parentOf(sections, section);
  if (parent === undefined || titleOf(section) === "") return withSubsections(sections, section);
  const parentsOfSameTitle = new Set(
    sections.filter((other) => other.depth === section.depth && titleOf(other) === titleOf(section)).map((other) => parentOf(sections, other)),
  );
  parentsOfSameTitle.delete(undefined);
  return parentsOfSameTitle.size >= MIN_SLOT_PARENTS ? withSubsections(sections, parent) : withSubsections(sections, section);
};

/** 大文字だけの略語（API、PDFs）。どの文書にも出る技術の語で、名指しした物ではない。 */
const ACRONYM = /^\p{Lu}+s?$/u;
const CAPITAL_HEAD = /^\p{Lu}/u;
const WORD = /\p{L}/u;

/** 一字の語（e-Tax の e）は、名前の切れ端。 */
const MIN_NAME_CHARS = 2;

/** 名前と読んだ語のうち、ふつうの語の大文字書き（Timeline、Changes）・強調（NEVER）・略語・切れ端でないもの。 */
const isDistinctiveName = (token: Token): boolean =>
  token.pos === "PROPN" &&
  token.features?.["OrdinaryWord"] !== "Yes" &&
  token.features?.["Emph"] !== "Yes" &&
  !ACRONYM.test(token.surface) &&
  Array.from(token.surface).length >= MIN_NAME_CHARS;

/** 大文字で始まる文頭の語は、名前と区別がつかない（Chimneys）。大文字の無い文字（日本語）の文頭は名前のまま読む。 */
const distinctiveIn = (sentence: Pick<Sentence, "tokens">): Span[] => {
  const tokens = sentence.tokens ?? [];
  const head = tokens.find((token) => WORD.test(token.surface));
  const skipped = head !== undefined && CAPITAL_HEAD.test(head.surface) ? head : undefined;
  return tokens.filter((token) => token !== skipped && isDistinctiveName(token)).map((token) => token.span);
};

/** 固有の名前（KubeCon、GitHub、大阪城ホール）の範囲。ふつうの語・略語・文頭の語だけでできた名前は除く。 */
export const distinctiveNames = (sentences: readonly Pick<Sentence, "tokens">[], names: readonly Span[]): Span[] => {
  const distinctive = sentences.flatMap(distinctiveIn);
  return names.filter((name) => startsWithin(name, distinctive));
};

/** 名前が書かれた節の数がこの割合に届くなら、文書の主題（Kubernetes、Rust）で、その節が持ち帰らせる具体物ではない。 */
const SUBJECT_SHARE = 0.5;

const indexOfSection = (sections: readonly Pick<Section, "span">[], at: number): number =>
  sections.findIndex((section) => at >= section.span.start && at < section.span.end);

/** 固有の名前（KubeCon、GitHub）のうち、節の具体物として数えるもの。文書の半分以上の節に書かれた名前は主題なので除く。 */
export const namesAsEvidence = (names: readonly Span[], source: string, sections: readonly Pick<Section, "span">[]): Span[] => {
  const keyOf = (span: Span): string => source.slice(span.start, span.end).toLowerCase();
  const sectionsOf = new Map<string, Set<number>>();
  names.forEach((name) => {
    const index = indexOfSection(sections, name.start);
    if (index !== -1) sectionsOf.set(keyOf(name), (sectionsOf.get(keyOf(name)) ?? new Set<number>()).add(index));
  });
  return names.filter((name) => (sectionsOf.get(keyOf(name))?.size ?? 0) < sections.length * SUBJECT_SHARE);
};
