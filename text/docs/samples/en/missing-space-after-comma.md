<!-- chaff-sample
rule: missing-space-after-comma
genre: business/email
file: roadworks-email.md
-->

# No space after a comma (`missing-space-after-comma`)

**Where it helps:** emails, notices, anything typed fast or edited on a phone.

## Original

```markdown chaff-before
Subject: Parking during the roadworks

Hi all,

The council starts work on the main road next week.
While the work lasts,please use the side entrance on Mill Lane,and park behind the warehouse.

Visitors should be told the same when you book them in.

Thanks,
Facilities
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre business/email roadworks-email.md

roadworks-email.md   business/email · English   genre from --genre

─── line 6 ───────────────────────────────────────────────────

    While the work lasts,please use the side

  ⚠  No space after a comma

     No space after the comma in "lasts,please"
     English puts one space after a comma between words. Without it ("address,and") the two words read as one, and a search does not find either. It is a space dropped while typing or editing, not a matter of style.

     → Put one space after the comma.

     Relax this rule:  npx chaffjs relax missing-space-after-comma


─── line 6 ───────────────────────────────────────────────────

    ntrance on Mill Lane,and park behind the

  ⚠  No space after a comma

     No space after the comma in "Lane,and"
     English puts one space after a comma between words. Without it ("address,and") the two words read as one, and a search does not find either. It is a space dropped while typing or editing, not a matter of style.

     → Put one space after the comma.

     Relax this rule:  npx chaffjs relax missing-space-after-comma


────────────────────────────────────────────────────────────

  2 warnings   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
Subject: Parking during the roadworks

Hi all,

The council starts work on the main road next week.
While the work lasts, please use the side entrance on Mill Lane, and park behind the warehouse.

Visitors should be told the same when you book them in.

Thanks,
Facilities
```

## How it was fixed

English puts one space after a comma between words.
Without it, "lasts,please" and "Lane,and" read as single strange words, the sentence is harder to scan, and a search for "Mill Lane" may not find the line.

The fix puts one space after each comma.

## Settings

At `normal` a finding is a warning; `strict` makes it an error and `relaxed` a note.
None of them changes what is found, only how loudly it is marked.

A run of values ("blue,black,brown"), numbers ("3,000"), a quoted value, words of one or two letters, code and URLs are not read.

```yaml chaff-settings
rules:
  missing-space-after-comma: relaxed
```

The rule does not run on fiction, poetry or plays, where an older edition may set its commas tight.

```text chaff-explain
$ npx chaffjs explain missing-space-after-comma --genre business/email

  No space after a comma   (missing-space-after-comma)

  English puts one space after a comma between words. Without it ("address,and") the two words read as one, and a search does not find either. It is a space dropped while typing or editing, not a matter of style.

  How to fix: Put one space after the comma.

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax missing-space-after-comma --why "reason"
```

[All samples](README.md)
