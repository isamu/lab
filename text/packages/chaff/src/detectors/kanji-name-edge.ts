import type { Span, Token } from "../plugin.ts";

/** 頭から外す語と、文書全体の座標でのその範囲。 */
export type Edge = { readonly surface: string; readonly span: Span };

/** 代の序数（第百二代、初代）。数は漢数字か算用数字。 */
const ORDINAL = /^(?:第[〇一二三四五六七八九十百千万0-9０-９]+代|初代)/u;

const KANJI_OR_HIRAGANA = /[一-鿿ぁ-ゖ]/u;

/**
 * 括弧の中身（span: 括弧を除いた範囲）が、漢字の連なり [start, end) と、漢字も平仮名も無い語（ページ、センター、Ｗｅｂ）だけか。
 * 書き手が括弧でくくって 1 つの名前と示したもの（「登録業者情報検索入力ページ」）。平仮名があれば、括弧の中は文や句。
 */
export const holdsName = (text: string, span: Span, start: number, end: number): boolean =>
  span.start <= start && end <= span.end && !KANJI_OR_HIRAGANA.test(text.slice(span.start, start) + text.slice(end, span.end));

/** 連なりの前（before: 文の頭から連なりまで）が、空白を挟んだ法人格で終わるか（一般社団法人 全国銀行個人信用情報センター）。 */
export const followsForm = (before: string, forms: readonly string[]): boolean => {
  const trimmed = before.trimEnd();
  return trimmed !== before && forms.some((form) => trimmed.endsWith(form));
};

/** 組織の語の前に要る字数（organisation-run と同じ）。1 字なら普通の語の一部（本部、外部）。 */
const MIN_UNIT_BODY_LENGTH = 2;
const KANJI_CHAR = /^[一-鿿]$/u;

/** text の尻の漢字の一続き。 */
const lastKanjiRun = (text: string): string => {
  const chars = [...text];
  const start = chars.findLastIndex((char) => !KANJI_CHAR.test(char)) + 1;
  return chars.slice(start).join("");
};

/**
 * 連なりの前（before）が、空白を挟んだ組織の区切り（初等中等教育局 教科書課 教科用特定図書普及促進係の「教科書課」）で終わるか。
 * 組織の名前を上から下へ空白で区切って書いたもので、連なりはその続き。
 */
export const followsUnit = (before: string, units: readonly string[]): boolean => {
  const trimmed = before.trimEnd();
  const last = trimmed === before ? "" : lastKanjiRun(trimmed);
  return last !== "" && units.some((unit) => last.endsWith(unit) && [...last].length - [...unit].length >= MIN_UNIT_BODY_LENGTH);
};

const ITEM_SEPARATORS = ["、", "，"];

const opensItem = (before: string): boolean => {
  const trimmed = before.trimEnd();
  return trimmed === "" || ITEM_SEPARATORS.some((separator) => trimmed.endsWith(separator));
};

const closesItem = (after: string): boolean => {
  const trimmed = after.trimStart();
  return trimmed === "" || ITEM_SEPARATORS.some((separator) => trimmed.startsWith(separator));
};

/** text の [start, end) が、「、」で区切った 1 項目まるごとか（区長、選挙管理委員会事務局長、総務課長の 2 番目）。 */
export const isListItem = (text: string, start: number, end: number): boolean => start < end && opensItem(text.slice(0, start)) && closesItem(text.slice(end));

/**
 * 連なり（文書全体の座標で start から始まる）の頭の、前に書いたものを指す語（上記、当該）。解析がその語を別の語に分け、
 * 後ろに語が残るときだけ。読み手は指す語と後ろの語の切れ目を迷わない。
 */
export const leadingReference = (tokens: readonly Token[], start: number, name: string, references: readonly string[]): Token | undefined => {
  const token = tokens.find((candidate) => candidate.span.start === start);
  if (token === undefined || !references.includes(token.surface)) return undefined;
  return name.startsWith(token.surface) && name.length > token.surface.length ? token : undefined;
};

/**
 * 連なり（文書全体の座標で start から始まる）の頭の、代の序数（第百二代内閣総理大臣の「第百二代」、初代）。序数が解析の語の切れ目で
 * 終わり、後ろに語が残るときだけ。何代目かは後ろの名前や役職に付いた語で、読み手は切れ目を迷わない。
 */
export const leadingOrdinal = (tokens: readonly Token[], start: number, name: string): Edge | undefined => {
  const surface = ORDINAL.exec(name)?.[0];
  if (surface === undefined || surface.length >= name.length) return undefined;
  const end = start + surface.length;
  return tokens.some((token) => token.span.end === end) ? { surface, span: { start, end } } : undefined;
};

/** 漢数字で書いた月と日までの日付（令和七年六月二十三日、十一月二十五日）。 */
const KANJI_DATE = /^(?:(?:明治|大正|昭和|平成|令和)?[〇一二三四五六七八九十百千元]+年)?[一二三四五六七八九十]+月[一二三十]*[一二三四五六七八九十]日/u;
/** 元号の付いた年（令和元年）。度が続けば（令和七年度）語の一部。元号の無い年だけ（十年）は数の語の一部にもなるので読まない。 */
const ERA_YEAR = /^(?:明治|大正|昭和|平成|令和)[〇一二三四五六七八九十百千元]+年(?!度)/u;
/** 〇（漢字の連なりの外の字）で割れた年の後半（二〇二七年の「二七年」）。度が続けば語の一部。 */
const YEAR_AFTER_ZERO = /^[〇一二三四五六七八九十]*年(?!度)/u;
const ZERO = "〇";

/**
 * 連なり（文書全体の座標で start から始まる）の頭の、漢数字で書いた日付（大正三年十一月二十五日学習院輔仁会の「大正三年十一月二十五日」、
 * 令和元年東日本台風の「令和元年」）。連なりのすぐ前が〇なら、〇で割れた年の後半（二〇二七年国際園芸博覧会の「二七年」）も。
 * 算用数字の日付（7月1日）が連なりを切るのと同じく、日付は後ろの名前の一部ではない。連なりがまるごと日付（署名の日付の行）でもよい。
 * 日付が解析の語の切れ目で終わるときだけ。
 */
export const leadingDate = (tokens: readonly Token[], start: number, name: string, before = ""): Edge | undefined => {
  const surface = before.endsWith(ZERO) ? YEAR_AFTER_ZERO.exec(name)?.[0] : (KANJI_DATE.exec(name)?.[0] ?? ERA_YEAR.exec(name)?.[0]);
  if (surface === undefined) return undefined;
  const end = start + surface.length;
  return tokens.some((token) => token.span.end === end) ? { surface, span: { start, end } } : undefined;
};

/**
 * 連なり（文書全体の座標で end に終わる）の尻が、仮名へ続く接続の語の漢字（方針及び基本構想の「及」、又は、並びに）なら、その字。
 * 解析が接続の語と読み、語が連なりの中で始まって連なりの外まで続くときだけ。字は後ろの語とつなぐ語で、名前の一部ではない。
 */
export const trailingConjunction = (tokens: readonly Token[], start: number, end: number, run: string): { surface: string; start: number } | undefined => {
  const token = tokens.find((candidate) => candidate.span.start < end && end < candidate.span.end);
  if (token === undefined || token.pos !== "CCONJ" || token.span.start <= start) return undefined;
  return { surface: run.slice(run.length - (end - token.span.start)), start: token.span.start };
};
