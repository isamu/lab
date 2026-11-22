<!-- chaff-sample
rule: return-type-mismatch
genre: technical/readme
file: read-time.md
-->

# A return type stated two ways (`return-type-mismatch`)

**Where it helps:** API references and READMEs that give a signature and describe what a function returns.

## Original

````markdown chaff-before
# read-time

Estimates how long a text takes to read.

## readingTime

```ts
readingTime(text: string, wordsPerMinute = 200): number
```

readingTime returns the time as a string such as "4 min read".
````

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre technical/readme read-time.md

read-time.md   technical/readme · English   genre from --genre

─── line 11 ──────────────────────────────────────────────────

    readingTime returns the time as a string such as "4 min read".

  ⚠  A return type stated two ways

     `readingTime` is said to return string here, but its signature returns `number`
     When an API reference's signature and a "Returns:" line, a table or a sentence say a function returns different types, the reader cannot tell which to trust and handles the value as the wrong type. It happens when a return type is changed in one place only. The signature in a code block (one with a return type) is the reference; a "Returns:" line under the same heading, a row of a table with a return column, and a sentence whose subject is the function's name and whose verb is "returns" are compared with it, for the same function only. Two spellings of one type (Array<string> and string[]) are the same, and words such as "string" or "number" are compared as kinds of value.

     → Check what the function really returns, and correct the signature or the description.

     Relax this rule:  npx chaffjs relax return-type-mismatch


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

````markdown chaff-after
# read-time

Estimates how long a text takes to read.

## readingTime

```ts
readingTime(text: string, wordsPerMinute = 200): number
```

readingTime returns the time in whole minutes, rounded up. To show "4 min read", add the label yourself.
````

## How it was fixed

The signature says `readingTime` returns a `number`, and the sentence below it says a string such as "4 min read".
The sentence was probably written for an older version that formatted the label itself.
A reader who trusts it prints the number with no label, or calls string methods on it and gets an error.

The fix describes what the signature returns and says where the label comes from.
chaff takes the signature in the code block as the reference and compares a "Returns:" line, a table's return column or a sentence starting with the function's name.
If the signature is the part that is out of date, correct it instead.

## Settings

A return type stated two ways is a warning at the default level, an error at `strict` and a note at `relaxed`.

If your descriptions say what a value means rather than its type, relax it:

```yaml chaff-settings
rules:
  return-type-mismatch: relaxed
```

To stop checking it, write `off` instead of `relaxed`.

```text chaff-explain
$ npx chaffjs explain return-type-mismatch --genre technical/readme

  A return type stated two ways   (return-type-mismatch)

  When an API reference's signature and a "Returns:" line, a table or a sentence say a function returns different types, the reader cannot tell which to trust and handles the value as the wrong type. It happens when a return type is changed in one place only. The signature in a code block (one with a return type) is the reference; a "Returns:" line under the same heading, a row of a table with a return column, and a sentence whose subject is the function's name and whose verb is "returns" are compared with it, for the same function only. Two spellings of one type (Array<string> and string[]) are the same, and words such as "string" or "number" are compared as kinds of value.

  How to fix: Check what the function really returns, and correct the signature or the description.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax return-type-mismatch --why "reason"
```

[All samples](README.md)
