/**
 * A round bracket written as the mouth of an emoticon (":-)", ";)", ":(" ). It opens and closes nothing.
 * text is the section, offset the bracket's position.
 */

/**
 * The eyes and an optional nose right before the mouth, at the start of a word or after an opening quote: ":", ";" or "=",
 * then "-" or "'". Not after an opening bracket: "(:)" names the colon.
 */
const FACE_BEFORE = /(?:^|[\s"'“‘])[:;=][-']?$/u;

/** After the mouth: the end, a space, a closing quote or punctuation. A letter or digit would make it part of a word. */
const FACE_AFTER = /^(?:$|[\s"'”’),.;:!?])/u;

const LOOK_AROUND = 4;

export const isEmoticonMouth = (text: string, offset: number): boolean => {
  const mark = text[offset];
  if (mark !== "(" && mark !== ")") return false;
  return FACE_BEFORE.test(text.slice(Math.max(0, offset - LOOK_AROUND), offset)) && FACE_AFTER.test(text.slice(offset + 1, offset + 2));
};
