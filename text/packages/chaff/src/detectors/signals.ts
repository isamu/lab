import { proseText } from "../measure.ts";
import { wordsOf } from "./structure.ts";
import { compacted, placeOf } from "./gram-place.ts";
import type { Detector, Finding, ProseDocument, Sentence, Token } from "../plugin.ts";

const PER = 1000;

/**
 * これより短い文書では密度が暴れる。1 個で「1000 あたり 100」になる。
 * 単位は言語で違うので、床も分ける。英語の 200 語と日本語の 200 文字では長さが桁で違う。
 */
const FLOOR = { word: 200, char: 500 };

const bodyOf = (doc: ProseDocument): string => doc.sentences.map(proseText).join(" ");

type Hit = { readonly sentence: Sentence; readonly offset: number };

const findIn = (doc: ProseDocument, pattern: RegExp): Hit[] =>
  doc.sentences.flatMap((sentence) => [...sentence.text.matchAll(pattern)].map((match) => ({ sentence, offset: sentence.span.start + (match.index ?? 0) })));

const density = (doc: ProseDocument, count: number): number => {
  const length = wordsOf(doc);
  return length === 0 ? 0 : Math.round((count / length) * PER);
};

/**
 * 絵文字と装飾記号。1 つなら親しみだが、並ぶと文字そのものが読めなくなる。
 * 件数ではなく密度で見る。長い文書ほど当たるのを避けるため（bold-density と同じ）。
 */
const EMOJI = /\p{Extended_Pictographic}|[←-⇿☀-➿]/gu;

export const emojiDensity: Detector = (doc, options): Finding[] => {
  const hits = findIn(doc, EMOJI);
  const first = hits[0];
  const rate = density(doc, hits.length);
  if (wordsOf(doc) < FLOOR[doc.lengthUnit] || first === undefined || rate <= options.limit) return [];
  return [
    {
      rule: "emoji-density",
      severity: "info",
      line: 0,
      column: 0,
      quote: first.sentence.text.trim(),
      values: { count: hits.length, density: rate, limit: options.limit, offset: first.offset },
    },
  ];
};

/**
 * 同じ言い回しの繰り返し。character n-gram で見るので、語の区切りが要らない。
 * spec §10 が n-gram を選んだのはこのためで、新しい言語でそのまま動く。
 */
/**
 * 窓の幅は単位で分ける。同じ 8 文字でも、日本語では 4〜5 形態素だが英語では 1 語半にしかならない。
 * 実文書（英語 11 本）で 8 文字にしたら、上位は " generat"（generate）のような**語の断片**だった。
 */
const GRAM = { char: 8, word: 20 };

const countGrams = (text: string, width: number): Map<string, number> => {
  const counts = new Map<string, number>();
  Array.from({ length: Math.max(0, text.length - width + 1) }).forEach((_, index) => {
    const gram = text.slice(index, index + width);
    counts.set(gram, (counts.get(gram) ?? 0) + 1);
  });
  return counts;
};

/**
 * 名前ではなく言い回しだけを数える。実文書で測ったら、上位は
 * 「AGENTS.m」「シンギュラリティ」のような固有名詞と識別子だった。名前は繰り返して当たり前。
 *
 * 言い回しは、その言語の「つなぎの материал」を含む。日本語ならひらがな、英語なら語の切れ目。
 * どちらを見るかは adapter が宣言する単位で決める。ひらがなを持たない char 単位の言語が
 * 来たら、この見分けは効かなくなる（そのときは adapter 側に判定を移す）。
 */
/**
 * つなぎが 1 つでは足りない。「detectorは」は用語に助詞が 1 つ付いただけで、
 * 繰り返して当たり前の**用語**であって言い回しではない。
 * 実文書で測ると、本物の言い回しはひらがなを 7 つ前後含み、用語＋助詞は 1〜2 だった。
 */
const CONNECTIVE = { char: /[ぁ-ゖ].*[ぁ-ゖ].*[ぁ-ゖ]/u, word: /\S \S.*\S \S/u };

