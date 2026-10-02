// Pure: the parts of a guide page that scripts/guide-screens.ts runs chaff for. A guide page shows chaff's screen in a
// code block that starts with "$ npx chaffjs <file> <options>". Where that screen lists the rules that did not run, the
// page writes the line "{not-run}" in place of the list, and the site fills it in from chaff's own output at build.
// The document the command reads is a ```markdown file=<name> block on the same page.

import { NOT_RUN_MARKER } from "../site/src/lib/notRunLists.ts";

const PROMPT = "$ npx chaffjs ";
const FENCE = /^```([^\n]*)\n([\s\S]*?)^```$/gmu;
const FILE_META = /(?:^|\s)file=(\S+)/u;
const NOT_RUN_HEADER = /^ *(?:\d+ rules? did not run:|\d+ 件の rule は動いていません:)$/u;
const LIST_ENTRY = /^ {6}\S/u;

/** A screen to fill in: the command as the page writes it, and the arguments chaff gets. */
export type Screen = { readonly command: string; readonly args: readonly string[] };

export type PageScreens = { readonly documents: Readonly<Record<string, string>>; readonly screens: readonly Screen[] };

const isScreenWithMarker = (body: string): boolean => body.startsWith(PROMPT) && body.split("\n").some((line) => line.trim() === NOT_RUN_MARKER);

/** The documents (```markdown file=<name>) and the screens with a "{not-run}" line in one guide page. */
export const screensIn = (page: string): PageScreens => {
  const blocks = [...page.matchAll(FENCE)].map(([, info = "", body = ""]) => ({ info, body }));
  const documents = Object.fromEntries(
    blocks.flatMap(({ info, body }) => {
      const name = FILE_META.exec(info)?.[1];
      return name === undefined ? [] : [[name, body]];
    }),
  );
  const screens = blocks
    .filter(({ body }) => isScreenWithMarker(body))
    .map(({ body }) => {
      const command = body.split("\n")[0] ?? "";
      return {
        command,
        args: command
          .slice(PROMPT.length)
          .split(" ")
          .filter((arg) => arg !== ""),
      };
    });
  return { documents, screens };
};

/** The argument that names the screen's document: the first one a document exists for, wherever the options are. */
export const documentArg = (args: readonly string[], hasDocument: (name: string) => boolean): string | undefined => args.find(hasDocument);

/** The "N rules did not run:" line and the rule lines under it, from chaff's screen; undefined when the screen has none. */
export const notRunBlock = (output: string): string | undefined => {
  const lines = output.split("\n");
  const start = lines.findIndex((line) => NOT_RUN_HEADER.test(line));
  if (start === -1) return undefined;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => !LIST_ENTRY.test(line));
  return lines.slice(start, start + 1 + (end === -1 ? rest.length : end)).join("\n");
};
