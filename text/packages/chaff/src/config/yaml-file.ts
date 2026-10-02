import { readFileSync } from "node:fs";
import { parse, YAMLParseError } from "yaml";
import { relative } from "node:path";
import type { Texts, UiLanguage } from "../ui.ts";

/** Where a settings file stops being YAML: 1-based line and column, and the parser's own sentence without its position. */
export type YamlSyntax = { readonly line: number; readonly column: number; readonly detail: string };

/** The parser appends " at line 3, column 1:" and, on the lines below, a picture of the line; chaff says the position itself. */
const POSITION_TAIL = / at line \d+, column \d+:?$/u;

/** A YAML syntax error as a position and a sentence, or undefined for anything else (a missing file is not a syntax error). */
export const yamlSyntaxOf = (error: unknown): YamlSyntax | undefined => {
  if (!(error instanceof YAMLParseError)) return undefined;
  const start = error.linePos?.[0];
  return {
    line: start?.line ?? 1,
    column: start?.col ?? 1,
    detail: (error.message.split("\n")[0] ?? "").replace(POSITION_TAIL, "").trim(),
  };
};

/** A settings file the person wrote that is not YAML. The command line says where and stops; no stack trace. */
export class YamlFileError extends Error {
  readonly path: string;
  readonly syntax: YamlSyntax;

  constructor(path: string, syntax: YamlSyntax, cause: unknown) {
    super(`${path}:${syntax.line}:${syntax.column}: ${syntax.detail}`, { cause });
    this.name = "YamlFileError";
    this.path = path;
    this.syntax = syntax;
  }
}

/** A settings file read as YAML. A syntax error becomes a YamlFileError naming the file; other failures pass through. */
export const readYamlFile = (path: string): unknown => {
  const text = readFileSync(path, "utf8");
  try {
    return parse(text);
  } catch (error) {
    const syntax = yamlSyntaxOf(error);
    if (syntax === undefined) throw error;
    throw new YamlFileError(path, syntax, error);
  }
};

const TEXT: Texts<(path: string, syntax: YamlSyntax) => string> = {
  ja: (path, { line, column, detail }) => `chaff: ${path} の ${line} 行目 ${column} 桁目が YAML として読めません: ${detail}`,
  en: (path, { line, column, detail }) => `chaff: ${path}, line ${line}, column ${column}, is not valid YAML: ${detail}`,
};

/** The sentence the command line prints for a settings file that is not YAML. path: as the person would type it. */
export const yamlFileProblem = (path: string, syntax: YamlSyntax, ui: UiLanguage): string => TEXT[ui](path, syntax);

/** Runs a command, and turns a settings file that is not YAML into its sentence and exit code 1. cwd: what the path is printed relative to. */
export const stoppingOnYamlFileError = async (run: () => Promise<number>, cwd: string, ui: UiLanguage): Promise<number> => {
  try {
    return await run();
  } catch (error) {
    if (!(error instanceof YamlFileError)) throw error;
    console.error(yamlFileProblem(relative(cwd, error.path) || error.path, error.syntax, ui));
    return 1;
  }
};
