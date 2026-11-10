/** 連なりの前後の字と、名前を示す句の語彙。 */
type Surroundings = { readonly before: string; readonly next: string };
type ContextWords = { readonly designations: readonly string[]; readonly noticeEndings: readonly string[] };

/** 連なりの後ろ（next）が、制度が区分に入れることを言う句で始まるか（認定希少種保全動植物園等として認定）。 */
const isDesignated = (run: Surroundings, words: ContextWords): boolean => words.designations.some((phrase) => run.next.startsWith(phrase));

/** 行がお知らせの題で、連なりがその「の」の前か（[e-Gov]〜設定解除完了のお知らせ）。題は句点で閉じない一行。 */
const isNoticeTitle = (run: Surroundings, words: ContextWords): boolean => {
  const next = run.next.trim();
  return !run.before.includes("\n") && words.noticeEndings.some((ending) => next === `の${ending}`);
};

/** 前後の字が、漢字の連なりを名前と示しているか: 制度が決めた区分の名前か、送り手が付けたお知らせの題の名前。 */
export const isNamedByContext = (run: Surroundings, words: ContextWords): boolean => isDesignated(run, words) || isNoticeTitle(run, words);
