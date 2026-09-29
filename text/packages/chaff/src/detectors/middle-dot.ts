const MIDDLE_DOT = /・/gu;

/** 文頭か行頭（前に空白だけ）の「・」。前に並べる項目が無いので、箇条書きの印。 */
const BULLET_DOT = /(^|\n)[^\S\n]*・/gu;

/**
 * 項目を並べる中黒の数。箇条書きの印の「・」は数えない。
 * 「・ 水分を補給すること」が何行続いても、どこまでが 1 つの項目かは改行で読める。
 */
export const parallelDotCount = (text: string): number => [...text.replace(BULLET_DOT, "$1").matchAll(MIDDLE_DOT)].length;
