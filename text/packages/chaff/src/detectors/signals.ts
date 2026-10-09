import { proseText } from "../measure.ts";
import { dateSpans, wordsOf } from "./structure.ts";
import { compacted, placeAt, type Compacted } from "./gram-place.ts";
import { charWindows, wordWindows } from "./gram-windows.ts";
import { furnitureMask, isFurniture } from "./gram-furniture.ts";
import { notAcronymSpansOf, type NotAcronymSpans } from "./acronym-context.ts";
import { abbreviates, expansionAt, termEntryAcronyms, type ExpandedAt } from "./acronym-expansion.ts";
import { isExplained } from "./acronym-compound.ts";
import { conjugatedForms } from "./conjugated-form.ts";
import { evidenceSpans, hasNumeral, startsWithin } from "./concrete-evidence.ts";
import { letteredIndexEntries } from "./lettered-index.ts";
import { hasPredicateIn } from "./gram-predicate.ts";
import { nameSpans, touchesAny } from "../team-names.ts";
import { referenceListSpans } from "../reference-lists.ts";
import type { Detector, Finding, ProseDocument, Section, Sentence } from "../plugin.ts";

const PER = 1000;

/**
 * これより短い文書では密度が暴れる。1 個で「1000 あたり 100」になる。
 * 単位は言語で違うので、床も分ける。英語の 200 語と日本語の 200 文字では長さが桁で違う。
 */
export const MIN_DOCUMENT_LENGTH = { word: 200, char: 500 };

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
  if (wordsOf(doc) < MIN_DOCUMENT_LENGTH[doc.lengthUnit] || first === undefined || rate <= options.limit) return [];
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
 * 同じ言い回しの繰り返し。文字の並びで見るので、adapter の語の区切り（wordSplit）が要らない。英語の窓は空白で語の切れ目にそろえる。
 * spec §10 が n-gram を選んだのはこのためで、新しい言語でそのまま動く。
 */
/**
 * 窓の幅は単位で分ける。同じ 8 文字でも、日本語では 4〜5 形態素だが英語では 1 語半にしかならない。
 * 英語の窓は語の切れ目にそろえ、18 文字に届くまで語を足す。文字で切ると " generat" のような語の断片が上位に来る。
 * 18 は、文字で切っていた頃の 20 文字の窓から前後の空白を除いた長さ（" juxtaposed to said "）。
 */
const GRAM = { char: 8, word: 18 };

const windowsOf = (text: string, unit: ProseDocument["lengthUnit"]): Span[] => (unit === "char" ? charWindows(text, GRAM.char) : wordWindows(text, GRAM.word));

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

/** 語句が最初に数えられた所。書かれたままの語句と、文と、文の中の範囲（sentence.text の位置）。 */
type FirstSeen = { readonly gram: string; readonly sentence: Sentence; readonly place: Span };

type Tally = { readonly counts: Map<string, number>; readonly first: Map<string, FirstSeen> };

/** 詰めた文の index 番目の文字が、リンクの文字か。 */
const linkedIn = (doc: ProseDocument, sentence: Sentence, source: Compacted): ((index: number) => boolean) => {
  const links = doc.links.filter((link) => link.start < sentence.span.end && sentence.span.start < link.end);
  return (index) => {
    const at = sentence.span.start + (source.offsets[index] ?? -1);
    return links.some((link) => link.start <= at && at < link.end);
  };
};

/** 英語は大文字と小文字を区別せずに数える。文頭の "Proposals submitted via" も文中の "proposals submitted via" も同じ言い回し。 */
const keyOf = (gram: string, unit: ProseDocument["lengthUnit"]): string => (unit === "word" ? gram.toLowerCase() : gram);

const namesOf = (doc: ProseDocument): readonly string[] =>
  doc.lengthUnit === "char" ? (doc.names ?? []).map((name) => name.replace(/\s+/gu, "")) : (doc.names ?? []);

/**
 * 文をまたいで数えない。文の終わりと次の文の始まりが繋がると、固有名詞が言い回しに見える。
 * 並べた名前にかかる語句も数えない。名前が繰り返されれば、その前後（「the …」）も一緒に繰り返されるのは当たり前。
 * 一覧の飾り（gram-furniture.ts）も数えない。項目ごとに繰り返すのはひな形で、書き手ではない。
 */
