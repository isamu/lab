// A code span closes at the next run of exactly as many backticks as opened it: ``a ` b`` is one span.
const CODE_SPAN = /(?<!`)(`+)(?!`)[\s\S]*?(?<!`)\1(?!`)/gu;

const OPENING = new Set("(\"'“‘[");
const CLOSING = new Set(")\"'”’].,:;!?");

/** The word without the punctuation around it: `(optional)` is `optional`, `Setup:` is `Setup`. */
const bareWord = (token: string): string => {
  const chars = [...token];
  const first = chars.findIndex((char) => !OPENING.has(char));
  const last = chars.findLastIndex((char) => !CLOSING.has(char));
  return first === -1 || last < first ? "" : chars.slice(first, last + 1).join("");
};

/** A mark a word of prose does not carry inside it: `config.yaml`, `snake_case`, `src/index`, `useEffect()`, `$HOME`. */
const CODE_MARK = /[._/\\=(){}[\]<>$@#*]/u;

/** A word that starts in lower case and has a capital after it (`useEffect`, `iPhone`): its case is its owner's. */
const CAMEL_CASE = /^[a-z]+[A-Z]/u;

const isCodeWord = (token: string): boolean => {
  const bare = bareWord(token);
  return bare.startsWith("-") || CAMEL_CASE.test(bare) || CODE_MARK.test(bare);
};

/**
 * The heading without its code words: a code span, a flag (`--force`), a file name (`config.yaml`), an identifier
 * (`useEffect`). They are written the same in Title Case and in sentence case, so they are evidence for neither.
 */
export const withoutCodeWords = (heading: string): string =>
  heading
    .replace(CODE_SPAN, " ")
    .split(/\s+/u)
    .filter((token) => !isCodeWord(token))
    .join(" ");