const isPhrasing = (gram: string, unit: ProseDocument["lengthUnit"]): boolean => CONNECTIVE[unit].test(gram);

/** 文をまたいで数えない。文の終わりと次の文の始まりが繋がると、固有名詞が言い回しに見える。 */
const gramsOf = (doc: ProseDocument): Map<string, number> => {
  const counts = new Map<string, number>();
  doc.sentences.forEach((sentence) => {
    const text = doc.lengthUnit === "char" ? proseText(sentence).replace(/\s+/gu, "") : proseText(sentence);
    countGrams(text, GRAM[doc.lengthUnit]).forEach((count, gram) => counts.set(gram, (counts.get(gram) ?? 0) + count));
  });
  return counts;
};

/** 数えたときと同じ形の文。char 単位では空白を詰めてから数えている。 */
const gramText = (sentence: Sentence, unit: ProseDocument["lengthUnit"]): string => compacted(sentence.text, unit).text;

/** 動詞と助動詞。言い回し（ることができます、it is important to）にはこれが入り、主題の名前（state and local tax）には入らない。 */
const PREDICATE_POS = new Set(["VERB", "AUX"]);

const NOUNS = new Set(["NOUN", "PROPN", "ADJ"]);

/**
 * 英語で名詞のすぐ前の動詞は、名詞を飾る語（形容詞を挟んでも同じ）（the upcoming fiscal year、the Disclosing Party、the borrow checker）で、
 * 述語ではない。日本語の名詞の前の動詞（〜にあるコンポーネント）は言い回しの一部になるので、word 単位だけで見る。
 */
const modifiesNoun = (tokens: readonly Token[], index: number, unit: ProseDocument["lengthUnit"]): boolean =>
  unit === "word" && tokens[index]?.pos === "VERB" && NOUNS.has(tokens[index + 1]?.pos ?? "");

/**
 * 語句が文の中で占める範囲に、動詞か助動詞があるか。範囲で見る。文字で探すと、同じ文の別の所の動詞「use」が、語句の中の名詞「use」に当たる。
 * 品詞が無ければ見分けられないので、これまでどおり言い回しとして数える。
 */
const hasPredicate = (gram: string, sentence: Sentence, unit: ProseDocument["lengthUnit"]): boolean => {
  if (sentence.tokens === undefined) return true;
  const place = placeOf(compacted(sentence.text, unit), gram);
  if (place === undefined) return true;
  const [start, end] = [sentence.span.start + place.start, sentence.span.start + place.end];
  const tokens = sentence.tokens;
  return tokens.some((token, index) => PREDICATE_POS.has(token.pos) && token.span.start < end && start < token.span.end && !modifiesNoun(tokens, index, unit));
};

export const ngramRepetition: Detector = (doc, options): Finding[] => {
  if (wordsOf(doc) < FLOOR[doc.lengthUnit]) return [];
  const sentenceWith = (gram: string): Sentence | undefined => doc.sentences.find((sentence) => gramText(sentence, doc.lengthUnit).includes(gram));
  const worst = [...gramsOf(doc).entries()]
    .filter(([gram, count]) => count > options.limit && isPhrasing(gram, doc.lengthUnit))
    .sort(([, left], [, right]) => right - left)
    .map(([gram, count]) => ({ gram, count, at: sentenceWith(gram) }))
    .find(({ gram, at }) => at === undefined || hasPredicate(gram, at, doc.lengthUnit));
  if (worst === undefined) return [];
  const at = worst.at;
  return [
    {
      rule: "ngram-repetition",
      severity: "info",
      line: 0,
      column: 0,
      quote: at?.text.trim() ?? worst.gram,
      values: { word: worst.gram, count: worst.count, limit: options.limit, offset: at?.span.start ?? 0 },
    },
  ];
};

/**
 * 略語が初出で展開されているか。「CI」だけでは、読む人によって指すものが違う。
 * 展開は「略語の直前か直後の括弧」か「括弧の中の略語」で書かれる。
 *
 * & で繋いだ大文字は 1 語として読む（ATT&CK、M&IE）。割ると CK や IE が別の略語に見える。
 */
