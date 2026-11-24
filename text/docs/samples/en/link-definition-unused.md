<!-- chaff-sample
rule: link-definition-unused
genre: docs/manual
file: onboarding.md
-->

# Link definition that does nothing (`link-definition-unused`)

**Where it helps:** handbooks, READMEs, onboarding pages. Any Markdown page that keeps its addresses in "[label]: URL" lines at the bottom.

## Original

```markdown chaff-before
# First week

On your first day, read the [handbook][handbook] and set up your laptop.
Ask IT for an account on the expense system before your first trip.

[handbook]: https://example.com/handbook
[expenses]: https://example.com/expenses
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre docs/manual onboarding.md

onboarding.md   docs/manual · English   genre from --genre

─── line 7 ───────────────────────────────────────────────────

    [expenses]: https://example.com/expenses

  ⚠  Link definition that does nothing

     No link uses the definition "expenses"
     A reference-style Markdown link ("[report][1]") takes its address from a "[1]: URL" line somewhere in the document. A definition no link calls is not shown and does nothing. It is left behind when a link's text was changed, the link was removed, or its label was mistyped, and it shows that a link the writer meant to give is missing from the text. A second definition of the same label with another address is silently ignored too: Markdown uses the first one (markdownlint's MD053; remark-lint's no-unused-definitions and no-duplicate-definitions).

     → If the text was meant to link there, make the link's label match the definition ("[report][expenses]"). If the definition is no longer needed, delete it. For a second definition, decide which address is right and keep one.

     Relax this rule:  npx chaffjs relax link-definition-unused


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# First week

On your first day, read the [handbook][handbook] and set up your laptop.
Ask IT for an account on the [expense system][expenses] before your first trip.

[handbook]: https://example.com/handbook
[expenses]: https://example.com/expenses
```

## How it was fixed

The page defines an address for "expenses", but no link in the text calls it.
The writer meant "expense system" to be a link and never made it one, so a new starter reads the sentence and has no way to reach the system.
A definition is never shown, so nothing on the page tells the writer the link is missing.

The fix turns "expense system" into a link that uses the definition.
If a definition is left over from a link that was removed on purpose, delete it instead.

## Settings

A definition no link uses is a warning at the default level; `strict` makes it an error and `relaxed` a note.

If your pages keep shared definitions that other pages use, relax it:

```yaml chaff-settings
rules:
  link-definition-unused: relaxed
```

To stop checking it, write `off` instead of `relaxed`.

```text chaff-explain
$ npx chaffjs explain link-definition-unused --genre docs/manual

  Link definition that does nothing   (link-definition-unused)

  A reference-style Markdown link ("[report][1]") takes its address from a "[1]: URL" line somewhere in the document. A definition no link calls is not shown and does nothing. It is left behind when a link's text was changed, the link was removed, or its label was mistyped, and it shows that a link the writer meant to give is missing from the text. A second definition of the same label with another address is silently ignored too: Markdown uses the first one (markdownlint's MD053; remark-lint's no-unused-definitions and no-duplicate-definitions).

  How to fix: If the text was meant to link there, make the link's label match the definition ("[report][label]"). If the definition is no longer needed, delete it. For a second definition, decide which address is right and keep one.

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax link-definition-unused --why "reason"
```

[All samples](README.md)
