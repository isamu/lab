<!-- chaff-sample
rule: parameter-table-mismatch
genre: technical/readme
file: README.md
-->

# Parameter table that does not match the signature (`parameter-table-mismatch`)

**Where it helps:** API references, READMEs, SDK guides. Any page that shows a function's signature and a table of its parameters.

## Original

````markdown chaff-before
# slugmaker

Turn titles into URL-friendly slugs.

## slugify

```ts
slugify(title: string, separator = "-", maxLength = 60): string
```

| Parameter | Type | Description |
| --- | --- | --- |
| `title` | string | The text to turn into a slug |
| `separator` | string | What goes between words |
| `limit` | number | The longest slug to return, in characters |
````

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre technical/readme README.md

README.md   technical/readme · English   genre from --genre

─── line 8 ───────────────────────────────────────────────────

    maxLength = 60): string

  ⚠  Parameter table that does not match the signature

     `maxLength` is in only one of the signature of `slugify` and its parameter table
     When an API reference's signature and the parameter table under it list different parameters, the reader cannot tell which is right, and passes a parameter that does not exist or never learns of one that does. It happens when a parameter is added or renamed in one place only. When a code block declares exactly one function (with function or def, or with a return type) and a table whose first header is Parameter or Argument follows it before the next heading or code block, the two are compared. A parameter only in the table is pointed out on its row, and one only in the signature on the signature.

     → Check the function's real parameters, and correct the table or the signature.

     Relax this rule:  npx chaffjs relax parameter-table-mismatch


─── line 15 ──────────────────────────────────────────────────

    limit` | number | The longest slug to return, in characters |

  ⚠  Parameter table that does not match the signature

     `limit` is in only one of the signature of `slugify` and its parameter table
     When an API reference's signature and the parameter table under it list different parameters, the reader cannot tell which is right, and passes a parameter that does not exist or never learns of one that does. It happens when a parameter is added or renamed in one place only. When a code block declares exactly one function (with function or def, or with a return type) and a table whose first header is Parameter or Argument follows it before the next heading or code block, the two are compared. A parameter only in the table is pointed out on its row, and one only in the signature on the signature.

     → Check the function's real parameters, and correct the table or the signature.

     Relax this rule:  npx chaffjs relax parameter-table-mismatch


────────────────────────────────────────────────────────────

  2 warnings   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

````markdown chaff-after
# slugmaker

Turn titles into URL-friendly slugs.

## slugify

```ts
slugify(title: string, separator = "-", maxLength = 60): string
```

| Parameter | Type | Description |
| --- | --- | --- |
| `title` | string | The text to turn into a slug |
| `separator` | string | What goes between words |
| `maxLength` | number | The longest slug to return, in characters |
````

## How it was fixed

The signature takes `maxLength`, and the table describes `limit`.
The parameter was renamed to match the rest of the library, and the table kept the old name.
A developer who reads the table passes `limit`, which TypeScript rejects and plain JavaScript silently ignores.

The fix gives the table the name the signature has.
If the table is right and the code is out of date, correct the signature instead; the two must list the same parameters.

## Settings

The rule is a warning at `normal`, an error at `strict` and a note at `relaxed`:

```yaml chaff-settings
rules:
  parameter-table-mismatch: relaxed
```

A code block that declares exactly one function, followed by a table whose first heading is Parameter or Argument before the next heading or code block, is compared.
A parameter only in the table is reported on its row, and one only in the signature on the signature.
A call, a block with two functions, a destructured parameter, and a table headed Option or Field are left alone.

```text chaff-explain
$ npx chaffjs explain parameter-table-mismatch --genre technical/readme

  Parameter table that does not match the signature   (parameter-table-mismatch)

  When an API reference's signature and the parameter table under it list different parameters, the reader cannot tell which is right, and passes a parameter that does not exist or never learns of one that does. It happens when a parameter is added or renamed in one place only. When a code block declares exactly one function (with function or def, or with a return type) and a table whose first header is Parameter or Argument follows it before the next heading or code block, the two are compared. A parameter only in the table is pointed out on its row, and one only in the signature on the signature.

  How to fix: Check the function's real parameters, and correct the table or the signature.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax parameter-table-mismatch --why "reason"
```

[All samples](README.md)
