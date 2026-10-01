// Pure: the entries of a bibliography page's Markdown, by anchor, so a rule page can name the works it rests on.

export type BibliographyEntry = { readonly id: string; readonly label: string };

/** An entry opens a list item: `- <a id="femmer-2017"></a>**Femmer et al. (2017)** [doi.org](...)`. */
const ENTRY = /^- <a id="([a-z0-9-]+)"><\/a>\*\*(.+?)\*\*/u;

/** Every entry of the page, in the order it lists them. */
export const entriesOf = (markdown: string): BibliographyEntry[] =>
  markdown.split("\n").flatMap((line) => {
    const match = ENTRY.exec(line);
    return match?.[1] === undefined || match[2] === undefined ? [] : [{ id: match[1], label: match[2] }];
  });
