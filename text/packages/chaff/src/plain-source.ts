/**
 * The Markdown parser drops a leading BOM and reads a lone "\r" as a line break; the rest of chaff counts "\n" only.
 * Reading the file this way keeps every offset, line and column on the text the writer sees.
 * Every leading BOM goes, so that running this twice (on reading, then in buildDocument) gives the same text as once.
 */
export const plainSource = (raw: string): string => raw.replace(/^\uFEFF+/u, "").replace(/\r\n?/gu, "\n");