const tallySentence = (doc: ProseDocument, sentence: Sentence, tally: Tally): void => {
  const source = compacted(sentence.text, doc.lengthUnit);
  const named = nameSpans(source.text, namesOf(doc));
  const mask = furnitureMask(source.text, linkedIn(doc, sentence, source));
  windowsOf(source.text, doc.lengthUnit)
    .filter((window) => !touchesAny(named, window.start, window.end) && !isFurniture(source.text, mask, window))
    .forEach((window) => {
      const gram = source.text.slice(window.start, window.end);
      const key = keyOf(gram, doc.lengthUnit);
      tally.counts.set(key, (tally.counts.get(key) ?? 0) + 1);
      const place = placeAt(source, window);
      if (!tally.first.has(key) && place !== undefined) tally.first.set(key, { gram, sentence, place });
    });
};

const gramsOf = (doc: ProseDocument): Tally => {
  const tally: Tally = { counts: new Map(), first: new Map() };
  doc.sentences.forEach((sentence) => tallySentence(doc, sentence, tally));
  return tally;
};

/**
 * 語句が文の中で占める範囲に、述語になる動詞か助動詞があるか（gram-predicate.ts）。
 * 品詞が無ければ見分けられないので、これまでどおり言い回しとして数える。
 */
const hasPredicate = (at: FirstSeen | undefined, unit: ProseDocument["lengthUnit"]): boolean => {
  if (at?.sentence.tokens === undefined) return true;
  const start = at.sentence.span.start;
  return hasPredicateIn(at.sentence.tokens, { start: start + at.place.start, end: start + at.place.end }, unit);
};

export const ngramRepetition: Detector = (doc, options): Finding[] => {
  if (wordsOf(doc) < MIN_DOCUMENT_LENGTH[doc.lengthUnit]) return [];
  const tally = gramsOf(doc);
  const worst = [...tally.counts.entries()]
    .filter(([key, count]) => count > options.limit && isPhrasing(key, doc.lengthUnit))
    .toSorted(([, left], [, right]) => right - left)
    .map(([key, count]) => ({ key, count, at: tally.first.get(key) }))
    .find(({ at }) => hasPredicate(at, doc.lengthUnit));
  if (worst === undefined) return [];
  const at = worst.at?.sentence;
  return [
    {
      rule: "ngram-repetition",
      severity: "info",
      line: 0,
      column: 0,
      quote: at?.text.trim() ?? worst.key,
      values: { word: worst.at?.gram ?? worst.key, count: worst.count, limit: options.limit, offset: at?.span.start ?? 0 },
    },
  ];
};

/**
 * 略語が初出で展開されているか。「CI」だけでは、読む人によって指すものが違う。
 * 展開は「略語の直前か直後の括弧」か「括弧の中の略語」で書かれる。
 *
 * & で繋いだ大文字は 1 語として読む（ATT&CK、M&IE）。割ると CK や IE が別の略語に見える。
 * - で繋いだ略語どうしも 1 語（RT-PCR）。割ると RT が別の略語に見える。数字を含むもの（COVID-19）は識別子として外す。
 */
const EDGE_BEFORE = String.raw`(?<![A-Za-z0-9_&])`;
const EDGE_AFTER = String.raw`(?![A-Za-z0-9_&])`;
/** 略語として読む大文字の長さの上限。これより長い大文字の語（BILLING）は、普通の語を大文字で書いたもの。 */
const ACRONYM_MAX = 6;
const ACRONYM_PART = String.raw`(?:[A-Z]+(?:&[A-Z]+)+|[A-Z]{2,${ACRONYM_MAX}})`;
const ACRONYM = new RegExp(String.raw`${EDGE_BEFORE}${ACRONYM_PART}(?:-${ACRONYM_PART})*${EDGE_AFTER}`, "gu");

/**
 * 大文字で書かれていても略語ではないもの。
 *
 * 大文字だけの語が 3 つ以上、空白と引用符だけを挟んで続くのは強調（免責の定型文など）。
 * 強調は読点や括弧をまたいで続くので（THE AUTHOR, THE COMPANY (IF ANY)）、そういう続きを含む
 * 「大文字以外の文字を含まない一続き」を丸ごと強調と見なす。小文字の語が挟まれば切れるので、
 * 「SRE, SLO, MTTR」のような略語の並びは残る。引用符に包まれた大文字の句（“AS IS”）も強調。
 * 2 語でも、片方が略語にしては長い語なら強調（BILLING CODE）。略語 2 つの並び（NIST SP）は残る。
 */
