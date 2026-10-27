import { proseText } from "../measure.ts";
import { dateSpans, wordsOf } from "./structure.ts";
import { lexiconNotationOf, sourceNotAcronymSpans, unreportedAcronymSpans, type NotAcronymSpans } from "./acronym-context.ts";
import { titledCodeSpans } from "./titled-code-citation.ts";
import { abbreviates, expansionAt, termEntryAcronyms, type DefinitionWords, type ExpandedAt } from "./acronym-expansion.ts";
import { isExplained } from "./acronym-compound.ts";
import { statedAcronyms } from "./acronym-definition.ts";
import { isBracketed, isInHeading, isNamePart } from "./acronym-lone.ts";
import { linkedListTerms } from "./acronym-link.ts";
import { caseVariantsIn, spelledOutAcronyms } from "./acronym-mention.ts";
import { conjugatedForms } from "./conjugated-form.ts";
import { evidenceSpans, hasNumeral, isClaim, isLabelOnly, startsWithin, type AdviceWords } from "./concrete-evidence.ts";
import { letteredIndexEntries } from "./lettered-index.ts";
import { knownByDocument } from "./acronym-known.ts";
import { explainedInText, headingsSpellingOut } from "./acronym-gloss.ts";
import { nameSpans } from "../team-names.ts";
import { DASH, introducesList } from "./lead-in-dash.ts";
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
 * 略語が初出で展開されているか。「CI」だけでは、読む人によって指すものが違う。
 * 展開は「略語の直前か直後の括弧」か「括弧の中の略語」で書かれる。
 *
 * & で繋いだ大文字は 1 語として読む（ATT&CK、M&IE）。割ると CK や IE が別の略語に見える。
 * - で繋いだ略語どうしも 1 語（RT-PCR）。割ると RT が別の略語に見える。数字を含むもの（COVID-19）は識別子として外す。
 * 下付きの数字が続く大文字は化学式（CO₂、SO₄）で、説明を待つ略語ではない。数字や小文字が続くもの（CO2、NOx）と同じく語の途中と読む。
 */
const EDGE_BEFORE = String.raw`(?<![A-Za-z0-9_&])`;
const EDGE_AFTER = String.raw`(?![A-Za-z0-9_&\u2080-\u2089])`;
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

/**
 * - か . で繋がり、数字を含む識別子（AC-2、MS.TEAMS.1.1v1、REC-webstorage-20160419）。大文字の部品は略語ではない。
 * - の後ろの部品は小文字で始まってもよい。
 */
const IDENTIFIER = /(?<![A-Za-z0-9_&.-])[A-Z0-9][A-Za-z0-9]*(?:\.[A-Z0-9][A-Za-z0-9]*|-[A-Za-z0-9][A-Za-z0-9]*)+/gu;
/** 識別子の頭の大文字を、その前にもう一度書いた語（WD WD-CSP3-20160913、CR CR-referrer-policy-20170126）。識別子の種類の印。 */
const IDENTIFIER_KIND = /(?<![A-Za-z0-9_&.-])(?<kind>[A-Z]{2,}) \k<kind>-(?=[A-Za-z0-9-]*\d)[A-Za-z0-9-]+(?![\w&])/gu;

/** Creative Commons のライセンス名。CC と BY は 1 つの名前の部品。 */
const LICENCE = new RegExp(String.raw`${EDGE_BEFORE}CC BY(?:-(?:SA|NC|ND))*${EDGE_AFTER}`, "gu");

type Span = { readonly start: number; readonly end: number };

const spanOf = (match: RegExpExecArray): Span => ({ start: match.index, end: match.index + match[0].length });