const EDGE_BEFORE = String.raw`(?<![A-Za-z0-9_&])`;
const EDGE_AFTER = String.raw`(?![A-Za-z0-9_&])`;
const ACRONYM = new RegExp(String.raw`${EDGE_BEFORE}(?:[A-Z]+(?:&[A-Z]+)+|[A-Z]{2,6})${EDGE_AFTER}`, "gu");

/**
 * 大文字で書かれていても略語ではないもの。
 *
 * 大文字だけの語が 3 つ以上、空白と引用符だけを挟んで続くのは強調（免責の定型文など）。
 * 強調は読点や括弧をまたいで続くので（THE AUTHOR, THE COMPANY (IF ANY)）、そういう続きを含む
 * 「大文字以外の文字を含まない一続き」を丸ごと強調と見なす。小文字の語が挟まれば切れるので、
 * 「SRE, SLO, MTTR」のような略語の並びは残る。引用符に包まれた大文字の句（“AS IS”）も強調。
 */
const CAPS_WORD = String.raw`[A-Z]+(?:&[A-Z]+)*`;
const SHOUTED_RUN = new RegExp(String.raw`${EDGE_BEFORE}${CAPS_WORD}(?:[\s"“”'‘’]+${CAPS_WORD}){2,}${EDGE_AFTER}`, "u");
const UNCASED_STRETCH = /(?:[A-Z]|\P{L})+/gu;
const QUOTED_CAPS = new RegExp(String.raw`["“'‘]${CAPS_WORD}(?:\s+${CAPS_WORD})+["”'’]`, "gu");

/** RFC 2119 の要件語。定義された普通の語で、1 語でも強調でも現れる。 */
const REQUIREMENT_WORD = new RegExp(
  String.raw`${EDGE_BEFORE}(?:(?:MUST|SHALL|SHOULD)(?:\s+NOT)?|NOT\s+RECOMMENDED|REQUIRED|RECOMMENDED|MAY|OPTIONAL)${EDGE_AFTER}`,
  "gu",
);

/** - か . で繋がり、数字を含む識別子（AC-2、MS.TEAMS.1.1v1）。大文字の部品は略語ではない。 */
const IDENTIFIER = /(?<![A-Za-z0-9_&.-])[A-Z0-9][A-Za-z0-9]*(?:[.-][A-Z0-9][A-Za-z0-9]*)+/gu;

/** Creative Commons のライセンス名。CC と BY は 1 つの名前の部品。 */
const LICENCE = new RegExp(String.raw`${EDGE_BEFORE}CC BY(?:-(?:SA|NC|ND))*${EDGE_AFTER}`, "gu");

type Span = { readonly start: number; readonly end: number };

const spanOf = (match: RegExpExecArray): Span => ({ start: match.index, end: match.index + match[0].length });

const spansOf = (text: string): Span[] => [
  ...[...text.matchAll(UNCASED_STRETCH)].filter((match) => SHOUTED_RUN.test(match[0])).map(spanOf),
  ...[...text.matchAll(IDENTIFIER)].filter((match) => /\d/u.test(match[0])).map(spanOf),
  ...[QUOTED_CAPS, REQUIREMENT_WORD, LICENCE].flatMap((pattern) => [...text.matchAll(pattern)].map(spanOf)),
];

type AcronymHit = { readonly word: string; readonly hit: Hit };

const acronymsOf = (doc: ProseDocument): AcronymHit[] =>
  doc.sentences.flatMap((sentence) => {
    const excluded = spansOf(sentence.text);
    return [...sentence.text.matchAll(ACRONYM)]
      .filter((match) => !excluded.some((span) => span.start <= match.index && match.index + match[0].length <= span.end))
      .map((match) => ({ word: match[0], hit: { sentence, offset: sentence.span.start + match.index } }));
  });

