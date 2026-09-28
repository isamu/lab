/** 文末のコロン。後ろに強調の印（**・_）や空白が残っていても見る。 */
const ENDS_WITH_COLON = /[:：][\s*_]*$/u;

/**
 * 後ろの箇条書きや表へ読者を渡す文（「次のとおりとする。」「The following expenses require receipts:」）。
 * 見出しの語を繰り返していても、中身は後ろにある。言い回しは言語パッケージの語彙表 lead-in が持つ。
 */
export const isLeadIn = (sentence: string, phrases: readonly string[]): boolean => {
  const text = sentence.trim().toLowerCase();
  return ENDS_WITH_COLON.test(text) || phrases.some((phrase) => phrase !== "" && text.includes(phrase.toLowerCase()));
};
