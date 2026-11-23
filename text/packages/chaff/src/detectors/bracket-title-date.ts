/**
 * 詩や文章の題の行で、日付や年を添える開いたままの角括弧（「Year of Meteors [1859-60」）。題の印の書き方で、閉じ忘れではない。
 * text は節の文字列で、offset は開きの位置。題は前後を空行で挟んだ一行で、開きの前に題の字があり、開きの後ろは行の終わりまで数を含む。
 */

/** 題の行の長さの上限。これより長い行は本文の一行。 */
const MAX_TITLE_LENGTH = 80;

const DIGIT = /\d/u;
const BLANK = /^[ \t\u3000]*$/u;

const lineStartAt = (text: string, offset: number): number => text.lastIndexOf("\n", offset - 1) + 1;

const lineEndAt = (text: string, offset: number): number => {
  const end = text.indexOf("\n", offset);
  return end === -1 ? text.length : end;
};

const blankBefore = (text: string, lineStart: number): boolean => lineStart === 0 || BLANK.test(text.slice(lineStartAt(text, lineStart - 1), lineStart - 1));

const blankAfter = (text: string, lineEnd: number): boolean => lineEnd >= text.length || BLANK.test(text.slice(lineEnd + 1, lineEndAt(text, lineEnd + 1)));

export const isTitleDateOpen = (text: string, offset: number): boolean => {
  if (text.charAt(offset) !== "[") return false;
  const start = lineStartAt(text, offset);
  const end = lineEndAt(text, offset);
  const note = text.slice(offset + 1, end);
  return (
    text.slice(start, offset).trim() !== "" &&
    end - start <= MAX_TITLE_LENGTH &&
    !note.includes("]") &&
    DIGIT.test(note) &&
    blankBefore(text, start) &&
    blankAfter(text, end)
  );
};
