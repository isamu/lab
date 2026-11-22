<!-- chaff-sample
rule: which-that-consistency
genre: technical/spec
file: design.md
-->

# Restrictive "which" and "that" mixed (`which-that-consistency`)

**Where it helps:** design documents, specifications, manuals. Writing where a reader needs to know whether a clause narrows the noun or only adds a remark about it.

## Original

```markdown chaff-before
# Nightly export: design

The export runs at 02:00 and writes one file per shop.

The job that collects the orders reads only orders closed before midnight.
The step that builds the file sorts the orders by shop and then by time.
Each file goes to the folder that belongs to that shop.
The service which uploads the files retries three times and then alerts the on-call engineer.

A shop with no orders gets an empty file, so its system can tell a quiet day from a failed export.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre technical/spec design.md

design.md   technical/spec · English   genre from --genre

─── line 8 ───────────────────────────────────────────────────

    The service which uploads the files retries three times and then alerts the on-call engineer.

  ·  Restrictive "which" and "that" mixed

     This restrictive clause opens with "which"; the document mostly uses "that"
     A restrictive relative clause ("the file that contains the keys") opens with "that" for some writers and "which" for others. American guides prefer "that"; British ones accept both. chaff does not pick a side. Mixed in one document, a reader wonders whether a "which" clause is meant as an aside (the non-restrictive kind, set off by a comma). Only "noun + which/that + verb" with no comma between is counted, and the fewer form is pointed at.

     → Match the rest of the document. If the clause is meant as an aside, set it off with a comma and use "which".

     Relax this rule:  npx chaffjs relax which-that-consistency


────────────────────────────────────────────────────────────

  1 note   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Nightly export: design

The export runs at 02:00 and writes one file per shop.

The job that collects the orders reads only orders closed before midnight.
The step that builds the file sorts the orders by shop and then by time.
Each file goes to the folder that belongs to that shop.
The service that uploads the files retries three times and then alerts the on-call engineer.

A shop with no orders gets an empty file, so its system can tell a quiet day from a failed export.
```

## How it was fixed

The design names each part of the export with a clause that says which one is meant: "the job that collects the orders", "the step that builds the file".
Three of them open with "that"; the fourth opens with "which".
A reader who has learned that "which" marks a remark wonders whether there is only one service and the clause just describes it, or whether this is one service among several.

The fix writes "that", so the four clauses read the same way.
If the clause had been a remark, the right fix would be a comma: "The upload service, which retries three times, …".
chaff does not pick a side; a document that mostly uses "which" would have the "that" pointed at.

## Settings

The rule counts only "noun + which/that + verb" with no comma between.
At `normal`, the rarer form is reported when it appears twice or fewer; `strict` allows four, `relaxed` one.
A document where the usual form appears fewer than three times is not read.

To stop checking:

```yaml chaff-settings
rules:
  which-that-consistency: off
```

It is off for literature and speech.

```text chaff-explain
$ npx chaffjs explain which-that-consistency --genre technical/spec

  Restrictive "which" and "that" mixed   (which-that-consistency)

  A restrictive relative clause ("the file that contains the keys") opens with "that" for some writers and "which" for others. American guides prefer "that"; British ones accept both. chaff does not pick a side. Mixed in one document, a reader wonders whether a "which" clause is meant as an aside (the non-restrictive kind, set off by a comma). Only "noun + which/that + verb" with no comma between is counted, and the fewer form is pointed at.

  How to fix: Match the rest of the document. If the clause is meant as an aside, set it off with a comma and use "which".

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels:
    strict   reported when the fewer form appears 4 times or fewer
  → normal   reported when the fewer form appears 2 times or fewer
    relaxed  reported when the fewer form appears 1 time or fewer
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax which-that-consistency --why "reason"
```

[All samples](README.md)