/** 読み手が説明なしで通じると見なしてよい語。展開すると逆に読みにくい。 */
const COMMON = new Set([
  "OK",
  "NG",
  "URL",
  "API",
  "CSS",
  "HTML",
  "JSON",
  "YAML",
  "HTTP",
  "HTTPS",
  "PDF",
  "CPU",
  "GPU",
  "RAM",
  "USB",
  "AI",
  "ID",
  "FAQ",
  "PR",
  "OS",
  "CLI",
  "UI",
  "UX",
  "SQL",
  "CSV",
  "XML",
  "TODO",
  "NOTE",
  // 通信と符号化。技術文書でなくても説明なしで通じる。
  "DNS",
  "IP",
  "TCP",
  "UDP",
  "SSH",
  "SSL",
  "TLS",
  "VPN",
  "LAN",
  "UTF",
  "ASCII",
  // 機器・形式・単位。
  "PC",
  "IT",
  "SDK",
  "IDE",
  "PNG",
  "JPEG",
  "GIF",
  "SVG",
  "QR",
  "GPS",
  "SNS",
  "TV",
  "KB",
  "MB",
  "GB",
  "TB",
  // 役職と国・地域。
  "CEO",
  "CTO",
  "CFO",
  "US",
  "UK",
  "EU",
  "UN",
  "DNA",
]);

/**
 * 展開は略語の**すぐ隣**にあるときだけ認める。
 * 60 文字も見ると、同じ文のどこかに括弧があるだけで「説明済み」になり、1 件も出なくなる。
 *
 * 認めるのは 3 つの形。どれも実際によく書かれる。
 *   CI（継続的インテグレーション）   略語のあとに括弧
 *   Continuous Integration (CI)      括弧の中が略語
 *   Tax Cuts and Jobs Act [TCJA]     角括弧の中が略語で、直前の語の頭文字と揃う
 * 括弧と略語の間には、引用符（(“MNDA”)、（「MNDA」））と空白だけを許す。
 */
const WRAP = String.raw`[\s"“”'‘’「」『』]*`;
const OPENS = new RegExp(String.raw`^${WRAP}[(（]`, "u");
const CLOSES = new RegExp(String.raw`^${WRAP}[)）]`, "u");
const OPENED = new RegExp(String.raw`[(（]${WRAP}$`, "u");
const SQUARE_CLOSES = new RegExp(String.raw`^${WRAP}\]`, "u");
const SQUARE_OPENED = new RegExp(String.raw`\[${WRAP}$`, "u");

/** 括弧と略語の間の幅。空白は 1 つに畳んであるので、(“ MNDA ”) まで収まる。 */
const NEAR = 3;

/**
 * 角括弧は引用の印にも使う（[IANA]、[1]）。直前の語のうち大文字で始まる語の頭文字が
 * 略語と揃うときだけ展開と見なす。見る語は略語の文字数の 2 倍まで（and や of を挟むため）。
 */
const spellsOut = (before: string, acronym: string): boolean => {
  const letters = acronym.replaceAll("&", "");
  const words = before
    .replace(SQUARE_OPENED, "")
    .trim()
    .split(/\s+/u)
    .slice(-letters.length * 2);
  const initials = words.filter((word) => /^[A-Z]/u.test(word)).map((word) => word.charAt(0));
  return initials.join("").endsWith(letters);
};

const isExpandedAt = (body: string, acronym: string, at: number): boolean => {
  const after = body.slice(at + acronym.length, at + acronym.length + NEAR);
  const before = body.slice(Math.max(0, at - NEAR), at);
  if (OPENS.test(after) || (OPENED.test(before) && CLOSES.test(after))) return true;
  return SQUARE_OPENED.test(before) && SQUARE_CLOSES.test(after) && spellsOut(body.slice(0, at), acronym);
};

/**
 * どこか 1 か所で展開してあればよい。初出が節の見出し代わりの語（「5.3. DPA.」）で、
 * 展開がその直後の文にあることが契約書では普通にある。見るのは語として現れた所だけ（CISA の中の CI は見ない）。
 */
