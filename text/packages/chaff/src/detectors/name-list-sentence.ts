// A list of names joined by 、 with no sentence end (an attendee list: 区長、副区長、教育長、総務部長、…). Each item is a name
// or a title, and the line says nothing, so its length is the number of people, not a long sentence. Pure.

/** Fewer items than this read as a phrase (東京、大阪、名古屋), and are short anyway. */
const MIN_ITEMS = 5;
/** An item longer than this is a clause, not a name or a title (子ども家庭総合支援センター所長 is 15). */
const MAX_ITEM_LENGTH = 20;

const SEPARATOR = /[、，]/u;
/** A sentence's end mark, past any closing bracket or quote. A list has none. */
const SENTENCE_END = /[。．！？!?][）)」』】〕］》〉"”’]*\s*$/u;
/** A clause ends in hiragana (〜して、〜であり、〜は、); a name or a title ends in kanji, katakana, a letter, a digit or a bracket. */
const HIRAGANA_END = /\p{Script=Hiragana}$/u;
/** A topic, subject or object particle makes an item a clause (本計画は来年度から実施予定), not a name. */
const CLAUSE_PARTICLE = /[はがを]/u;

const isNameItem = (item: string): boolean => item !== "" && [...item].length <= MAX_ITEM_LENGTH && !HIRAGANA_END.test(item) && !CLAUSE_PARTICLE.test(item);

/** Whether the text is a list of names: at least five short items that are no clause (no hiragana end, no は/が/を), and no sentence end. */
export const isNameList = (text: string): boolean => {
  const trimmed = text.trim();
  if (SENTENCE_END.test(trimmed)) return false;
  const items = trimmed.split(SEPARATOR).map((item) => item.trim());
  return items.length >= MIN_ITEMS && items.every(isNameItem);
};
