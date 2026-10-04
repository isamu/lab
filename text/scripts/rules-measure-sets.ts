// The sets of documents `yarn rules:measure` runs together. The rules that compare documents (cross-doc-*) run only on
// several files at once, as they do on a team's folder, so a corpus document is run with the other documents of its
// publisher (the host it was fetched from) and a statute with the other statutes. Pure.

/** Something to measure, and the name of the set it runs with. */
export type SetMember = { readonly set: string };

/** The members grouped by set, in the order each set first appears. Inside a set, members keep their order. */
export const documentSets = <T extends SetMember>(members: readonly T[]): T[][] => {
  const sets = new Map<string, T[]>();
  members.forEach((member) => {
    const set = sets.get(member.set);
    if (set === undefined) sets.set(member.set, [member]);
    else set.push(member);
  });
  return [...sets.values()];
};

const hostOf = (url: string): string | undefined => {
  try {
    return new URL(url).host;
  } catch {
    return undefined;
  }
};

/**
 * The set of a document: its language and its publisher, read from the host of its URL. A document with no URL, or one
 * that cannot be read, is in its folder's set. Documents of two languages never compare with each other.
 */
export const setOf = (language: string, url: string | undefined, folder: string): string => {
  const host = url === undefined ? undefined : hostOf(url);
  return `${language} ${host ?? folder}`;
};
