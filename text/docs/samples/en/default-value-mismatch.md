<!-- chaff-sample
rule: default-value-mismatch
genre: technical/readme
file: README.md
-->

# Default value stated two ways (`default-value-mismatch`)

**Where it helps:** READMEs, API references, configuration guides. Any document that gives a default in the code and again in a table or a sentence.

## Original

````markdown chaff-before
# page-slice

Split a list into pages for display.

## paginate

```ts
paginate<T>(items: T[], pageSize = 20): T[][]
```

Returns the items in pages of `pageSize`. The last page may be shorter.
`pageSize` defaults to 25 items.

```ts
paginate(orders); // pages of the default size
```
````

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre technical/readme README.md

README.md   technical/readme · English   genre from --genre

─── line 12 ──────────────────────────────────────────────────

    pageSize` defaults to 25 items.

  ⚠  Default value stated two ways

     The default of `pageSize` is given as 25 here, but as 20 elsewhere
     When the signature says width = 72 and the text says "`width` defaults to 80", the reader misjudges what happens when the option is left out. It happens when a default changes and only the code, the table or the text is updated. The defaults in a declaration (width = 72), in a column headed Default, and after "`width` defaults to" are collected. When a name's value differs from its most authoritative statement (code, then a table, then a sentence), the differing one is pointed out.

     → Check the real default, and correct the statement that differs.

     Relax this rule:  npx chaffjs relax default-value-mismatch


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

````markdown chaff-after
# page-slice

Split a list into pages for display.

## paginate

```ts
paginate<T>(items: T[], pageSize = 20): T[][]
```

Returns the items in pages of `pageSize`. The last page may be shorter.
`pageSize` defaults to 20 items.

```ts
paginate(orders); // pages of the default size
```
````

## How it was fixed

The signature says `pageSize = 20`, and the sentence under it says 25.
The default was lowered in version 2 to suit phone screens; the code was changed and the README was not.
A developer who reads the sentence and sizes a layout for 25 rows gets 20, and goes looking for a bug.

The fix gives the sentence the signature's value.
chaff takes the code as the most authoritative statement, then a table, then a sentence, and points at the one that differs.

## Settings

The rule is a warning at `normal`, an error at `strict` and a note at `relaxed`:

```yaml chaff-settings
rules:
  default-value-mismatch: relaxed
```

Defaults are collected from declarations (`pageSize = 20`), from a column headed Default, and from "`name` defaults to".
A value passed in a call, a name not written as code, a signature split over several lines, and names with dashes (`--page-size`) are not read.
The rule runs in technical writing and manuals, not in contracts, papers or literature.

```text chaff-explain
$ npx chaffjs explain default-value-mismatch --genre technical/readme

  Default value stated two ways   (default-value-mismatch)

  When the signature says width = 72 and the text says "`width` defaults to 80", the reader misjudges what happens when the option is left out. It happens when a default changes and only the code, the table or the text is updated. The defaults in a declaration (width = 72), in a column headed Default, and after "`width` defaults to" are collected. When a name's value differs from its most authoritative statement (code, then a table, then a sentence), the differing one is pointed out.

  How to fix: Check the real default, and correct the statement that differs.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax default-value-mismatch --why "reason"
```

[All samples](README.md)