const spansOf = (text: string, notation: NotAcronymSpans): Span[] => [
  ...[...text.matchAll(UNCASED_STRETCH)].filter((match) => SHOUTED_RUN.test(match[0])).map(spanOf),
  ...[...text.matchAll(IDENTIFIER)].filter((match) => /\d/u.test(match[0])).map(spanOf),
  ...[...text.matchAll(IDENTIFIER_KIND)].map(spanOf),
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
 * 複数形（Special Interest Groups (SIGs)）の展開は、s の無い略語（SIG）の展開でもある。
 */
const isExpanded = (body: string, acronym: string, expandedAt: ExpandedAt): boolean =>
  [...body.matchAll(new RegExp(`${EDGE_BEFORE}${acronym}s?${EDGE_AFTER}`, "gu"))].some((match) => expandedAt(body, match[0], match.index));

/**
 * 見出しは文にならないので、見出しの中の展開（Maximum Envelope of Water (MEOW) runs）は見出しの文字列で探す。
 * 見出しの括弧は添え書き（Your Own AI (LLM)、(Beta)）にも使うので、見出しの語から略語の文字が順に拾えるときだけ認める。
 */
const expandsInHeading = (heading: string, acronym: string, expandedAt: ExpandedAt): boolean =>
  isExpanded(heading, acronym, expandedAt) && abbreviates(heading.replaceAll(acronym, " "), acronym);

const patternsOf = (doc: ProseDocument, id: string): string[] => (doc.lexicons[id] ?? []).map((entry) => entry.pattern);

const notationOf = (doc: ProseDocument): NotAcronymSpans => lexiconNotationOf((id) => patternsOf(doc, id));

/** 定義の語。定義の動詞は、語彙表の形（という）と、この文書で活用して書かれた形（といいます）の両方で照らす。 */
const definitionWordsOf = (doc: ProseDocument): DefinitionWords => {
  const verbs = patternsOf(doc, "definition-verb");
  const alternatives = patternsOf(doc, "definition-alternative");
  return { markers: patternsOf(doc, "definition-marker"), verbs: [...verbs, ...conjugatedForms(doc.sentences, verbs)], alternatives };
};

const acronymFinding = (acronym: string, hit: Hit, count: number, limit: number): Finding => ({
  rule: "undefined-acronym",
  severity: "info",
  line: 0,
  column: 0,
  quote: hit.sentence.text.trim(),
  values: { word: acronym, count, limit, offset: hit.offset },
});

const isNamePartAt = (acronym: string, hit: Hit): boolean => {
  const start = hit.offset - hit.sentence.span.start;
  return isNamePart(hit.sentence.text, start, start + acronym.length);
};

/**
 * 説明のない略語が上限に届かなくても、この文書が自分で上限の数だけ略語を展開しているなら、展開しなかった 1 つも指す。
 * 書き手が展開する文書では、展開の抜けは抜けとして読める。名前の一部の略語（SRI International）は、そのときも指さない。
 */
export const undefinedAcronym: Detector = (doc, options): Finding[] => {
  const body = bodyOf(doc);
  // HTTP のメソッド名（GET）は略語ではなく、税の名前（VAT、GST）は読み手が名前として知るので、通じる略語と同じく展開を求めない。
  // 並べた名前（JAXA）も、繋いだ略語（JAXA-ISAS）の片割れとして説明済みに数える。
  // 文書が自分で知らせた語（select を書いた文書の SELECT、リンクで引いた講演の場 [Jane Roe, FOSDEM 2024](…)）も同じ。
  const common = new Set([
    ...(options.lexicon ?? []).map((entry) => entry.pattern),
    ...knownByDocument(doc.source, doc.links).concat(patternsOf(doc, "http-method"), patternsOf(doc, "tax-code")),
    ...(doc.names ?? []),
  ]);
  const expandedAt = expansionAt(definitionWordsOf(doc));
  const stated = statedAcronyms(doc.source, { statements: patternsOf(doc, "definition-statement"), markers: patternsOf(doc, "definition-marker") });
  // 一覧の語のすぐ下でその語を名指すリンク（- GPL / [GNU General Public License …](…)）と、略語を話題にして書き出した文
  // （the abbreviation DOB … date of birth）も、略語の説明と読む。
  const spelled = spelledOutAcronyms(
    doc.sentences.map((sentence) => sentence.text),
    patternsOf(doc, "abbreviation-mention"),
  );
  // 略語のすぐ後ろのダッシュで挟んだ同格（the VIX—a measure of …—）、同じ文の前に書いた名前（Small Business Administration … SBA）、
  // 2 つ以上の番号で引く続き物の名前（BCP 78、BCP 14）も、略語の説明と読む。
  const entries = new Set([...termEntryAcronyms(doc.source), ...stated, ...linkedListTerms(doc.source), ...spelled, ...explainedInText(body, doc.sentences)]);
  const headings = doc.sections.map((section) => section.heading);
  // 見出しが略語の名前を書き出していれば（## Federal Open Market Committee の下の FOMC）、説明済み。
  const spelledInHeading = headingsSpellingOut(headings);
  const explainedAsWritten = (word: string): boolean =>
    common.has(word) ||
    entries.has(word) ||
    spelledInHeading(word) ||
    isExpanded(body, word, expandedAt) ||
    headings.some((heading) => expandsInHeading(heading, word, expandedAt));
  // 大文字の違うだけの書き方（TCoP と TCOP）は同じ略語と読む。どちらかで説明してあれば説明済み。
  const explained = new Map<string, boolean>();
  const explainedAlone = (word: string): boolean => {
    const known = explained.get(word) ?? (explainedAsWritten(word) || caseVariantsIn([body, ...headings].join("\n"), word).some(explainedAsWritten));
    explained.set(word, known);
    return known;
  };
  const counted = outsideSpans(acronymsOf(doc, notationOf(doc)), [
    ...sourceNotAcronymSpans(doc.source, (id) => patternsOf(doc, id)),
    ...titledCodeSpans(doc.source, patternsOf(doc, "citation-series")),
  ]);
  const hits = outsideSpans(
    counted,
    unreportedAcronymSpans(doc.source, doc.sentences, doc.links, (id) => patternsOf(doc, id)),
  );
  const acronyms = [...firstHits(hits).keys()];
  const unexplained = new Set(acronyms.filter((acronym) => !isExplained(acronym, explainedAlone)));
  const quoted = [...firstHits(counted).keys()].filter((acronym) => !acronyms.includes(acronym) && !isExplained(acronym, explainedAlone)).length;
  // 定義の一覧（"SOW" means …）で定義する書き手も、略語を展開する書き手と数える。
  const definedByWriter = (acronym: string): boolean => [body, ...headings].some((text) => isBracketed(text, acronym)) || stated.has(acronym);
  const writerSpellsOut = acronyms.filter((acronym) => !common.has(acronym) && explainedAlone(acronym) && definedByWriter(acronym)).length >= options.limit;
  // 日付を読むには文書の木を作る。上限に届かない文書では作らない。
  if (unexplained.size + quoted < options.limit && !writerSpellsOut) return [];
  const bare = [...firstHits(outsideSpans(hits, dateSpans(doc)))].filter(([acronym]) => unexplained.has(acronym));
  const met = bare.length + quoted;
  if (met >= options.limit) return bare.map(([acronym, hit]) => acronymFinding(acronym, hit, met, options.limit));
  if (!writerSpellsOut) return [];
  const alone = bare.filter(([acronym, hit]) => !isNamePartAt(acronym, hit) && !isInHeading(headings, acronym));
  return alone.map(([acronym, hit]) => acronymFinding(acronym, hit, alone.length, options.limit));
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

/** これより短い節は、具体物があるべきか判断できない。 */
const MIN_SENTENCES = 3;

const adviceWordsOf = (doc: ProseDocument): AdviceWords => ({
  openers: (doc.lexicons["advice-opener"] ?? []).map((entry) => entry.pattern),
  endings: (doc.lexicons["advice-ending"] ?? []).map((entry) => entry.pattern),
});

/** 文の半分以上が問いか指示の節（質問の一覧、手引き）は、数字で裏づける主張をしていない。番号だけの文（a.）は数えない。 */
const mostlyClaims = (section: Section, language: string, advice: AdviceWords): boolean => {
  const said = section.sentences.filter((sentence) => !isLabelOnly(sentence));
  return said.filter((sentence) => isClaim(sentence, language, advice)).length * 2 > said.length;
};

export const concreteEvidence: Detector = (doc, options): Finding[] => {
  const entries = letteredIndexEntries(doc.sections);
  const advice = adviceWordsOf(doc);
  const sections = doc.sections.filter(
    (section) => section.sentences.length >= MIN_SENTENCES && !entries.has(section) && mostlyClaims(section, doc.language, advice),
  );
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
export const dashDensity: Detector = (doc, options): Finding[] => {
  const hits = findIn(doc, DASH).filter((hit) => !introducesList(doc.source, hit.offset));
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
