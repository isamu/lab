<!-- chaff-sample
rule: broken-link
genre: docs/manual
file: onboarding.md
-->

# Link that goes nowhere (`broken-link`)

**Where it helps:** manuals, help pages, onboarding guides, READMEs. Any Markdown page that links to its own headings.

## Original

```markdown chaff-before
# New starter guide

## Your first day

Collect your badge from reception at 9:00.
Then follow the steps in [Set up your laptop](#laptop-setup).

## Set up your laptop

1. Sign in with the temporary password in the welcome email.
2. Choose a new password of at least 12 characters.
3. Open the Software Centre and install the mail app.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre docs/manual onboarding.md

onboarding.md   docs/manual · English   genre from --genre

─── line 6 ───────────────────────────────────────────────────

    [Set up your laptop](#laptop-setup)

  ⚠  Link that goes nowhere

     The link "[Set up your laptop](#laptop-setup)" points to "#laptop-setup", which is not a heading on this page
     A link that does nothing when clicked tells the reader something is missing. Three kinds are checked. A link with an empty destination ("[report]()"); a link to a heading on the same page that the page does not have ("[Setup](#setup)" after the heading was renamed or removed); and a reference-style link whose label is never defined ("[report][1]" with no "[1]:" line), which is shown as plain brackets. Renderers build heading anchors differently, so only letters and digits are compared; case, spaces and punctuation do not matter. Brackets holding only numbers ("[1][2]") are citation numbers and are not counted (markdownlint's MD042, MD051 and MD052).

     → Fill in the destination. For a heading, match the heading as it is now written. For a reference-style link, add a "[label]: URL" line somewhere in the document.

     Relax this rule:  npx chaffjs relax broken-link


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# New starter guide

## Your first day

Collect your badge from reception at 9:00.
Then follow the steps in [Set up your laptop](#set-up-your-laptop).

## Set up your laptop

1. Sign in with the temporary password in the welcome email.
2. Choose a new password of at least 12 characters.
3. Open the Software Centre and install the mail app.
```

## How it was fixed

The link sends the reader to `#laptop-setup`, but the heading on the page is "Set up your laptop", whose anchor is `#set-up-your-laptop`.
The heading was probably renamed after the link was written. On the page, the link does nothing: a new starter on their first morning clicks it and stays where they are.

The fix points the link at the heading as it is written now.
chaff compares an anchor with the page's headings on letters and digits only, ignoring case and punctuation.
It also reports a link with an empty destination, and a reference-style link (`[guide][1]`) whose label is never defined.

## Settings

A link that goes nowhere is a warning at the default level; `strict` makes it an error and `relaxed` a note.

If your pages are rendered by a tool that makes its own anchors, and chaff's reading of them does not match, relax the rule:

```yaml chaff-settings
rules:
  broken-link: relaxed
```

To stop checking it, write `off` instead of `relaxed`.

A link to another file is checked by `cross-doc-broken-link` when the files are checked together.

```text chaff-explain
$ npx chaffjs explain broken-link --genre docs/manual

  Link that goes nowhere   (broken-link)

  A link that does nothing when clicked tells the reader something is missing. Three kinds are checked. A link with an empty destination ("[report]()"); a link to a heading on the same page that the page does not have ("[Setup](#setup)" after the heading was renamed or removed); and a reference-style link whose label is never defined ("[report][1]" with no "[1]:" line), which is shown as plain brackets. Renderers build heading anchors differently, so only letters and digits are compared; case, spaces and punctuation do not matter. Brackets holding only numbers ("[1][2]") are citation numbers and are not counted (markdownlint's MD042, MD051 and MD052).

  How to fix: Fill in the destination. For a heading, match the heading as it is now written. For a reference-style link, add a "[label]: URL" line somewhere in the document.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax broken-link --why "reason"
```

[All samples](README.md)
