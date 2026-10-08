// One function's return type stated two ways on one page: the signature in a code block against a "Returns:" line, a
// table's return column, or a sentence ("measure returns a string", 「measure は文字列を返します」). Pure; reads the
// Markdown source. The words (Returns, 戻り値, returns, 返します, は, and the type words string, 文字列) come from the
// language's lexicons. A statement is compared only with the signatures of the function it names, and only when both
// sides are readable. The signature reader is small and TypeScript/Python-shaped; it may later be shared with
// parameter-table.ts.

/** The words of one language that state a return type. `kinds` maps a lower-cased type word to a kind (string, array). */
export type ReturnWords = {
  readonly labels: readonly string[];
  readonly verbs: readonly string[];
  /** What may follow the function's name before the verb (は, が); none for a language that puts the verb first. */
  readonly subjects: readonly string[];
  readonly kinds: ReadonlyMap<string, string>;
};

/** A statement that disagrees with every signature of its function: what it says, what a signature says, and where. */
export type ReturnTypeClash = { readonly fn: string; readonly stated: string; readonly signature: string; readonly offset: number };

/** A return type as written: a type in code (`string[]`), or the kind a type word names (a string → string). */
type Stated = { readonly code: string; readonly written: string } | { readonly kind: string; readonly written: string };

type Statement = { readonly fn: string; readonly stated: Stated; readonly offset: number };
type Signature = { readonly fn: string; readonly params: string; readonly returns: string; readonly offset: number };
type Line = { readonly text: string; readonly start: number; readonly fenced: boolean; readonly section: number };

