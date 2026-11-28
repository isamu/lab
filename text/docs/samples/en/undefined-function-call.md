<!-- chaff-sample
rule: undefined-function-call
genre: technical/readme
file: date-kit.md
-->

# Example calls a function the page does not define (`undefined-function-call`)

**Where it helps:** READMEs and API references whose examples call the functions they document.

## Original

````markdown chaff-before
# date-kit

Small helpers for dates in forms.

## parseDate

Reads a date typed by a user, such as "5/21/2026" or "May 21, 2026", and gives a `Date`.

```js
import { parseDate } from "date-kit";

const due = parseDateString(form.dueDate);
```
````

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre technical/readme date-kit.md

date-kit.md   technical/readme · English   genre from --genre

─── line 12 ──────────────────────────────────────────────────

    parseDateString(form.dueDate);

  ⚠  Example calls a function the page does not define

     `parseDateString` is called, but this page documents `parseDate`
     When an API reference or a README documents wrap and its example calls wrapText(...), the reader who copies the example stops at "not defined". It happens when a function is renamed and an example keeps the old name, or when the name is mistyped. The first word of a heading (## wrap) and the names an example imports are read as the functions the page documents. A call in a code block to a longer name that starts with one of them, written nowhere else on the page, is pointed out.

     → Call the function the page documents. If it is another function, document it on the page.

     Relax this rule:  npx chaffjs relax undefined-function-call


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

````markdown chaff-after
# date-kit

Small helpers for dates in forms.

## parseDate

Reads a date typed by a user, such as "5/21/2026" or "May 21, 2026", and gives a `Date`.

```js
import { parseDate } from "date-kit";

const due = parseDate(form.dueDate);
```
````

## How it was fixed

The section documents `parseDate`, and the example imports it, but then calls `parseDateString`.
Someone who copies the example gets "parseDateString is not defined".
It is usually an old name left in an example after a rename.

The fix calls the documented function.
chaff reads a heading's first word and the names an example imports as the documented functions, and reports a call to a longer name that starts with one of them and appears nowhere else on the page.
If the example really calls another function, document it on the page.

## Settings

An example that calls an undocumented function is a warning at the default level, an error at `strict` and a note at `relaxed`.

To relax it:

```yaml chaff-settings
rules:
  undefined-function-call: relaxed
```

To stop checking it, write `off` instead of `relaxed`.

```text chaff-explain
$ npx chaffjs explain undefined-function-call --genre technical/readme

  Example calls a function the page does not define   (undefined-function-call)

  When an API reference or a README documents wrap and its example calls wrapText(...), the reader who copies the example stops at "not defined". It happens when a function is renamed and an example keeps the old name, or when the name is mistyped. The first word of a heading (## wrap) and the names an example imports are read as the functions the page documents. A call in a code block to a longer name that starts with one of them, written nowhere else on the page, is pointed out.

  How to fix: Call the function the page documents. If it is another function, document it on the page.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax undefined-function-call --why "reason"
```

[All samples](README.md)
