/** 連なりの前後の字と、名前を示す句の語彙。 */
type Surroundings = { readonly before: string; readonly next: string };
type ContextWords = { readonly designations: readonly string[]; readonly noticeEndings: readonly string[] };

/** 連なりの後ろ（next）が、制度が区分に入れることを言う句で始まるか（認定希少種保全動植物園等として認定）。 */
const isDesignated = (run: Surroundings, words: ContextWords): boolean => words.designations.some((phrase) => run.next.startsWith(phrase));

/** 文を閉じる印。題の行には無い。 */
const SENTENCE_END = /[。．！？!?]/u;

/**
 * 行がお知らせや議題の題で、連なりがその中にあるか（[e-Gov]〜設定解除完了のお知らせ、〜指定管理者の選定に関する方針について）。
 * 題は題を閉じる語で終わる一行で、続く行（議題の下の「資料配付のみ」）を含めて文を閉じる印が無い。
 */
const isNoticeTitle = (run: Surroundings, words: ContextWords): boolean => {
  if (SENTENCE_END.test(run.before + run.next)) return false;
  const lineRest = run.next.split("\n")[0]?.trim() ?? "";
  return words.noticeEndings.some((ending) => lineRest.endsWith(ending));
};

/** 前後の字が、漢字の連なりを名前と示しているか: 制度が決めた区分の名前か、送り手が付けたお知らせの題の名前。 */
export const isNamedByContext = (run: Surroundings, words: ContextWords): boolean => isDesignated(run, words) || isNoticeTitle(run, words);
