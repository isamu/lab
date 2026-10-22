// A newsletter's issue (メールマガジン第90号, Vol. 12): an issue number in the title. Pure. The words
// come from the language's newsletter-issue lexicon; an issue goes to every subscriber and takes no greeting and no closing.
import type { Lexicon } from "./plugin.ts";
import { escapeRegExp } from "./orthography.ts";

/** The word before an issue's number (第, Vol.) and the one after it (号), each pair from one lexicon entry. */
export type IssueWords = readonly { readonly head: string; readonly tail: string }[];

const GROUP_SEPARATOR = "…";

/** Each entry's pattern is the issue number's form with … for the number (第…号, Vol. …). */
export const issueWordsOf = (lexicon: Lexicon): IssueWords =>
  lexicon.flatMap((entry) => {
    const parts = entry.pattern.split(GROUP_SEPARATOR);
    const [head = "", tail = ""] = parts;
    return parts.length !== 2 || head === "" ? [] : [{ head, tail }];
  });

const LATIN_LETTER = /^[A-Za-z]/u;

/**
 * An issue number: the head, a number, the tail, then a space, a bracket, a comma or the line's end (第90号 2025/11/12,
 * 第506号（令和7年5月23日）, Vol. 12[April]). A word after it makes it part of a name (第3号議案). A Latin head starts a
 * word (not Tissue 3).
 */
const issuePatternOf = ({ head, tail }: IssueWords[number]): RegExp =>
  new RegExp(`${LATIN_LETTER.test(head) ? "(?<![A-Za-z])" : ""}${escapeRegExp(head)}[0-9０-９]+${escapeRegExp(tail)}(?=[\\s（(【［[,、，]|$)`, "u");

/** A Markdown heading: the document's title. A subject line (件名：議案 第3号) or a citation (Vol. 12) in the body is not one. */
const HEADING = /^#{1,6}\s/u;

export const isHeadingLine = (line: string): boolean => HEADING.test(line.trim());

/** Whether a heading among the head lines (the lines before the first sentence) holds an issue number: the title of an issue. */
export const isIssueHead = (headLines: readonly string[], words: IssueWords): boolean => {
  const patterns = words.map(issuePatternOf);
  return headLines.some((line) => isHeadingLine(line) && patterns.some((pattern) => pattern.test(line.trim())));
};
