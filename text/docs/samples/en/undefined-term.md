<!-- chaff-sample
rule: undefined-term
genre: legal/contract
file: terms.md
-->

# A term written like a defined term but defined nowhere (`undefined-term`)

**Where it helps:** contracts, terms of service, licences. Any document that gives its key words a capital and a definition.

## Original

```markdown chaff-before
# Terms of Membership

## 1. Definitions

"Club" means the Riverside Rowing Club.

"Member" means a person whose membership fee for the current year has been paid.

"Facilities" means the boathouse, the boats and the changing rooms.

## 2. Use of the Facilities

2.1 A Member may use the Facilities at any time the boathouse is open.

2.2 A Member may bring up to two Guests a month, who must sign the visitors' book.

2.3 The Club may close the Facilities for repairs, with seven days' notice.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre legal/contract terms.md

terms.md   legal/contract · English   genre from --genre

─── line 15 ──────────────────────────────────────────────────

    Guests a month, who must sign the visitors' book.

  ·  A term written like a defined term but defined nowhere

     "Guests" is written like a defined term, but the document defines it nowhere
     A Japanese contract defines its terms with the prefix 本 (本業務, 本サービス). A term in the same form that is never defined (本成果物) leaves the reader asking whether it was defined somewhere and what it means: either a definition is missing, or another defined term was miswritten. Only a document that defines at least one term with that prefix is read, and only the first use of each such term with no definition and no other-prefix form (本件業務) is reported. An English contract capitalises its defined terms (the Services); in a document with at least two definitions written with a defining word (“X” means, (the “X”)), a capitalised term inside a sentence that is defined nowhere (its Affiliates) is reported the same way.

     → If it is a defined term miswritten, use the defined term. If it is a new term, define it where it is first used.

     Relax this rule:  npx chaffjs relax undefined-term


────────────────────────────────────────────────────────────

  1 note   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Terms of Membership

## 1. Definitions

"Club" means the Riverside Rowing Club.

"Member" means a person whose membership fee for the current year has been paid.

"Facilities" means the boathouse, the boats and the changing rooms.

"Guest" means a person who comes to the Club with a Member and is not a Member.

## 2. Use of the Facilities

2.1 A Member may use the Facilities at any time the boathouse is open.

2.2 A Member may bring up to two Guests a month, who must sign the visitors' book.

2.3 The Club may close the Facilities for repairs, with seven days' notice.
```

## How it was fixed

The terms give each key word a capital and a definition: Club, Member, Facilities.
"Guests" in clause 2.2 has the same capital, but no definition.
A reader asks whether a definition is missing, and what a Guest is: can a former member be one, or a member's child?

The fix adds a definition, next to the others.
If "Guests" had been a slip for another defined term, the fix would be to use that term; if the ordinary word were meant, to write it in lower case.

## Settings

The rule gives a note at `normal` and `relaxed`, and a warning at `strict`.
It reads only a document with at least two definitions written with a defining word ("X" means, (the "X")), and reports only the first use of each undefined term.
Capitals at the start of a sentence are not read as terms.

To stop checking:

```yaml chaff-settings
rules:
  undefined-term: off
```

It runs on contracts; statutes, judgments and patents name things as they go and are not read.

```text chaff-explain
$ npx chaffjs explain undefined-term --genre legal/contract

  A term written like a defined term but defined nowhere   (undefined-term)

  A Japanese contract defines its terms with the prefix 本 (本業務, 本サービス). A term in the same form that is never defined (本成果物) leaves the reader asking whether it was defined somewhere and what it means: either a definition is missing, or another defined term was miswritten. Only a document that defines at least one term with that prefix is read, and only the first use of each such term with no definition and no other-prefix form (本件業務) is reported. An English contract capitalises its defined terms (the Services); in a document with at least two definitions written with a defining word (“X” means, (the “X”)), a capitalised term inside a sentence that is defined nowhere (its Affiliates) is reported the same way.

  How to fix: If it is a defined term miswritten, use the defined term. If it is a new term, define it where it is first used.

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   warning
  → normal   note
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax undefined-term --why "reason"
```

[All samples](README.md)