const CAPS_WORD = String.raw`[A-Z]+(?:&[A-Z]+)*`;
const LONG_CAPS_WORD = String.raw`[A-Z]{${ACRONYM_MAX + 1},}`;
const CAPS_GAP = String.raw`[\s"“”'‘’]+`;
const SHOUTED_RUN = new RegExp(String.raw`${EDGE_BEFORE}${CAPS_WORD}(?:${CAPS_GAP}${CAPS_WORD}){2,}${EDGE_AFTER}`, "u");
/** 2 語の強調は、その 2 語だけを外す。続きまで外すと、区切りの後ろの略語（NEW GUIDELINES: SRE）まで消える。 */
const SHOUTED_PAIR = new RegExp(
  String.raw`${EDGE_BEFORE}(?:${LONG_CAPS_WORD}${CAPS_GAP}${CAPS_WORD}|${CAPS_WORD}${CAPS_GAP}${LONG_CAPS_WORD})${EDGE_AFTER}`,
  "gu",
);
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

const spansOf = (text: string, notation: NotAcronymSpans): Span[] => [
  ...[...text.matchAll(UNCASED_STRETCH)].filter((match) => SHOUTED_RUN.test(match[0])).map(spanOf),
  ...[...text.matchAll(IDENTIFIER)].filter((match) => /\d/u.test(match[0])).map(spanOf),
  ...[SHOUTED_PAIR, QUOTED_CAPS, REQUIREMENT_WORD, LICENCE].flatMap((pattern) => [...text.matchAll(pattern)].map(spanOf)),
  ...notation(text),
];

type AcronymHit = { readonly word: string; readonly hit: Hit };

/**
 * 言語パッケージが、大文字で書いて強調した普通の語（will NEVER call）と読んだ語。辞書がその語を名前になり得ない品詞でしか
 * 知らないときだけ、そう読む。品詞を持たない言語パッケージでは何も外れない。
 */
const isEmphasised = (sentence: Sentence, offset: number): boolean =>
  (sentence.tokens ?? []).some((token) => token.span.start === offset && token.features?.["Emph"] === "Yes");

/** チームが並べた名前の中の略語（NTT Docomo の NTT）は、名前の一部であって説明を待つ略語ではない。 */
const acronymsOf = (doc: ProseDocument, notation: NotAcronymSpans): AcronymHit[] =>
  doc.sentences.flatMap((sentence) => {
    const excluded = [...spansOf(sentence.text, notation), ...nameSpans(sentence.text, doc.names ?? [])];
    return [...sentence.text.matchAll(ACRONYM)]
      .filter((match) => !excluded.some((span) => span.start <= match.index && match.index + match[0].length <= span.end))
      .map((match) => ({ word: match[0], hit: { sentence, offset: sentence.span.start + match.index } }))
      .filter(({ hit }) => !isEmphasised(hit.sentence, hit.offset));
  });

/** 略語ごとの、最初に現れた所。 */
const firstHits = (hits: readonly AcronymHit[]): Map<string, Hit> => {
  const seen = new Map<string, Hit>();
  hits.forEach(({ word, hit }) => {
    if (!seen.has(word)) seen.set(word, hit);
  });
  return seen;
};

/**
 * 範囲の外の略語。日付の中の月（SEP 01, 2022）は略語ではない。文献一覧の誌名や会議名（Appeared in: LREC 2008.）は
 * 引いた文献の書き方で、本文が説明する略語ではない。
 */
const outsideSpans = (hits: readonly AcronymHit[], spans: readonly Span[]): AcronymHit[] =>
  hits.filter(({ hit }) => !spans.some((span) => span.start <= hit.offset && hit.offset < span.end));

/**
 * どこか 1 か所で展開してあればよい。初出が節の見出し代わりの語（「5.3. DPA.」）で、
 * 展開がその直後の文にあることが契約書では普通にある。見るのは語として現れた所だけ（CISA の中の CI は見ない）。
 */
const isExpanded = (body: string, acronym: string, expandedAt: ExpandedAt): boolean =>
  [...body.matchAll(new RegExp(`${EDGE_BEFORE}${acronym}${EDGE_AFTER}`, "gu"))].some((match) => expandedAt(body, acronym, match.index));

/**
 * 見出しは文にならないので、見出しの中の展開（Maximum Envelope of Water (MEOW) runs）は見出しの文字列で探す。
 * 見出しの括弧は添え書き（Your Own AI (LLM)、(Beta)）にも使うので、見出しの語から略語の文字が順に拾えるときだけ認める。
 */
