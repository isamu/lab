<!-- chaff-sample
rule: absolute-exception
genre: legal/statute
file: expenses-policy.md
-->

# An absolute rule with an exception written elsewhere (`absolute-exception`)

**Where it helps:** staff policies, house rules, contracts, terms of service. Any document that states a rule in one place and adds to it in another.

## Original

```markdown chaff-before
# Travel and Expenses Policy

## 1. Receipts

Every employee must always attach the receipt for each expense to the claim.

## 2. Claims

Employees submit their claims through the finance portal by the fifth working day of the following month.

## 3. Small expenses

An employee need not attach the receipt for an expense under ten dollars, except for taxi fares.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre legal/statute expenses-policy.md

expenses-policy.md   legal/statute · English   genre from --genre

─── line 5 ───────────────────────────────────────────────────

    Every employee must always attach the receipt for each expense to the claim.

  ⚠  An absolute rule with an exception written elsewhere

     This says "always", but line 13 makes an exception ("except") for the same act
     A rule stated without exception ("all staff must", "must never") that a later article or paragraph makes an exception to ("except", "unless") misleads a reader who stops at the rule. It happens when an exception is added later or copied from another document. An exception in the same article or paragraph is the rule's own proviso and is not reported. Whether two sentences are about the same act is read from the content words they share.

     → Either add the exception to the absolute rule ("except as set out in section 5") or remove the exception.

     Relax this rule:  npx chaffjs relax absolute-exception


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Travel and Expenses Policy

## 1. Receipts

Except as set out in section 3, every employee must always attach the receipt for each expense to the claim.

## 2. Claims

Employees submit their claims through the finance portal by the fifth working day of the following month.

## 3. Small expenses

An employee need not attach the receipt for an expense under ten dollars, except for taxi fares.
```

## How it was fixed

Section 1 says every employee must *always* attach the receipt for each expense.
Section 3 then lets small expenses go without one.
A new starter who reads only the first rule keeps every coffee receipt; one who reads only the third throws them away. Neither knows the other section exists.

This happens when the exception is added in a later revision and nobody goes back to the rule it changes.
The fix keeps both sections and tells the reader, inside the rule itself, that an exception follows ("Except as set out in section 3").
The other fix would be to delete the exception if it is no longer meant.

An exception in the same section, or in the same paragraph, is the rule's own proviso and is not reported.

## Settings

The finding is a warning at the default level; `strict` makes it an error and `relaxed` a note.

If your documents often state a general rule and its exceptions in separate sections on purpose, and readers know to read both, relax it:

```yaml chaff-settings
rules:
  absolute-exception: relaxed
```

To stop checking it, write `off` instead of `relaxed`.

It is off for literature, where a character who says "never" and then makes an exception is part of the story.

```text chaff-explain
$ npx chaffjs explain absolute-exception --genre legal/statute

  An absolute rule with an exception written elsewhere   (absolute-exception)

  A rule stated without exception ("all staff must", "must never") that a later article or paragraph makes an exception to ("except", "unless") misleads a reader who stops at the rule. It happens when an exception is added later or copied from another document. An exception in the same article or paragraph is the rule's own proviso and is not reported. Whether two sentences are about the same act is read from the content words they share.

  How to fix: Either add the exception to the absolute rule ("except as set out in section 5") or remove the exception.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax absolute-exception --why "reason"
```

[All samples](README.md)
