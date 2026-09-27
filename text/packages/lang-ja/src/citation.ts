// 他の文書を指す参照。「民法第709条」の第709条はこの文書の条ではない。

/** 文書の種類を表す語。名前がこれで終われば、その直後の「第N条」はその文書の条。長いものから当てる。 */
const DOCUMENT_KINDS = [
  "ガイドライン",
  "契約書",
  "法律",
  "条例",
  "条約",
  "契約",
  "規約",
  "規程",
  "規則",
  "約款",
  "細則",
  "要綱",
  "要領",
  "指針",
  "基準",
  "協定",
  "覚書",
  "告示",
  "通達",
  "法",
  "令",
];

/** 「本契約」「当規約」はこの文書自身。「同法」は前に出た別の法令なので、他の文書。 */
const SELF_PREFIXES = ["本", "当"];

const NAME_CHAR = /[\p{Script=Han}\p{Script=Katakana}ー・A-Za-z0-9]/u;

/** 名前は長くても数十字。後ろ向きに読む長さを抑え、長い行で遅くならないようにする。 */
const MAX_NAME_LENGTH = 30;

/**
 * at の直前に書かれた文書名。「民法第709条」なら「民法」。この文書の条を指すなら undefined。
 * 名前が種類の語だけ（「契約第3条」）のときも、どの文書か決まらないので undefined にする。
 */
/** 法律の題名は平仮名を挟む（「個人情報の保護に関する法律」）。「法律」で終わるときだけ、平仮名もさかのぼって読む。 */
const TITLE_CHAR = /[\p{Script=Han}\p{Script=Katakana}\p{Script=Hiragana}ー・A-Za-z0-9]/u;
const LAW_TITLE_END = "法律";

const nameBefore = (text: string, at: number, char: RegExp): string => {
  let start = at;
  while (start > 0 && at - start < MAX_NAME_LENGTH && char.test(text[start - 1] ?? "")) start -= 1;
  return text.slice(start, at);
};

export const citedDocument = (text: string, at: number): string | undefined => {
  const plain = nameBefore(text, at, NAME_CHAR);
  const name = plain === LAW_TITLE_END ? nameBefore(text, at, TITLE_CHAR) : plain;
  const kind = DOCUMENT_KINDS.find((candidate) => name.endsWith(candidate));
  if (kind === undefined || name.length === kind.length) return undefined;
  return SELF_PREFIXES.some((prefix) => name.startsWith(prefix)) ? undefined : name;
};
