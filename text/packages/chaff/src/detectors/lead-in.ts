/** 文末のコロン。後ろに強調の印（**・_）や空白が残っていても見る。 */
const ENDS_WITH_COLON = /[:：][\s*_]*$/u;

export const endsWithColon = (sentence: string): boolean => ENDS_WITH_COLON.test(sentence.trim());

/**
 * 後ろの箇条書きや表へ読者を渡す文（「次のとおりとする。」「The following expenses require receipts:」）。
 * 見出しの語を繰り返していても、中身は後ろにある。言い回しは言語パッケージの語彙表 lead-in が持つ。
 */
export const isLeadIn = (sentence: string, phrases: readonly string[]): boolean => {
  const text = sentence.trim().toLowerCase();
  return endsWithColon(text) || phrases.some((phrase) => phrase !== "" && text.includes(phrase.toLowerCase()));
};

/** 渡す先（following: 同じ節の、その文より後ろ）が空なら、渡す文ではなくただの繰り返し。 */
export const handsOver = (sentence: string, following: string, phrases: readonly string[]): boolean => following.trim() !== "" && isLeadIn(sentence, phrases);
