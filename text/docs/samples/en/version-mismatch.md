<!-- chaff-sample
rule: version-mismatch
genre: technical/readme
file: csvtrim-readme.md
-->

# The version in the text is not the one in the code (`version-mismatch`)

**Where it helps:** READMEs, installation guides, upgrade notes, changelogs with install commands. Anywhere a sentence names a version and a code block installs one.

## Original

````markdown chaff-before
# csvtrim

csvtrim removes stray spaces from every cell of a CSV file.

## Installation

Install version 2.4.0, the current release, from npm:

```bash
npm install --global csvtrim@2.3.1
```

## Usage

```bash
csvtrim input.csv > clean.csv
```
````

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre technical/readme csvtrim-readme.md

csvtrim-readme.md   technical/readme · English   genre from --genre

─── line 7 ───────────────────────────────────────────────────

    2.4.0, the current release, from npm:

  ⚠  The version in the text is not the one in the code

     "2.4.0" is written, but the code below has 2.3.1
     When "Install version 2.3.0" sits right above a command that installs tidyq@2.4.0, the reader cannot tell which to install. It happens when a release updates the example or the text but not both. chaff compares a version written in the paragraph right above a code block (a number in three dotted parts, such as 2.3.0) with the version the block shows. It reports when the block shows exactly one version and the paragraph names another. A version that "is" gives to the current release, in any sentence of that paragraph ("The current release is 2.4.0."), is compared too. When the block pins a program by name (redis:7.4) and the paragraph writes a version right after that name (Redis 7.2), versions of two parts are compared too; 7.4 and 7.4.1 are the same series. In a document that lists its releases (version headings, as in a changelog, or list items that start with a version), a command that installs the document's own package (the one its title or opening paragraph names) pinned to one version, such as npm install wrapkit@3.1.0, is compared with the release whose section it is in, or else with the newest release listed.

     → Check which of the text and the code has the current version, and correct the other.

     Relax this rule:  npx chaffjs relax version-mismatch


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

````markdown chaff-after
# csvtrim

csvtrim removes stray spaces from every cell of a CSV file.

## Installation

Install version 2.4.0, the current release, from npm:

```bash
npm install --global csvtrim@2.4.0
```

## Usage

```bash
csvtrim input.csv > clean.csv
```
````

## How it was fixed

The sentence says 2.4.0 is the current release; the command right below installs 2.3.1.
The text was updated for the new release and the command was not.
Most readers copy the command and never read the sentence, so they install the old version, then open an issue about a bug the new release has already fixed.

The fix makes the command install 2.4.0, the version the text names.
If the command was right and the text was ahead of the release, correct the text instead.

## Settings

A version that differs from the code below is a warning at the default level; `strict` makes it an error and `relaxed` a note:

```yaml chaff-settings
rules:
  version-mismatch: relaxed
```

To stop checking it, write `off` instead of `relaxed`.

A version in three dotted parts in the paragraph right above a code block is compared with the one version the block shows.
A block with two versions (an upgrade), a version written as a bound ("2.3.0 or later") and a version right after the name of another program ("Requires Node.js 18.17.0") are not compared.
In a document that lists its releases, an install command for the document's own package is compared with its release section, or else with the newest release listed.
The rule does not run in legal, academic or literature writing, or in speech transcripts.

```text chaff-explain
$ npx chaffjs explain version-mismatch --genre technical/readme

  The version in the text is not the one in the code   (version-mismatch)

  When "Install version 2.3.0" sits right above a command that installs tidyq@2.4.0, the reader cannot tell which to install. It happens when a release updates the example or the text but not both. chaff compares a version written in the paragraph right above a code block (a number in three dotted parts, such as 2.3.0) with the version the block shows. It reports when the block shows exactly one version and the paragraph names another. A version that "is" gives to the current release, in any sentence of that paragraph ("The current release is 2.4.0."), is compared too. When the block pins a program by name (redis:7.4) and the paragraph writes a version right after that name (Redis 7.2), versions of two parts are compared too; 7.4 and 7.4.1 are the same series. In a document that lists its releases (version headings, as in a changelog, or list items that start with a version), a command that installs the document's own package (the one its title or opening paragraph names) pinned to one version, such as npm install wrapkit@3.1.0, is compared with the release whose section it is in, or else with the newest release listed.

  How to fix: Check which of the text and the code has the current version, and correct the other.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax version-mismatch --why "reason"
```

[All samples](README.md)