const isExpanded = (body: string, acronym: string): boolean =>
  [...body.matchAll(new RegExp(`${EDGE_BEFORE}${acronym}${EDGE_AFTER}`, "gu"))].some((match) => isExpandedAt(body, acronym, match.index));

export const undefinedAcronym: Detector = (doc, options): Finding[] => {
  const body = bodyOf(doc);
  const seen = new Map<string, Hit>();
  acronymsOf(doc).forEach(({ word, hit }) => {
    if (!COMMON.has(word) && !seen.has(word)) seen.set(word, hit);
  });
  const bare = [...seen.entries()].filter(([acronym]) => !isExpanded(body, acronym));
  if (bare.length < options.limit) return [];
  return bare.map(([acronym, hit]) => ({
    rule: "undefined-acronym",
    severity: "info",
    line: 0,
    column: 0,
    quote: hit.sentence.text.trim(),
    values: { word: acronym, count: bare.length, limit: options.limit, offset: hit.offset },
  }));
};

/**
 * 具体物の密度。数値・コード・リンク・引用が 1 つも無い節は、
 * 読み終えても何も持ち帰れない。**少ないほうを指摘する**ので、他の密度 rule と向きが逆。
 */
const CONCRETE = /\d|`|https?:\/\//u;

/**
 * 見出しのない導入部は、書き出しで呼ぶ。文書の言葉なので、message がどの言語でも混ざらない。
 * 決まった呼び名（「この節」）を置くと、英語の文書の message に日本語が入る。
 */
const OPENING = { word: 4, char: 12 };

const openingOf = (sentence: Sentence | undefined, unit: ProseDocument["lengthUnit"]): string => {
  const text = sentence === undefined ? "" : proseText(sentence);
  const pieces = unit === "word" ? text.split(" ") : Array.from(text);
  const joiner = unit === "word" ? " " : "";
  return pieces.length <= OPENING[unit] ? pieces.join(joiner) : `${pieces.slice(0, OPENING[unit]).join(joiner)}…`;
};

/** 言語パッケージの語彙表（concrete-number）の書き方。漢数字の「二割」「十五分」も、算用数字と同じ具体的な数。 */
const concretePatterns = (doc: ProseDocument): RegExp[] => [
  CONCRETE,
  ...(doc.lexicons["concrete-number"] ?? []).map((entry) => new RegExp(entry.pattern, "u")),
];

export const concreteEvidence: Detector = (doc, options): Finding[] => {
  const concrete = concretePatterns(doc);
  const sections = doc.sections.filter((section) => section.sentences.length >= 3);
  const empty = sections.filter((section) => {
    const text = doc.source.slice(section.span.start, section.span.end);
    return !concrete.some((pattern) => pattern.test(text));
  });
  if (empty.length < options.limit) return [];
  return empty.map((section) => ({
    rule: "concrete-evidence-density",
    severity: "info",
    line: 0,
    column: 0,
    quote: section.heading.length > 0 ? section.heading : (section.sentences[0]?.text.trim() ?? ""),
    values: {
      word: section.heading.length > 0 ? section.heading : openingOf(section.sentences[0], doc.lengthUnit),
      count: empty.length,
      total: sections.length,
      limit: options.limit,
      offset: section.span.start,
    },
  }));
};

/**
 * ダッシュの多用。英語では正当な用法が多いが、2026 年時点で最も知られた生成文のシグナルでもある。
 * 日本語の組版ではそもそも扱いが難しい。どちらが正しいかは severity の言語別指定で分ける。spec §12.4。
 */
const DASH = /[\u2014\u2015\u2013]/gu;

export const dashDensity: Detector = (doc, options): Finding[] => {
  const hits = findIn(doc, DASH);
  const first = hits[0];
  const rate = density(doc, hits.length);
  if (wordsOf(doc) < FLOOR[doc.lengthUnit] || first === undefined || rate <= options.limit) return [];
  return [
    {
      rule: "no-em-dash",
      severity: "info",
      line: 0,
      column: 0,
      quote: first.sentence.text.trim(),
      values: { count: hits.length, density: rate, limit: options.limit, offset: first.offset },
    },
  ];
};
