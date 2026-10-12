// 人を書く欄（氏名：山下 美咲、Contractor: Priya Raman）に書いた名前。欄の語は語彙表 person-label から。

const FIELD_COLON = /[：:]/u;
/** 欄の行の頭の、Markdown の印（箇条書き、引用、見出し、太字）。 */
const LINE_MARKS = /^[\s>*#+-]*(?:\*\*|__)?/u;
const TRAILING_BOLD = /(?:\*\*|__)$/u;
/** 「：」と名前のあいだ: 空白と太字の印だけ。欄の値の途中の名前（ご宿泊者：森下 千尋 様 の 千尋 様）は欄の名前でない。 */
const VALUE_START = /^[ \t\u3000]*(?:\*\*|__)?[ \t\u3000]*(?:\*\*|__)?$/u;
/** 名前の後ろ: 太字の閉じと、行の終わり。日付などの括弧一つで終わってもよい。「,」の後ろは文の続きのことがある（Priya Raman, and …）。 */
const FIELD_END = /^(?:\*\*|__)?[ \t\u3000]*(?:[(（][^()（）\n]*[)）][ \t\u3000]*)?(?:\r?\n|$)/u;
const LEADING_SPACE = /^[ \t\u3000]+/u;
/** 欄の語の前で語を切らない字。Company name の name は欄の語 Name ではない。患者氏名 の 氏名 は 氏名。 */
const WORD_BEFORE = /[\s\p{Script=Latin}]$/u;

const lineStart = (source: string, offset: number): number => source.lastIndexOf("\n", offset - 1) + 1;

/** 欄の語。行の頭の「:」の前まるごとで、大文字小文字は見ない。漢字やかなの欄の語は、前に語が付いてもよい（患者氏名）。 */
const isPersonLabel = (label: string, labels: readonly string[]): boolean => {
  const lower = label.toLowerCase();
  return labels.some((pattern) => {
    const wanted = pattern.toLowerCase();
    return lower === wanted || (lower.endsWith(wanted) && !WORD_BEFORE.test(lower.slice(0, -wanted.length)));
  });
};

/** 名前の後ろの敬称（中村 健太 様）を一つ除いた残り。 */
const afterSuffix = (rest: string, suffixes: readonly string[]): string => {
  const trimmed = rest.replace(LEADING_SPACE, "");
  const suffix = suffixes.find((word) => trimmed.startsWith(word));
  return suffix === undefined ? rest : trimmed.slice(suffix.length);
};

/**
 * source の offset から length の名前が、人を書く欄の行の、欄の語と「：」のすぐ後ろにあり、そこで行が終わるか（氏名：山下 美咲、
 * 患者氏名：中村 健太 様、- **Contractor:** Priya Raman、Name: **Priya Raman**）。suffixes は名前の後ろに付いてよい敬称（様）。
 */
export const isInPersonField = (source: string, offset: number, length: number, labels: readonly string[], suffixes: readonly string[] = []): boolean => {
  const head = source.slice(lineStart(source, offset), offset);
  const colon = head.search(FIELD_COLON);
  if (colon < 0 || !VALUE_START.test(head.slice(colon + 1)) || !FIELD_END.test(afterSuffix(source.slice(offset + length), suffixes))) return false;
  const label = head.slice(0, colon).replace(LINE_MARKS, "").replace(TRAILING_BOLD, "").trim();
  return label !== "" && isPersonLabel(label, labels);
};
