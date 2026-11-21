<!-- chaff-sample
rule: cross-doc-duplicate-definition
genre: legal/contract
file: order-form.md
-->

# One term defined differently in different files (`cross-doc-duplicate-definition`)

**Where it helps:** contract bundles (a master agreement and its order forms or schedules), manuals with a glossary, sets of policies.

## Original

```markdown chaff-before
# Order Form

"Business Day" means a day other than a Saturday or a Sunday.

The Supplier will deliver the goods within ten Business Days of this Order Form.
```

It is checked together with the master agreement it belongs to, `master-agreement.md`:

```markdown chaff-file master-agreement.md
# Master Services Agreement

## 1. Definitions

"Business Day" means a day other than a Saturday, a Sunday or a public holiday in England.

## 2. Payment

The Customer will pay each invoice within thirty Business Days of receiving it.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre legal/contract order-form.md master-agreement.md

order-form.md   legal/contract · English   genre from --genre

─── line 3 ───────────────────────────────────────────────────

    "Business Day" means a day other than a Saturday or a Sunday.

  ⚠  One term defined differently in different files

     "Business Day" is defined in other words than in 1 other file checked with it (as in master-agreement.md)
     A bundle of contracts or a manual often defines the same term in several files (the agreement and its schedule, the glossary and the pages). When one is changed later and the other is not, the files disagree on what the term means. Across the files given together, the words after the term in each definition ("X" means …, 「X」とは、…をいう) are compared, and a file that defines the term in other words than most files do is pointed out. Width, spaces and the punctuation at either end do not count. Whether two wordings mean the same is not something a machine can decide, so chaff only shows where to look.

     → Keep the definition in one place (the glossary, the main agreement) and refer to it from the other files. If the meaning is meant to differ, use a different term.

     Relax this rule:  npx chaffjs relax cross-doc-duplicate-definition


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Order Form

"Business Day" has the meaning given in the Master Services Agreement.

The Supplier will deliver the goods within ten Business Days of this Order Form.
```

## How it was fixed

The master agreement says a Business Day excludes public holidays in England. The order form defines the same term again, without the holidays.
Ten Business Days under the order form can end earlier than ten Business Days under the agreement it sits under.
If delivery is late by one day around a bank holiday, the two documents give two answers.

This happens when an order form is copied from an older template and the master agreement is updated later.
The fix keeps the definition in one place, the master agreement, and lets the order form refer to it.
If the order form really needs a different meaning, it should use a different term.

## Settings

A term defined in other words in another file is a warning at the default level; `strict` makes it an error and `relaxed` a note.
The files have to be checked together, as in `npx chaffjs order-form.md master-agreement.md`.

If your files are separate documents that are allowed to define the same word differently, relax it:

```yaml chaff-settings
rules:
  cross-doc-duplicate-definition: relaxed
```

To stop checking it, write `off` instead of `relaxed`.

A definition limited to one part ("In this section, X means") is not compared, and `duplicate-definition` reports a term defined twice in the same file.

```text chaff-explain
$ npx chaffjs explain cross-doc-duplicate-definition --genre legal/contract

  One term defined differently in different files   (cross-doc-duplicate-definition)

  A bundle of contracts or a manual often defines the same term in several files (the agreement and its schedule, the glossary and the pages). When one is changed later and the other is not, the files disagree on what the term means. Across the files given together, the words after the term in each definition ("X" means …, 「X」とは、…をいう) are compared, and a file that defines the term in other words than most files do is pointed out. Width, spaces and the punctuation at either end do not count. Whether two wordings mean the same is not something a machine can decide, so chaff only shows where to look.

  How to fix: Keep the definition in one place (the glossary, the main agreement) and refer to it from the other files. If the meaning is meant to differ, use a different term.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax cross-doc-duplicate-definition --why "reason"
```

[All samples](README.md)
