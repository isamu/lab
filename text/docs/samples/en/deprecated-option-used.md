<!-- chaff-sample
rule: deprecated-option-used
genre: technical/readme
file: README.md
-->

# Deprecated name used in an example (`deprecated-option-used`)

**Where it helps:** READMEs, API references, migration guides. Any document that deprecates an option and also shows examples.

## Original

````markdown chaff-before
# fetch-retry

Retry failed HTTP requests with a growing delay.

## Options

The `timeout` option is deprecated; use `timeoutMs` instead, which takes milliseconds.
`retries` sets how many times a request is tried again.

```js
const client = createClient({
  retries: 3,
  timeout: 5000,
});
```
````

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre technical/readme README.md

README.md   technical/readme · English   genre from --genre

─── line 13 ──────────────────────────────────────────────────

    timeout: 5000,

  ⚠  Deprecated name used in an example

     `timeout` is used in an example, but the document calls it deprecated
     When a document says "`indent` is deprecated" and one of its code examples passes `{ indent: 2 }`, the reader copies the example and learns a form that will stop working. It happens when an option is deprecated and the text is updated but the example is not. The code name nearest to "deprecated" in a sentence, and the name in the first cell of a table row that says "deprecated", are read as deprecated. A code-block line that uses one as a key (indent:), an argument (indent=) or a flag (--indent) is pointed out.

     → Rewrite the example with what replaces the deprecated name. If the example shows the old form on purpose, say so in a comment on that line.

     Relax this rule:  npx chaffjs relax deprecated-option-used


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

````markdown chaff-after
# fetch-retry

Retry failed HTTP requests with a growing delay.

## Options

The `timeout` option is deprecated; use `timeoutMs` instead, which takes milliseconds.
`retries` sets how many times a request is tried again.

```js
const client = createClient({
  retries: 3,
  timeoutMs: 5000,
});
```
````

## How it was fixed

The text says `timeout` is deprecated, and the example right under it passes `timeout: 5000`.
The option was renamed in the last release; the sentence was added and the example was left as it was.
Most readers copy the example and skip the sentence, so they learn the form that will stop working.

The fix rewrites the example with `timeoutMs`.
If an example shows the old form on purpose, say so in a comment on that line ("// deprecated: before 3.0"); chaff then leaves it alone.

## Settings

The rule is a warning at `normal`, an error at `strict` and a note at `relaxed`:

```yaml chaff-settings
rules:
  deprecated-option-used: relaxed
```

The code name nearest to "deprecated" in a sentence, and the name in the first cell of a table row that says "deprecated", are read as deprecated.
A code line that uses one as a key (`timeout:`), an argument (`timeout=`) or a flag (`--timeout`) is reported.
A negated word ("not deprecated"), a block that declares an API (an interface or a type), and a name inside a string are left alone.

```text chaff-explain
$ npx chaffjs explain deprecated-option-used --genre technical/readme

  Deprecated name used in an example   (deprecated-option-used)

  When a document says "`indent` is deprecated" and one of its code examples passes `{ indent: 2 }`, the reader copies the example and learns a form that will stop working. It happens when an option is deprecated and the text is updated but the example is not. The code name nearest to "deprecated" in a sentence, and the name in the first cell of a table row that says "deprecated", are read as deprecated. A code-block line that uses one as a key (indent:), an argument (indent=) or a flag (--indent) is pointed out.

  How to fix: Rewrite the example with what replaces the deprecated name. If the example shows the old form on purpose, say so in a comment on that line.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax deprecated-option-used --why "reason"
```

[All samples](README.md)
