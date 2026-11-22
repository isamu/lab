<!-- chaff-sample
rule: numbering-gap
genre: legal/statute
file: house-rules.md
-->

# Skipped or repeated number (`numbering-gap`)

**Where it helps:** house rules, staff rules, contracts, statutes, numbered procedures. Any document whose provisions are numbered.

## Original

```markdown chaff-before
# Shared kitchen rules

## Section 1 (Labels)

Every item in the fridge carries its owner's name and the date it was put in.

## Section 2 (Cleaning)

The office manager empties the fridge every Friday at 16:00.

## Section 4 (Dishes)

Each person washes and puts away their own dishes before leaving for the day.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre legal/statute house-rules.md

house-rules.md   legal/statute · English   genre from --genre

─── line 11 ──────────────────────────────────────────────────

    ## Section 4 (Dishes)

  ✖  Skipped or repeated number

     "Section 4" follows "Section 2" (expected number 3)
     Article 5 right after Article 3, (c) right after (a), two paragraphs numbered 2. A reader cannot tell whether something was removed, or which one a reference means. Only numbers side by side under the same parent are compared. A rule book's or a contract's Rule, Clause and Regulation headings are compared as Sections are. The numbers written on a Markdown ordered list (steps "1.", "2.", "4.") are compared too. The page renders them counted from the first, but the source and a "see step 4" use the numbers as written.

     → Renumber. If a provision was removed on purpose, keep its number with a note such as "Section 4 [Deleted]".

     Relax this rule:  npx chaffjs relax numbering-gap


────────────────────────────────────────────────────────────

  1 error   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Shared kitchen rules

## Section 1 (Labels)

Every item in the fridge carries its owner's name and the date it was put in.

## Section 2 (Cleaning)

The office manager empties the fridge every Friday at 16:00.

## Section 3 (Dishes)

Each person washes and puts away their own dishes before leaving for the day.
```

## How it was fixed

The rules go from Section 2 to Section 4.
A reader cannot tell whether Section 3 was removed, or is missing by mistake, and a notice on the fridge that says "see Section 4" points to the wrong rule if the rules are ever renumbered.

The fix renumbers.
If a section was removed on purpose and others refer to the old numbers, keep its number with a note such as "Section 3 [Deleted]".
The numbers written on a Markdown numbered list are compared too.

## Settings

A skipped or repeated number is an error at the default level, so the run fails in CI; `relaxed` makes it a warning.

If your documents quote extracts from a longer text, where the numbers skip on purpose, relax it:

```yaml chaff-settings
rules:
  numbering-gap: relaxed
```

To stop checking it, write `off` instead of `relaxed`.

```text chaff-explain
$ npx chaffjs explain numbering-gap --genre legal/statute

  Skipped or repeated number   (numbering-gap)

  Article 5 right after Article 3, (c) right after (a), two paragraphs numbered 2. A reader cannot tell whether something was removed, or which one a reference means. Only numbers side by side under the same parent are compared. A rule book's or a contract's Rule, Clause and Regulation headings are compared as Sections are. The numbers written on a Markdown ordered list (steps "1.", "2.", "4.") are compared too. The page renders them counted from the first, but the source and a "see step 4" use the numbers as written.

  How to fix: Renumber. If a provision was removed on purpose, keep its number with a note such as "Section 4 [Deleted]".

  Levels (there is no limit to count to; a level sets how a finding is marked):
  → normal   error
    relaxed  warning
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax numbering-gap --why "reason"
```

[All samples](README.md)
