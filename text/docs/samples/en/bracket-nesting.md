<!-- chaff-sample
rule: bracket-nesting
genre: technical/readme
file: CHANGES.md
-->

# Brackets nested too deep (`bracket-nesting`)

**Where it helps:** release notes, READMEs, specifications. Text where each detail gets added as an aside to the last.

## Original

```markdown chaff-before
# Release notes, version 4.2

## Changes

- Exports now include the time zone of each entry (UTC by default (set it under Settings (General) if your team works in another zone)).
- The search box now finds archived projects too.
- Reports open about twice as fast on large accounts.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre technical/readme CHANGES.md

CHANGES.md   technical/readme · English   genre from --genre

─── line 5 ───────────────────────────────────────────────────

    Exports now include the time zone of each entry (UTC by default (set it under Settings (General) if your team works in a…

  ·  Brackets nested too deep

     Brackets nested 3 deep (limit 2)
     A bracket inside a bracket inside a bracket makes the reader hold every open one while reading on, and lose where the sentence resumed. Two levels are common in notes and quotations; deeper than that reads better as a separate sentence or a note. Round and square brackets, Japanese corner brackets and curly double quotes are counted. A closing bracket with no opener (the "1)" of a list) and brackets inside a formula ($…$) are not.

     → Take the innermost bracket out into its own sentence or a note.

     Relax this rule:  npx chaffjs relax bracket-nesting


────────────────────────────────────────────────────────────

  1 note   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Release notes, version 4.2

## Changes

- Exports now include the time zone of each entry (UTC by default). If your team works in another zone, set it under Settings, General.
- The search box now finds archived projects too.
- Reports open about twice as fast on large accounts.
```

## How it was fixed

The first item ends with three brackets inside each other and four closing brackets in a row.
To follow it, the reader has to keep every open bracket in mind, and at "))." it is hard to tell which aside has just ended and whether the sentence ever came back.
The one instruction in the item, where to change the time zone, is buried two levels down.

The fix keeps the short aside "(UTC by default)" and takes the instruction out into a sentence of its own.
The menu path "Settings (General)" became "Settings, General", so no bracket is left inside another.

## Settings

The rule counts how deep brackets go. At the default level it reports brackets nested more than two deep; `strict` reports two and `relaxed` waits for four. In literature, where a character quoting someone else nests by the story's form, the limits are one higher.
Round and square brackets, curly double quotes and Japanese corner brackets are counted; brackets in code or a formula, curly braces, and a closing bracket with no opener (the "1)" of a list) are not.

```yaml chaff-settings
rules:
  bracket-nesting: relaxed
```

```text chaff-explain
$ npx chaffjs explain bracket-nesting --genre technical/readme

  Brackets nested too deep   (bracket-nesting)

  A bracket inside a bracket inside a bracket makes the reader hold every open one while reading on, and lose where the sentence resumed. Two levels are common in notes and quotations; deeper than that reads better as a separate sentence or a note. Round and square brackets, Japanese corner brackets and curly double quotes are counted. A closing bracket with no opener (the "1)" of a list) and brackets inside a formula ($…$) are not.

  How to fix: Take the innermost bracket out into its own sentence or a note.

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels:
    strict   brackets nested up to 1 deep
  → normal   brackets nested up to 2 deep
    relaxed  brackets nested up to 3 deep
    off      not checked

  These numbers are the default ones, which technical/readme takes. literature has numbers of its own.

  Now: normal.

  Change it:  npx chaffjs relax bracket-nesting --why "reason"
```

[All samples](README.md)