const expandsInHeading = (heading: string, acronym: string, expandedAt: ExpandedAt): boolean =>
  isExpanded(heading, acronym, expandedAt) && abbreviates(heading.replaceAll(acronym, " "), acronym);

const patternsOf = (doc: ProseDocument, id: string): string[] => (doc.lexicons[id] ?? []).map((entry) => entry.pattern);

const notationOf = (doc: ProseDocument): NotAcronymSpans =>
  notAcronymSpansOf({
    meridiem: patternsOf(doc, "meridiem"),
    timeZones: patternsOf(doc, "time-zone"),
    currencies: patternsOf(doc, "currency-code"),
    usStates: patternsOf(doc, "us-state-code"),
    emphasis: patternsOf(doc, "emphasis-word"),
    divisions: patternsOf(doc, "numbered-division"),
    abbreviatedLabels: patternsOf(doc, "abbreviated-label"),
    honorifics: patternsOf(doc, "honorific"),
    titles: patternsOf(doc, "name-title"),
    dateTimeUnits: patternsOf(doc, "date-time-unit"),
  });

/** 定義の語は、語彙表の形（という）と、この文書で活用して書かれた形（といいます）の両方で照らす。 */
const definitionVerbsOf = (doc: ProseDocument): string[] => {
  const verbs = patternsOf(doc, "definition-verb");
  return [...verbs, ...conjugatedForms(doc.sentences, verbs)];
};

export const undefinedAcronym: Detector = (doc, options): Finding[] => {
  const body = bodyOf(doc);
  // HTTP のメソッド名（GET）は略語ではないので、通じる略語と同じく展開を求めない。
  // 並べた名前（JAXA）も、繋いだ略語（JAXA-ISAS）の片割れとして説明済みに数える。
  const common = new Set([...(options.lexicon ?? []).map((entry) => entry.pattern), ...patternsOf(doc, "http-method"), ...(doc.names ?? [])]);
  const expandedAt = expansionAt({ markers: patternsOf(doc, "definition-marker"), verbs: definitionVerbsOf(doc) });
  const entries = termEntryAcronyms(doc.source);
  const headings = doc.sections.map((section) => section.heading);
  const explainedAlone = (word: string): boolean =>
    common.has(word) || entries.has(word) || isExpanded(body, word, expandedAt) || headings.some((heading) => expandsInHeading(heading, word, expandedAt));
  const hits = outsideSpans(acronymsOf(doc, notationOf(doc)), referenceListSpans(doc.source, patternsOf(doc, "reference-list-heading")));
  const unexplained = new Set([...firstHits(hits).keys()].filter((acronym) => !isExplained(acronym, explainedAlone)));
  // 日付を読むには文書の木を作る。上限に届かない文書では作らない。
  if (unexplained.size < options.limit) return [];
  const bare = [...firstHits(outsideSpans(hits, dateSpans(doc)))].filter(([acronym]) => unexplained.has(acronym));
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

const hasNumeralIn = (section: Section): boolean => section.sentences.some((sentence) => hasNumeral(sentence.tokens ?? []));

export const concreteEvidence: Detector = (doc, options): Finding[] => {
  const entries = letteredIndexEntries(doc.sections);
  const sections = doc.sections.filter((section) => section.sentences.length >= 3 && !entries.has(section));
  const bare = sections.filter(
    (section) => !CONCRETE.test(doc.source.slice(section.span.start, section.span.end)) && !hasNumeralIn(section) && !startsWithin(section.span, doc.links),
  );
  // 構造の木は作るのに手間がかかる。指摘に届かない文書では作らない。
  const nodes = bare.length < options.limit ? [] : evidenceSpans(doc.structure);
  const empty = bare.filter((section) => !startsWithin(section.span, nodes));
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
// An en dash between two digits (45–58, 10:00–10:15) is a range mark, the typographer's correct choice, not a dash that
// sets off words.
const DASH = /[\u2014\u2015]|(?<!\p{Nd})\u2013|\u2013(?!\p{Nd})/gu;

export const dashDensity: Detector = (doc, options): Finding[] => {
  const hits = findIn(doc, DASH);
  const first = hits[0];
  const rate = density(doc, hits.length);
  if (wordsOf(doc) < MIN_DOCUMENT_LENGTH[doc.lengthUnit] || first === undefined || rate <= options.limit) return [];
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