const FENCE = /^ {0,3}(`{3,}|~{3,})/u;
const HEADING = /^ {0,3}#{1,6}[ \t]/u;
const TABLE_ROW = /^[ \t]{0,3}\|/u;
const DELIMITER_ROW = /^[ \t]{0,3}\|?[ \t]*:?-{3,}/u;
const IDENTIFIER = /^[A-Za-z_$][\w$]*/u;
const DECLARATION_HEAD = /^(?:(?:export|default|declare|async|public|static)\s+)*(?:(?:function\*?|def|fn|func)\s+)?/u;
const ARROW_HEAD = /^(?:(?:export|declare)\s+)*(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?/u;
const RETURN_MARK = /^\s*(?::|->)\s*/u;
/** What may close a declaration line after its return type: an arrow's `=>` or a body's `{` with what follows, `;`, Python's `:`. */
const withoutDeclarationTail = (text: string): string => {
  const cut = [text.indexOf("=>"), text.indexOf("{")].filter((at) => at !== -1);
  const head = (cut.length === 0 ? text : text.slice(0, Math.min(...cut))).trim();
  return head.endsWith(";") || head.endsWith(":") ? head.slice(0, -1).trim() : head;
};
const GENERICS = /^<[^<>()]*>/u;
const TYPE_NAME = String.raw`[A-Za-z_$][\w$.]*(?:<[\w$.,\s<>[\]|]*>|\[[\w$.,\s[\]|]*\])?(?:\[\])*`;
/** A type as code writes it: names, generic arguments, array brackets, and unions of those. */
const TYPE_TEXT = new RegExp(String.raw`^${TYPE_NAME}(?:\s*\|\s*${TYPE_NAME})*$`, "u");
/** Where a sentence ends, so a type word of the next sentence is not read as this one's. */
const SENTENCE_END = /[。！？!?;]|\.(?=\s|$)/u;
const NOTHING_TYPES: ReadonlySet<string> = new Set(["null", "undefined", "void", "None"]);
/** The kind of a type name in code; a name not listed (a class, a generic parameter, Promise<…>) has none. */
const CODE_KINDS: ReadonlyMap<string, string> = new Map([
  ["string", "string"],
  ["str", "string"],
  ["number", "number"],
  ["int", "number"],
  ["float", "number"],
  ["bigint", "number"],
  ["boolean", "boolean"],
  ["bool", "boolean"],
  ["list", "array"],
  ["tuple", "array"],
]);

const linesOf = (source: string): Line[] => {
  const state = { start: 0, fence: "", section: 0 };
  return source.split("\n").map((text) => {
    const start = state.start;
    state.start += text.length + 1;
    const mark = FENCE.exec(text)?.[1];
    const closes = mark !== undefined && state.fence !== "" && mark[0] === state.fence[0] && mark.length >= state.fence.length;
    if (mark !== undefined && (state.fence === "" || closes)) {
      state.fence = closes ? "" : mark;
      return { text, start, fenced: true, section: state.section };
    }
    if (state.fence === "" && HEADING.test(text)) state.section += 1;
    return { text, start, fenced: state.fence !== "", section: state.section };
  });
};

/** The index of the ) that closes the ( at `open`, or -1. */
const closingParen = (text: string, open: number): number => {
  const state = { depth: 0, at: -1 };
  [...text.slice(open)].some((char, index) => {
    if (char === "(") state.depth += 1;
    if (char === ")") state.depth -= 1;
    if (state.depth === 0) state.at = open + index;
    return state.depth === 0;
  });
  return state.at;
};

const squeeze = (text: string): string => text.replace(/\s+/gu, "");

/** `Array<string>` is `string[]`: the inner generic first, so Array<Array<string>> becomes string[][]. */
const withoutArrayGenerics = (type: string): string => {
  const next = type.replace(/(?<![\w$.])Array<([^<>]*)>/u, (_whole, inner: string) => (inner.includes("|") ? `(${inner})[]` : `${inner}[]`));
  return next === type ? type : withoutArrayGenerics(next);
};

/** The members of a union at its top level, outside brackets. */
const unionMembers = (type: string): string[] => {
  const state = { depth: 0, from: 0 };
  const members: string[] = [];
  [...type].forEach((char, index) => {
    if ("(<[{".includes(char)) state.depth += 1;
    if (")>]}".includes(char)) state.depth -= 1;
    if (char !== "|" || state.depth !== 0) return;
    members.push(type.slice(state.from, index));
    state.from = index + 1;
  });
  return [...members, type.slice(state.from)].filter((member) => member !== "");
};

/** A code type's members in one spelling: no spaces, Array<T> as T[], sorted. */
export const typeMembers = (type: string): string[] =>
  unionMembers(withoutArrayGenerics(squeeze(type))).toSorted((left, right) => left.localeCompare(right, "en"));

/** The kind of one member, or undefined when its name says nothing a type word could (WrapResult, T, Promise<…>). */
const kindOfMember = (member: string): string | undefined => {
  if (member.endsWith("[]") || /^(?:list|List|tuple|Tuple)\[/u.test(member)) return "array";
  return CODE_KINDS.get(member);
};

/**
 * A type in a sentence or a cell is read only when it can be a type and not a parameter's name: each member has a kind, is
 * null or the like, or is a capitalised name (WrapResult). `text` is a name, and `null` alone says when, not what.
 */
const isReadableCode = (type: string): boolean => {
  const members = typeMembers(type);
  const readable = members.every((member) => kindOfMember(member) !== undefined || NOTHING_TYPES.has(member) || /^[A-Z]/u.test(member));
  return TYPE_TEXT.test(type.trim()) && readable && members.some((member) => !NOTHING_TYPES.has(member));
};

const declaredAt = (line: string): { readonly fn: string; readonly afterName: number } | undefined => {
  const arrow = ARROW_HEAD.exec(line);
  if (arrow?.[1] !== undefined) return { fn: arrow[1], afterName: arrow[0].length };
  const headLength = DECLARATION_HEAD.exec(line)?.[0].length ?? 0;
  const fn = IDENTIFIER.exec(line.slice(headLength))?.[0];
  return fn === undefined ? undefined : { fn, afterName: headLength + fn.length };
};

/** A declaration with a return type (`wrap(text: string): string[]`, `def f(x) -> str:`); a call has none. */
export const signatureOf = (line: string, offset = 0): Signature | undefined => {
  const declared = declaredAt(line);
  if (declared === undefined) return undefined;
  const open = declared.afterName + (GENERICS.exec(line.slice(declared.afterName))?.[0].length ?? 0);
  const close = line[open] === "(" ? closingParen(line, open) : -1;
  const mark = close === -1 ? null : RETURN_MARK.exec(line.slice(close + 1));
  if (close === -1 || mark === null) return undefined;
  const returns = withoutDeclarationTail(line.slice(close + 1 + mark[0].length));
  return TYPE_TEXT.test(returns) ? { fn: declared.fn, params: squeeze(line.slice(open + 1, close)), returns, offset } : undefined;
};

const signaturesOf = (lines: readonly Line[]): Signature[] =>
  lines.flatMap((line) => {
    const lead = line.text.length - line.text.trimStart().length;
    const signature = line.fenced ? signatureOf(line.text.trim(), line.start + lead) : undefined;
    return signature === undefined ? [] : [signature];
  });

const escaped = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);

const isSpaced = (word: string): boolean => /^[A-Za-z]/u.test(word);

/** The type words in a stretch of text: whole words where words are spaced, any occurrence where they are not. */
const typeWordsIn = (text: string, kinds: ReadonlyMap<string, string>): [string, string][] => {
  const bare = text.replace(/`[^`]*`/gu, " ");
  return [...kinds].filter(([word]) => (isSpaced(word) ? new RegExp(String.raw`\b${escaped(word)}\b`, "iu").test(bare) : bare.includes(word)));
};

/** What a stretch of text says is returned: one readable code span, else the one kind its type words name. */
const statedIn = (text: string, kinds: ReadonlyMap<string, string>): Stated | undefined => {
  const trimmed = text.trim();
  if (TYPE_TEXT.test(trimmed) && isReadableCode(trimmed)) return { code: trimmed, written: trimmed };
  const spans = new Set([...trimmed.matchAll(/`([^`]+)`/gu)].map((match) => match[1] ?? "").filter(isReadableCode));
  if (spans.size === 1) return { code: [...spans][0] ?? "", written: [...spans][0] ?? "" };
  const words = typeWordsIn(trimmed, kinds);
  const named = new Set(words.map(([, kind]) => kind));
  return spans.size === 0 && named.size === 1 && words[0] !== undefined ? { kind: words[0][1], written: words[0][0] } : undefined;
};

const firstSentence = (text: string): string => text.split(SENTENCE_END)[0] ?? "";

const lineOf = (lines: readonly Line[], offset: number): Line | undefined =>
  lines.find((line) => line.start <= offset && offset <= line.start + line.text.length);

/** The function each section's "Returns:" line is about: the one function its code blocks declare. */
const sectionFunctions = (lines: readonly Line[], signatures: readonly Signature[]): Map<number, string> => {
  const bySection = new Map<number, Set<string>>();
  signatures.forEach((signature) => {
    const section = lineOf(lines, signature.offset)?.section ?? -1;
    bySection.set(section, (bySection.get(section) ?? new Set<string>()).add(signature.fn));
  });
  return new Map([...bySection].flatMap(([section, names]): [number, string][] => (names.size === 1 ? [[section, [...names].join("")]] : [])));
};

const labelPattern = (labels: readonly string[]): RegExp =>
  new RegExp(String.raw`^[ \t]*(?:[-*+][ \t]+)?(?:\*\*|__)?(?:${labels.map(escaped).join("|")})(?:\*\*|__)?[ \t]*[:：](?:\*\*|__)?`, "iu");

/** A "Returns:" line under a heading whose code blocks declare one function. */
const labelStatements = (lines: readonly Line[], functions: ReadonlyMap<number, string>, words: ReturnWords): Statement[] => {
  if (words.labels.length === 0) return [];
  const label = labelPattern(words.labels);
  return lines.flatMap((line) => {
    const head = line.fenced ? null : label.exec(line.text);
    const fn = functions.get(line.section);
    if (head === null || fn === undefined) return [];
    const stated = statedIn(firstSentence(line.text.slice(head[0].length)), words.kinds);
    return stated === undefined ? [] : [{ fn, stated, offset: line.start }];
  });
};

const cellsOf = (row: string): string[] => row.trim().replace(/^\|/u, "").replace(/\|$/u, "").split("|");

const cellText = (cell: string): string => cell.trim().replace(/^(?:\*\*|__)(.*)(?:\*\*|__)$/u, "$1");

/** The function a table row names in its first cell: `wrap`, wrap(), `measure(text)`. */
const rowFunction = (cell: string): string => {
  const name = cellText(cell).replace(/`/gu, "").trim();
  const open = name.indexOf("(");
  return name.endsWith(")") && open > 0 ? name.slice(0, open).trim() : name;
};

/** A table with a return column (Returns, 戻り値) whose rows name functions in their first cell. */
const tableStatements = (lines: readonly Line[], known: ReadonlySet<string>, words: ReturnWords): Statement[] => {
  const labels = new Set(words.labels.map((label) => label.toLowerCase()));
  const state = { column: -1 };
  return lines.flatMap((line, index) => {
    if (line.fenced || !TABLE_ROW.test(line.text)) {
      state.column = -1;
      return [];
    }
    if (DELIMITER_ROW.test(line.text)) {
      state.column = cellsOf(lines[index - 1]?.text ?? "").findIndex((cell) => labels.has(cellText(cell).toLowerCase()));
      return [];
    }
    const cells = cellsOf(line.text);
    const fn = rowFunction(cells[0] ?? "");
    const stated = state.column > 0 && known.has(fn) ? statedIn(cells[state.column] ?? "", words.kinds) : undefined;
    return stated === undefined ? [] : [{ fn, stated, offset: line.start }];
  });
};

/** `measure returns …` / 「measure は … 返します」: the function's name, an optional subject word, then the verb. */
const sentencePattern = (fn: string, words: ReturnWords): RegExp => {
  const subject = words.subjects.length === 0 ? "" : String.raw`(?:(?:${words.subjects.map(escaped).join("|")})[、,]?)?`;
  const verbs = words.verbs.map(escaped).join("|");
  return new RegExp(String.raw`(?<![\w$.])\x60?${escaped(fn)}(?:\(\))?\x60?\s*${subject}([^。！？!?;]*?)(?:${verbs})(?![\p{L}\p{N}])`, "gu");
};

/** A sentence whose subject is a function's name and whose verb says it returns something. */
const sentenceStatements = (lines: readonly Line[], known: ReadonlySet<string>, words: ReturnWords): Statement[] => {
  if (words.verbs.length === 0) return [];
  const prose = lines.filter((line) => !line.fenced && !HEADING.test(line.text) && !TABLE_ROW.test(line.text));
  return [...known].flatMap((fn) =>
    prose.flatMap((line) =>
      [...line.text.matchAll(sentencePattern(fn, words))].flatMap((match) => {
        const between = match[1] ?? "";
        // Where the verb comes first (en), nothing stands between the name and the verb.
        if (words.subjects.length === 0 && between.trim() !== "") return [];
        const after = firstSentence(line.text.slice(match.index + match[0].length));
        const stated = statedIn(`${between} ${after}`, words.kinds);
        return stated === undefined ? [] : [{ fn, stated, offset: line.start + match.index }];
      }),
    ),
  );
};

const isSubset = (small: readonly string[], large: readonly string[]): boolean => small.every((member) => large.includes(member));

/** Whether a statement can be the signature's return type; true when either side is too vague to say otherwise. */
const agrees = (stated: Stated, returns: string): boolean => {
  const members = typeMembers(returns);
  if ("code" in stated) {
    const said = typeMembers(stated.code);
    return isSubset(said, members);
  }
  const kinds = members.filter((member) => !NOTHING_TYPES.has(member)).map(kindOfMember);
  return kinds.includes(undefined) || kinds.includes(stated.kind);
};

const clashOf = (fn: string, stated: string, signature: Signature, offset: number): ReturnTypeClash => ({
  fn,
  stated,
  signature: signature.returns,
  offset,
});

/** Two declarations with the same parameters and different return types; overloads (other parameters) are left alone. */
const signatureClashes = (signatures: readonly Signature[]): ReturnTypeClash[] =>
  signatures.flatMap((later, index) => {
    const earlier = signatures
      .slice(0, index)
      .find(
        (signature) =>
          signature.fn === later.fn && signature.params === later.params && typeMembers(signature.returns).join("|") !== typeMembers(later.returns).join("|"),
      );
    return earlier === undefined ? [] : [clashOf(later.fn, later.returns, earlier, later.offset)];
  });

/** Every place on the page that states a function's return type differently from all of the function's signatures. */
export const returnTypeClashes = (source: string, words: ReturnWords): ReturnTypeClash[] => {
  const lines = linesOf(source);
  const signatures = signaturesOf(lines);
  const known = new Set(signatures.map((signature) => signature.fn));
  const statements = [
    ...labelStatements(lines, sectionFunctions(lines, signatures), words),
    ...tableStatements(lines, known, words),
    ...sentenceStatements(lines, known, words),
  ];
  const statementClashes = statements.flatMap((statement) => {
    const own = signatures.filter((signature) => signature.fn === statement.fn);
    const first = own[0];
    return first === undefined || own.some((signature) => agrees(statement.stated, signature.returns))
      ? []
      : [clashOf(statement.fn, statement.stated.written, first, statement.offset)];
  });
  return [...signatureClashes(signatures), ...statementClashes].toSorted((left, right) => left.offset - right.offset);
};
