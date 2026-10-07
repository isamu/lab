// The text of a fetched body in the encoding it declares: the Content-Type header first, then a <meta charset> or an
// XML declaration near the top of an HTML or XML body, otherwise UTF-8. Many Japanese government pages are still
// Shift_JIS. Pure.

/** How far into the body a declaration is looked for; HTML requires <meta charset> within the first 1024 bytes. */
const DECLARATION_BYTES = 1024;

const CHARSET = /charset\s*=\s*["']?([\w.:-]+)/iu;

const declaredInHead = (head: string): string | undefined =>
  /<meta\b[^>]*\bcharset\s*=\s*["']?([\w.:-]+)/iu.exec(head)?.[1] ?? /^\s*<\?xml\b[^>]*\bencoding\s*=\s*["']([\w.:-]+)["']/iu.exec(head)?.[1];

/** Only a markup body can declare its own encoding; Markdown or JSON that quotes a <meta> tag declares nothing. */
const isMarkup = (contentType: string | null): boolean => contentType === null || /html|xml/iu.test(contentType);

/** The label the body declares, lower-cased, or "utf-8" when it declares none. */
export const charsetOf = (contentType: string | null, head: string): string =>
  (CHARSET.exec(contentType ?? "")?.[1] ?? (isMarkup(contentType) ? declaredInHead(head) : undefined) ?? "utf-8").toLowerCase();

const decoderFor = (label: string): TextDecoder => {
  try {
    return new TextDecoder(label);
  } catch {
    return new TextDecoder("utf-8");
  }
};

/** An unknown label is read as UTF-8, as before a declaration was looked for. */
export const decodeFetched = (bytes: Uint8Array, contentType: string | null): string => {
  const head = new TextDecoder("latin1").decode(bytes.subarray(0, DECLARATION_BYTES));
  return decoderFor(charsetOf(contentType, head)).decode(bytes);
};
