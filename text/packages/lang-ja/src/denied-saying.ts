// 「X」とは の後ろが X の定義か、X という言い方の打ち消しか。

/** 読点を挟まずに、打ち消しで文を終える短い述語（言いません、書けません、限りません）。 */
const DENIED_SAYING = /^[^、。\n]{0,12}(?:ません|ない|なかった)(?:[。．]|$)/u;
/** DENIED_SAYING を照らす長さ。述語の 12 字と打ち消しと句点が入る。 */
const DENIAL_REACH = 20;

/**
 * text の at（「X」とは の直後）からの述語が打ち消しで終わるか。「AI が書いた」とは言いません は、X を定義したのではなく、
 * X という言い方を引いて打ち消している。定義（「X」とは、…をいう。）は読点か説明が続く。
 */
export const deniesSaying = (text: string, at: number): boolean => DENIED_SAYING.test(text.slice(at, at + DENIAL_REACH));
