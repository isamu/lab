// A newsletter's issue (メールマガジン第90号, Issue 12): an issue number in the title or the head lines. Pure. The words
// come from the language's newsletter-issue lexicon; an issue goes to every subscriber and takes no greeting and no closing.
import type { Lexicon } from "./plugin.ts";
import { escapeRegExp } from "./orthography.ts";

/** The word before an issue's number (第, Issue) and the one after it (号), each pair one lexicon entry's group. */
export type IssueWords = readonly { readonly head: string; readonly tail: string }[];

const GROUP_SEPARATOR = "…";

/** Each entry's pattern is the issue number's form with … for the number (第…号, Issue …). */
export const issueWordsOf = (lexicon: Lexicon): IssueWords =>
  lexicon.flatMap((entry) => {
    const parts = entry.pattern.split(GROUP_SEPARATOR);
    const [head = "", tail = ""] = parts;
    return parts.length !== 2 || head === "" ? [] : [{ head, tail }];
  });

const LATIN_LETTER = /^[A-Za-z]/u;

/**
 * An issue number: the head, a number, the tail, then a space, a bracket, a comma or the line's end (第90号 2025/11/12,
 * 第506号（令和7年5月23日）). A word after it makes it part of a name (第3号議案). A Latin head starts a word (not Tissue 3).
 */
const issuePatternOf = ({ head, tail }: IssueWords[number]): RegExp =>
  new RegExp(`${LATIN_LETTER.test(head) ? "(?<![A-Za-z])" : ""}${escapeRegExp(head)}[0-9０-９]+${escapeRegExp(tail)}(?=[\\s（(,、，]|$)`, "u");

/** Whether one of the lines (the title and the lines before the first sentence) holds an issue number. */
export const isIssueHead = (headLines: readonly string[], words: IssueWords): boolean => {
  const patterns = words.map(issuePatternOf);
  return headLines.some((line) => patterns.some((pattern) => pattern.test(line.trim())));
};
